import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
  OnChanges,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration, ChartType, LegendItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { calcularTendencia, getGridColor, getLineWidth } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-gastos-diario-promedio',
  imports: [BaseChartDirective, MatProgressSpinnerModule, CommonModule],
  templateUrl: './grafico-gastos-diario-promedio.html',
  styleUrl: './grafico-gastos-diario-promedio.scss',
  standalone: true,
})
export class GraficoGastosDiarioPromedio implements OnInit, OnChanges {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() datosAnuales: { mes: string; total: number }[] = [];


  @Input() isCargandoInput = false;
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  isBrowser = isPlatformBrowser(this.platformId);
  isCargando = signal(false);

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [],
  };
  chartType: ChartType = 'bar';

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: LegendItem) => legendItem.text !== 'Tendencia',
        },
      },
    },
    scales: {
      x: {
        grid: { color: (ctx) => getGridColor(ctx) },
      },
      y: {
        beginAtZero: false,
        border: { display: true },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };

  async ngOnInit() {
    if (this.isBrowser && this.datosAnuales && this.datosAnuales.length > 0) {
      await this.cargarTotales();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.isBrowser && (changes['datosAnuales'] || changes['isCargandoInput'])) {
      await this.cargarTotales();
    }
  }

  async cargarTotales() {
    this.isCargando.set(true);

    const resultados = this.datosAnuales ?? [];
    if (!resultados || resultados.length === 0) {
      this.isCargando.set(false);
      return;
    }

    const labels = resultados.map((r) => r.mes);
    const data = resultados.map((r) => r.total);
    const tendencia = this.calcularTendencia(data);

    const backgroundColors = data.map((v) => (v < 0 ? '#ef4444' : '#3b82f6'));
    const borderColors = data.map((v) => (v < 0 ? '#dc2626' : '#2563eb'));

    this.chartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Gastos Mensuales Promedio',
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          type: 'line',
          label: 'Tendencia',
          data: tendencia,
          borderColor: '#1d4ed8',
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ],
    };

    this.isCargando.set(false);
    this.cdr.detectChanges();
    this.chart?.update();
  }

  private calcularTendencia(data: number[]): number[] {
    const n = data.length;
    if (n === 0) return [];
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;
    return data.map((_, i) => slope * i + intercept);
  }
}
