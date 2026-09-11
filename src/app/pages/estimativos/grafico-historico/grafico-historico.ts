import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { calcularTendencia, getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-historico',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule],
  templateUrl: './grafico-historico.html',
  styleUrl: './grafico-historico.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoHistorico {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;

  isBrowser = false;
  chartPlugins = [yearBackgroundPlugin];

  @Input() set datosHistoricosEstimativos(value: EstimativoRow[]) {
    if (value && value.length > 0) {
      const hoy = new Date();
      const formatoHoy = `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
      this.chartData = {
        labels: value.map((v) => v.fecha),
        datasets: [
          {
            label: 'Real',
            data: value.map((v) => v.real),
            borderColor: '#2196f3',
            fill: false,
            tension: 0.2,
            pointBackgroundColor: value.map((v) =>
              v.fecha === formatoHoy ? '#21f3c9ff' : '#2196f3',
            ),
            pointBorderColor: value.map((v) => (v.fecha === formatoHoy ? 'green' : '#2196f3')),
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 4 : 1)),
          },
          {
            label: 'Tendencia',
            data: calcularTendencia(value.map((d) => d.real)),
            borderColor: '#7bb5f8ff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Estimado $',
            data: value.map((d) => d.saldoPesos),
            borderColor: '#ab01d5ff',
            pointBackgroundColor: '#ab01d5ff',
            fill: false,
            tension: 0.3,
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 4 : 1)),
          },
          {
            label: 'Deuda Real',
            data: value.map((d) => d.deudaReal),
            borderColor: '#d81f1fff',
            pointBackgroundColor: '#d81f1fff',
            fill: false,
            tension: 0.3,
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 4 : 1)),
          },
          {
            label: 'TendenciaDeuda',
            data: calcularTendencia(value.map((d) => d.deudaReal ?? 0)),
            borderColor: '#f86d6dff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Deuda',
            data: value.map((d) => d.deuda),
            borderColor: '#f07793ff',
            pointBackgroundColor: '#f07793ff',
            fill: false,
            tension: 0.3,
            pointRadius: value.map((v) => (v.fecha === formatoHoy ? 4 : 1)),
          },
        ],
      };
    }
  }

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Total mensual $',
        data: [],
        borderColor: '#007bff',
        fill: false,
        tension: 0.4, // curva suave pero más estable
      },
    ],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    layout: {
      padding: {
        bottom: 15,
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: unknown) => {
            const li = legendItem as { text?: string };
            return (li.text ?? '') !== 'Tendencia' && (li.text ?? '') !== 'TendenciaDeuda';
          },
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
    animation: false, // 👈 desactiva todas las animaciones
    transitions: {
      active: {
        animation: {
          duration: 0, // 👈 sin animación al hacer hover
        },
      },
    },
  };

  /* constructor(
          @Inject(PLATFORM_ID) private platformId: Object
  
      ) {
          this.isBrowser = isPlatformBrowser(this.platformId);
  
      } */
  /* chartData: ChartConfiguration<'line'>['data'] = {
           labels: [],
           datasets: [
               {
                   label: 'Saldo $',
                   data: [],
                   borderColor: '#aa51f3ff', // color por defecto
                   fill: false,
                   segment: {
                       borderColor: ctx => {
                           const valor = ctx.p1.parsed.y; // valor del punto final del segmento
                           return valor < 0 ? '#800000' : '#aa51f3ff'; // bordó si es negativo
                       }
                   }
               }
           ]
       };
       chartOptions: ChartConfiguration<'line'>['options'] = {
           responsive: true,
           plugins: {
               legend: {
                   display: true,
                   labels: {
                       filter: (legendItem: any) => legendItem.text !== 'Tendencia' && legendItem.text !== 'TendenciaDeuda'
                   }
               }
           },
           scales: {
               x: {},
               y: {
                   beginAtZero: true,
                   border: {
                       display: true
                   },
                   grid: {
                       color: (ctx) => {
                           return ctx.tick.value === 0 ? '#000' : '#e0e0e0'; // negro en 0, gris en el resto
                       },
                       lineWidth: (ctx) => {
                           return ctx.tick.value === 0 ? 2 : 1; // más grueso en 0
                       }
                   }
               }
           }
       }; */
}
