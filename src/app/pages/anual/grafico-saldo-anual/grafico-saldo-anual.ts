import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, Input, PLATFORM_ID, signal, SimpleChanges, ViewChild } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { calcularTendencia, getGridColor, getLineWidth } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-saldo-anual',
  imports: [BaseChartDirective, MatProgressSpinnerModule, CommonModule],
  templateUrl: './grafico-saldo-anual.html',
  styleUrl: './grafico-saldo-anual.scss'
})
export class GraficoSaldoAnual {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() datosAnuales: { mes: string; total: number }[] = [];

  @Input() mesSeleccionado = '';
  isBrowser = false;
  @Input() isCargando =false;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        borderColor: '#007bf6ff',
        fill: false
      }
    ]
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: any) => legendItem.text !== 'Tendencia'
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: (ctx) => getGridColor(ctx)
        }
      },
      y: {
        beginAtZero: true,
        border: {
          display: true
        },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        }
      }
    }
  };

  /*  async ngOnChanges(changes: SimpleChanges) {
     if (this.isBrowser && (changes['datosAnuales'] )) {
       await this.cargarTotales2();
     }
   } */

  async ngOnChanges(changes: SimpleChanges) {
    if (this.isBrowser && changes['datosAnuales']) {
      const prev = changes['datosAnuales'].previousValue;
      const curr = changes['datosAnuales'].currentValue;
      if (!prev || JSON.stringify(prev) !== JSON.stringify(curr)) {
        await this.cargarTotales2();
      }
    }
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private storeGoogle: MovimientosStoreGoogle
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

  }

  async cargarTotales2() {

    // Obtener los totales globales por mes
    const resultados = this.datosAnuales;

    const labels = resultados.map(r => r.mes);
    const data = resultados.map(r => r.total);
    const tendencia = calcularTendencia(data);

    const pointColors = data.map(valor => valor >= 0 ? '#007bf6ff' : '#ff0000ff');
    const borderColors = pointColors;
    const pointRadius = data.map(() => 4); // opcional: tamaño uniforme

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Total Saldo mensual $',
          data,
          borderColor: borderColors,
          pointBackgroundColor: borderColors,
          pointBorderColor: borderColors,
          pointRadius,
          borderWidth: 2,
          fill: false,
          tension: 0.3
        },
        {
          label: 'Tendencia',
          data: tendencia,
          borderColor: borderColors,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,

        }
      ]
    };

    this.cdr.detectChanges();
    //this.chart?.ngOnDestroy();
    this.chart?.update();
  }
}
