import { isPlatformBrowser, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, Input, PLATFORM_ID, signal, SimpleChanges, ViewChild } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart, ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { calcularTendencia, getGridColor, getLineWidth } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-rendimientos-positivos-mensuales',
  imports: [BaseChartDirective, MatProgressSpinnerModule, NgIf],
  templateUrl: './grafico-rendimientos-positivos-mensuales.html',
  styleUrl: './grafico-rendimientos-positivos-mensuales.scss'
})
export class GraficoRendimientosPositivosMensuales {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() datosAnuales: any;

  @Input() mesSeleccionado = '';
  isBrowser = false;
  isCargando = signal(false);

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        borderColor: '#ff0000ff',
        fill: false
      }
    ]
  };
  chartType: ChartType = 'bar';
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: any) => legendItem.text !== 'Tendencia',
          generateLabels: (chart) => {
            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
            return original.map((item) => {
              if (item.text === 'Rendimientos positivos') {
                item.fillStyle = '#22c55e';
                item.strokeStyle = '#16a34a';
              }
              return item;
            });
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return ` ${label}: ${Number(value).toFixed(2)}%`;
          }
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

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private storeGoogle: MovimientosStoreGoogle
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnChanges() {
    console.log('entro a inOnChanges de GraficoRendimientosPositivosMensuales ')
    if (this.isBrowser) {
      await this.cargarTotales();
    }
  }

  private getColorPorcentaje(valor: number, isBorder = false): string {
    const pct = Math.min(100, Math.max(0, valor || 0));
    // 0% = Rojo (hue 0), 50% = Ámbar/Amarillo (hue 70), 100% = Verde (hue 140)
    const hue = Math.round((pct / 100) * 140);
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');

    if (isBorder) {
      return isDark ? `hsl(${hue}, 95%, 60%)` : `hsl(${hue}, 85%, 35%)`;
    }
    return isDark ? `hsl(${hue}, 90%, 50%)` : `hsl(${hue}, 80%, 45%)`;
  }

  async cargarTotales() {
    this.isCargando.set(true);

    // Obtener los totales globales por mes
    const resultados = this.storeGoogle.tablaSecundaria() ?? [];
    const valores = this.storeGoogle.categoriasSecundaria() ?? [];

    if (!resultados || resultados.length === 0 || !valores || valores.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      this.cdr.detectChanges();
      this.chart?.update();
      this.isCargando.set(false);
      return;
    }

    const labels = resultados.map(r => r.nombreFila);

    const datos: number[] = [];

    resultados.forEach(fila => {
      valores.forEach(cat => {
        const aux = fila.valores[cat] * 100;
        datos.push(aux);
      });
    });

    const tendencia = calcularTendencia(datos);
    const pointColors = datos.map((valor) => this.getColorPorcentaje(valor));
    const borderColors = datos.map((valor) => this.getColorPorcentaje(valor, true));

    this.chartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Rendimientos positivos',
          data: datos,
          borderColor: borderColors,
          backgroundColor: pointColors,
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          type: 'line',
          label: 'Tendencia',
          data: tendencia,
          borderColor: '#028e1eff',
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        }
      ]
    };

    this.cdr.detectChanges();
    this.chart?.ngOnDestroy();
    this.chart?.update();
    this.isCargando.set(false);
  }
}
