import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { EstimativoRow } from '../../../stores/movimiento.google';
import { getGridColor, getLineWidth } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-dias-restantes-estimativo',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './grafico-dias-restantes-estimativo.html',
  styleUrls: ['./grafico-dias-restantes-estimativo.scss'],
})
export class GraficoDiasRestantesEstimativo implements OnChanges {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @Input() estimativoFilas: EstimativoRow[] = [];

  chartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Progreso del mes'],
    datasets: [
      {
        label: 'Transcurrido',
        data: [0],
        backgroundColor: () => {
          const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
          return isDark ? '#4ade80' : 'rgba(34, 197, 94, 0.85)';
        },
        borderColor: () => {
          const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
          return isDark ? '#86efac' : '#16a34a';
        },
        borderWidth: 1,
        borderRadius: 4,
        stack: 'a',
      },
      {
        label: 'Restante',
        data: [30],
        backgroundColor: () => {
          const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
          return isDark ? '#f87171' : 'rgba(239, 68, 68, 0.85)';
        },
        borderColor: () => {
          const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
          return isDark ? '#fca5a5' : '#dc2626';
        },
        borderWidth: 1,
        borderRadius: 4,
        stack: 'a',
      },
    ],
  };

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: {
      duration: 4000,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: { display: true },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 30,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
      y: {
        ticks: { font: { weight: 'bold' } },
        grid: {
          display: false,
        },
      },
    },
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['estimativoFilas'] || changes['mesSeleccionado']) {
      this.actualizarGrafico();
    }
  }

  getDiasCargados(): number {
    if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 0;
    return this.estimativoFilas.filter(
      (f) => f.real !== null && f.real !== undefined,
    ).length;
  }

  getTotalDias(): number {
    if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 30;
    return this.estimativoFilas.length;
  }

  getPorcentaje(): number {
    const total = this.getTotalDias();
    if (total === 0) return 0;
    const cargados = this.getDiasCargados();
    return Math.round((cargados / total) * 10000) / 100;
  }

  getColorPorcentaje(): string {
    const porcentaje = Math.min(100, Math.max(0, this.getPorcentaje()));
    const hue = (porcentaje / 100) * 135;
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
    return isDark ? `hsl(${hue}, 90%, 60%)` : `hsl(${hue}, 85%, 38%)`;
  }

  private actualizarGrafico(): void {
    const cargados = this.getDiasCargados();
    const total = this.getTotalDias();
    const restante = Math.max(0, total - cargados);
    const labelMes = this.mesSeleccionado ? `Progreso de ${this.mesSeleccionado}` : 'Progreso del mes';

    this.chartData = {
      labels: [labelMes],
      datasets: [
        {
          label: 'Transcurrido',
          data: [cargados],
          backgroundColor: () => {
            const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
            return isDark ? '#4ade80' : 'rgba(34, 197, 94, 0.85)';
          },
          borderColor: () => {
            const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
            return isDark ? '#86efac' : '#16a34a';
          },
          borderWidth: 1,
          borderRadius: 4,
          stack: 'a',
        },
        {
          label: 'Restante',
          data: [restante],
          backgroundColor: () => {
            const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
            return isDark ? '#f87171' : 'rgba(239, 68, 68, 0.85)';
          },
          borderColor: () => {
            const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
            return isDark ? '#fca5a5' : '#dc2626';
          },
          borderWidth: 1,
          borderRadius: 4,
          stack: 'a',
        },
      ],
    };

    if (this.chartOptions && this.chartOptions.scales && this.chartOptions.scales['x']) {
      this.chartOptions.scales['x'].max = total;
    }
  }
}
