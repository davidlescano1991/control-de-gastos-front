/* eslint-disable @typescript-eslint/no-explicit-any, @angular-eslint/prefer-inject */
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { getGridColor, getLineWidth } from '../../../utils/grafico.utils';
import { signal, OnChanges } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { calcularTendencia } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-estimativo',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './grafico-estimativo.html',
  styleUrl: './grafico-estimativo.scss',
})
export class GraficoEstimativo implements OnChanges {
  @Input() isColDerechaContraida = false;
  @Output() toggleHorizontalCollapse = new EventEmitter<void>();

  onToggleHorizontalCollapse() {
    this.toggleHorizontalCollapse.emit();
  }

  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() estimativoFilas: any[] = [];
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: any) =>
            legendItem.text !== 'Tendencia' &&
            legendItem.text !== 'TendenciaDeuda' &&
            legendItem.text !== 'TendenciaReal' &&
            legendItem.text != 'TendenciaDeudaReal',
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        max: 6000000,
        border: {
          display: true,
        },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0,
        },
      },
    },
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private cdr: ChangeDetectorRef,
    private storeGoogle: MovimientosStoreGoogle,
  ) {
    console.log('Grafico de estimativo constructor()');

    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes['mesSeleccionado'] ||
        changes['anioSeleccionado'] ||
        changes['estimativoFilas']) &&
      this.isBrowser
    ) {
      //console.log('Grafico de estimativo inicio método ngOnChanges()')
      await this.cargarGrafico();
    }
  }

  async cargarGrafico() {
    console.log('Grafico de estimativo inicio método cargarGrafico()');
    this.isCargando.set(true);

    try {
      const hoja = 'Estimativo ' + this.mesSeleccionado;
      const anio = this.anioSeleccionado;
      const datos =
        this.estimativoFilas && this.estimativoFilas.length > 0
          ? this.estimativoFilas
          : await this.storeGoogle.getEstimados(anio, hoja);

      if (!datos || datos.length === 0) {
        this.chartData = { labels: [], datasets: [] };
        this.cdr.detectChanges();
        this.chart?.update();
        return;
      }

      const labels = datos.map((d: { fecha: any }) => d.fecha);
      const saldoPesos = datos.map((d: { saldoPesos: any }) => d.saldoPesos);
      const deuda = datos.map((d: { deuda: any }) => d.deuda);
      const real = datos.map((d: { real: any }) => (d.real !== null && d.real !== undefined ? d.real : null));
      const deudaReal = datos.map((d: { deudaReal: any }) => (d.deudaReal !== null && d.deudaReal !== undefined ? d.deudaReal : null));
      const tendencia = calcularTendencia(saldoPesos);
      const tendenciaReal = calcularTendencia(real);
      const tendenciaDeudaReal = calcularTendencia(deudaReal);

      const diferencias = datos
        .map((d: { real: number | null; saldoPesos: number }, i: number) => ({
          index: i,
          diff: d.real !== null && d.real !== undefined ? d.real - d.saldoPesos : null,
        }))
        .filter((d: { diff: number | null }): d is { index: number; diff: number } => d.diff !== null);

      let indexNegativo = -1;
      let indexPositivo = -1;

      if (diferencias.length > 0) {
        const minObj = diferencias.reduce(
          (min: { index: number; diff: number }, curr: { index: number; diff: number }) =>
            curr.diff < min.diff ? curr : min,
          diferencias[0],
        );
        indexNegativo = minObj.index;

        const maxObj = diferencias.reduce(
          (max: { index: number; diff: number }, curr: { index: number; diff: number }) =>
            curr.diff > max.diff ? curr : max,
          diferencias[0],
        );
        indexPositivo = maxObj.index;
      }

      const pointColors = datos.map((d: any, i: number) => {
        if (d.real === null || d.real === undefined) return 'transparent';
        if (i === indexNegativo) return 'red';
        if (i === indexPositivo) return 'green';
        return '#2196f3';
      });

      const borderColors = datos.map((d: any, i: number) => {
        if (d.real === null || d.real === undefined) return 'transparent';
        if (i === indexNegativo) return 'red';
        if (i === indexPositivo) return 'green';
        return '#2196f3';
      });

      const pointRadius = datos.map((d: any, i: number) => {
        if (d.real === null || d.real === undefined) return 0;
        return i === indexNegativo || i === indexPositivo ? 6 : 4;
      });

      const valoresParaMax = [
        ...saldoPesos,
        ...deuda,
        ...real.filter((r: null) => r !== null),
        ...deudaReal.filter((d: null) => d !== null),
      ].filter((v) => typeof v === 'number' && !isNaN(v));

      const maxValor = valoresParaMax.length > 0 ? Math.max(...valoresParaMax) : 0;
      const maxY = isFinite(maxValor) && maxValor > 0 ? redondearArriba(maxValor, 1000000) : 6000000;
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 150,
        plugins: {
          legend: {
            display: true,
            labels: {
              filter: (legendItem: any) =>
                legendItem.text !== 'Tendencia' &&
                legendItem.text !== 'TendenciaDeuda' &&
                legendItem.text !== 'TendenciaReal' &&
                legendItem.text != 'TendenciaDeudaReal',
            },
          },
        },
        scales: {
          x: {},
          y: {
            beginAtZero: true,
            max: maxY,
            border: { display: true },
            grid: {
              color: (ctx) => getGridColor(ctx),
              lineWidth: (ctx) => getLineWidth(ctx),
            },
          },
        },
        animation: false,
        transitions: {
          active: {
            animation: {
              duration: 0,
            },
          },
        },
      };
      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo $',
            data: saldoPesos,
            borderColor: '#ab01d5ff',
            pointBackgroundColor: '#ab01d5ff',
            fill: false,
            tension: 0.3,
          },
          {
            label: 'Tendencia',
            data: tendencia,
            borderColor: '#d073ffff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Real',
            data: real,
            borderColor: borderColors,
            pointBackgroundColor: pointColors,
            pointBorderColor: borderColors,
            pointRadius,
            fill: false,
            tension: 0.3,
          },
          {
            label: 'TendenciaReal',
            data: tendenciaReal,
            borderColor: '#7bb5f8ff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Deuda',
            data: deuda,
            borderColor: '#f92858ff',
            pointBackgroundColor: '#f92858ff',
            fill: false,
            tension: 0.3,
          },
          {
            label: 'Deuda Real',
            data: deudaReal,
            borderColor: '#d81f1fff',
            pointBackgroundColor: '#d81f1fff',
            fill: false,
            tension: 0.3,
          },
          {
            label: 'TendenciaDeudaReal',
            data: tendenciaDeudaReal,
            borderColor: '#f86d6dff',
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false,
          },
        ],
      };

      this.cdr.detectChanges();
      this.chart?.update();
    } catch (err) {
      console.warn('⚠️ Error en GraficoEstimativo.cargarGrafico:', err);
    } finally {
      this.isCargando.set(false);
      this.cdr.detectChanges();
      console.log('Grafico de estimativo fin método cargarGrafico()');
    }
  }
}
function redondearArriba(valor: number, paso: number): number {
  return Math.ceil(valor / paso) * paso;
}
