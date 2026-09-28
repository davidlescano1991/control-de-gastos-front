import { Component, Input, signal } from '@angular/core';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration, LegendItem } from 'chart.js';
import { calcularTendencia, getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-movimientos-historicos',
  imports: [BaseChartDirective, CommonModule, MatProgressSpinnerModule],
  templateUrl: './movimientos-historicos.html',
  styleUrl: './movimientos-historicos.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoMovimientosHistoricos {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;
  chartPlugins = [yearBackgroundPlugin];

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Saldo $',
        data: [],
        borderColor: '#aa51f3ff', // color por defecto
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const valor = ctx.p1.parsed.y ?? 0; // valor del punto final del segmento (fallback 0)
            return valor < 0 ? '#800000' : '#aa51f3ff';
          },
        },
      },
    ],
  };
  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // 👈 permite que el gráfico se expanda verticalmente
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: LegendItem) =>
            legendItem.text !== 'Tendencia' && legendItem.text !== 'Tendencia Deuda',
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        border: {
          display: true,
        },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };
  @Input() set datosHistoricosDiarios(value: { fecha: string; total: number; deuda: number }[]) {
    if (value && value.length > 0) {
      this.chartData.labels = value.map((v) => v.fecha);
      this.chartData.datasets[0].data = value.map((v) => v.total);

      this.chartData = {
        labels: value.map((v) => v.fecha),
        datasets: [
          {
            label: 'Saldo $',
            data: value.map((v) => v.total),
            fill: false,
            tension: 0.4,
            borderColor: '#aa51f3ff',
          },
          {
            label: 'Tendencia',
            data: calcularTendencia(value.map((d) => d.total ?? 0)),
            borderColor: '#d09ff7ff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Deudas $',
            data: value.map((v) => v.deuda),
            borderColor: '#f00000ff',
            fill: false,
          },
          {
            label: 'Tendencia Deuda',
            data: calcularTendencia(value.map((d) => d.deuda ?? 0)),
            borderColor: '#f79f9fff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
        ],
      };
    }
  }
}
