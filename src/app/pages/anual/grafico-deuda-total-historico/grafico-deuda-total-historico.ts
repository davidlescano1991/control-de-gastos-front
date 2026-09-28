import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration, LegendItem } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DeudaTotalHistoricoItem } from '../../../models/deuda-total';
import { Prestamo } from '../../../models/prestamo';
import {
  calcularTendencia,
  getGridColor,
  getLineWidth,
  yearBackgroundPlugin,
} from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-deuda-total-historico',
  imports: [BaseChartDirective, MatProgressSpinnerModule, CommonModule],
  templateUrl: './grafico-deuda-total-historico.html',
  styleUrl: './grafico-deuda-total-historico.scss',
  standalone: true,
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoDeudaTotalHistorico implements OnInit, OnChanges {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() datos: DeudaTotalHistoricoItem[] = [];
  @Input() isCargandoInput = false;
  @Input() filas: Prestamo[] = [];
  @Input() categorias: string[] = [];

  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  isBrowser = isPlatformBrowser(this.platformId);
  isCargando = signal(false);

  chartPlugins = [yearBackgroundPlugin];

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: LegendItem) => legendItem.text !== 'Tendencia',
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            if (context.dataset.label === 'Tendencia') return '';
            const raw = context.raw as number;
            const formatted = new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              minimumFractionDigits: 2,
            }).format(raw);
            return ` ${context.dataset.label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: (ctx) => getGridColor(ctx) },
      },
      y: {
        beginAtZero: true,
        border: { display: true },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        ticks: {
          callback: (value) => {
            if (typeof value === 'number') {
              if (value >= 1_000_000) {
                return `$${(value / 1_000_000).toFixed(1)}M`;
              }
              if (value >= 1_000) {
                return `$${(value / 1_000).toFixed(0)}k`;
              }
              return `$${value}`;
            }
            return value;
          },
        },
      },
    },
  };

  ngOnInit(): void {
    this.construirGrafico();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['filas'] || changes['categorias']) {
      this.construirGrafico();
    }
  }

  esFilaTotalmentePagada(fila: Prestamo): boolean {
    if (!this.categorias || this.categorias.length === 0) return true;
    const catsConValor = this.categorias.filter((cat) => (fila.valores?.[cat] ?? 0) > 0);
    if (catsConValor.length === 0) return true;
    return catsConValor.every((cat) => (fila.colores?.[cat] ?? '').toLowerCase() === '#0000ff');
  }

  obtenerNombrePrimerMesPendiente(): string | null {
    if (!this.filas || this.filas.length <= 2) return null;
    const filasMeses = this.filas.slice(1, -1);
    for (const fila of filasMeses) {
      if (!this.esFilaTotalmentePagada(fila)) {
        return fila.nombreFila;
      }
    }
    return null;
  }

  private normalizar(texto: string | undefined): string {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, ' ')
      .trim();
  }

  private construirGrafico(): void {
    const rawData = this.datos ?? [];
    if (rawData.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      this.cdr.markForCheck();
      return;
    }

    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActualIdx = now.getMonth();
    const mesesBase = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    const primerMesPendiente = this.obtenerNombrePrimerMesPendiente();
    let idxActual = -1;

    if (primerMesPendiente) {
      const normPrimerPendiente = this.normalizar(primerMesPendiente);
      idxActual = rawData.findIndex((r) => {
        if (r.anio !== anioActual) return false;
        return this.normalizar(r.mes) === normPrimerPendiente;
      });
    }

    if (idxActual === -1) {
      idxActual = rawData.findIndex((r) => {
        if (r.anio !== anioActual) return false;
        const mesNorm = (r.mes || '').toLowerCase().replace(/[\d_]+/g, '').trim();
        const idxMes = mesesBase.indexOf(mesNorm);
        return idxMes === mesActualIdx;
      });
    }

    const esMesPasado = (idx: number): boolean => {
      if (idxActual !== -1) return idx < idxActual;
      const r = rawData[idx];
      if (r.anio < anioActual) return true;
      if (r.anio > anioActual) return false;
      const mesNorm = (r.mes || '').toLowerCase().replace(/[\d_]+/g, '').trim();
      const idxMes = mesesBase.indexOf(mesNorm);
      return idxMes !== -1 && idxMes < mesActualIdx;
    };

    const esMesActual = (idx: number): boolean => {
      if (idxActual !== -1) return idx === idxActual;
      const r = rawData[idx];
      if (r.anio !== anioActual) return false;
      const mesNorm = (r.mes || '').toLowerCase().replace(/[\d_]+/g, '').trim();
      return mesesBase.indexOf(mesNorm) === mesActualIdx;
    };

    const labels = rawData.map((r) => r.label);
    const dataValores = rawData.map((r) => r.deudaTotal);
    const tendenciaData = calcularTendencia(dataValores);

    const pointBackgroundColors = rawData.map((_, idx) => {
      if (esMesActual(idx)) return '#eab308';
      if (esMesPasado(idx)) return '#10b981';
      return '#dc2626';
    });

    const pointBorderColors = rawData.map((_, idx) => {
      if (esMesActual(idx)) return '#ca8a04';
      return '#ffffff';
    });

    const pointBorderWidths = rawData.map((_, idx) => (esMesActual(idx) ? 2.5 : 1.5));
    const pointRadiusList = rawData.map((_, idx) => (esMesActual(idx) ? 7 : 4.5));
    const pointHoverRadiusList = rawData.map((_, idx) => (esMesActual(idx) ? 9 : 6.5));

    this.chartData = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Deuda Total',
          data: dataValores,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(239, 68, 68, 0.25)',
          segment: {
            borderColor: (ctx: any) => {
              const p1 = ctx.p1DataIndex;
              if (idxActual === -1) return '#10b981';
              return p1 <= idxActual ? '#10b981' : '#dc2626';
            },
            backgroundColor: (ctx: any) => {
              const p1 = ctx.p1DataIndex;
              if (idxActual === -1) return 'rgba(16, 185, 129, 0.25)';
              return p1 <= idxActual
                ? 'rgba(16, 185, 129, 0.25)'
                : 'rgba(239, 68, 68, 0.25)';
            },
          },
          pointBackgroundColor: pointBackgroundColors,
          pointBorderColor: pointBorderColors,
          pointBorderWidth: pointBorderWidths,
          pointRadius: pointRadiusList,
          pointHoverRadius: pointHoverRadiusList,
          borderWidth: 2.5,
          fill: true,
          tension: 0.25,
        },
        {
          type: 'line',
          label: 'Tendencia',
          data: tendenciaData,
          borderColor: 'rgba(185, 28, 28, 0.75)',
          borderDash: [4, 4],
          borderWidth: 1.8,
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    };

    if (this.chart) {
      this.chart.update();
    }
    this.cdr.markForCheck();
  }
}
