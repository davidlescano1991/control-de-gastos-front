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
import { BaseChartDirective } from 'ng2-charts';
import { DeudaTotalMes } from '../../../models/deuda-total';
import { Prestamo } from '../../../models/prestamo';
import { calcularTendencia, getGridColor, getLineWidth } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-deuda-total-usd',
  imports: [BaseChartDirective, MatProgressSpinnerModule, CommonModule],
  templateUrl: './grafico-deuda-total-usd.html',
  styleUrl: './grafico-deuda-total-usd.scss',
  standalone: true,
})
export class GraficoDeudaTotalUsd implements OnInit, OnChanges {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() datos: DeudaTotalMes[] = [];
  @Input() isCargandoInput = false;
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() filas: Prestamo[] = [];
  @Input() categorias: string[] = [];

  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  isBrowser = isPlatformBrowser(this.platformId);
  isCargando = signal(false);

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: LegendItem) => legendItem.text !== 'Tendencia',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = context.raw as number;
            const formatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
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
                return `US$ ${(value / 1_000_000).toFixed(1)}M`;
              }
              if (value >= 1_000) {
                return `US$ ${(value / 1_000).toFixed(0)}k`;
              }
              return `US$ ${value.toFixed(0)}`;
            }
            return value;
          },
        },
      },
    },
  };

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }

  esFilaTotalmentePagada(fila: Prestamo): boolean {
    if (!fila || !fila.valores) return true;
    const catsConValor = this.categorias.filter((cat) => (fila.valores[cat] ?? 0) !== 0);
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

  async ngOnInit() {
    if (this.isBrowser && this.datos && this.datos.length > 0) {
      await this.cargarTotales();
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      this.isBrowser &&
      (changes['datos'] ||
        changes['isCargandoInput'] ||
        changes['anioSeleccionado'] ||
        changes['filas'] ||
        changes['categorias'])
    ) {
      await this.cargarTotales();
    }
  }

  async cargarTotales() {
    this.isCargando.set(true);

    const resultados = this.datos ?? [];
    if (!resultados || resultados.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      this.chart?.update();
      this.cdr.detectChanges();
      this.isCargando.set(false);
      return;
    }

    const primerMesPendiente = this.obtenerNombrePrimerMesPendiente();
    let idxPrimerMesPendiente = -1;

    if (primerMesPendiente) {
      idxPrimerMesPendiente = resultados.findIndex(
        (r) => this.normalizar(r.mes) === this.normalizar(primerMesPendiente),
      );
    }

    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActualIdx = now.getMonth(); // 0 = Enero ... 11 = Diciembre
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
    const mesActualNombre = mesesBase[mesActualIdx];

    let idxActual = -1;
    if (idxPrimerMesPendiente !== -1) {
      idxActual = idxPrimerMesPendiente;
    } else if (this.anioSeleccionado === anioActual) {
      idxActual = resultados.findIndex((r, idx) => {
        const mesNorm = (r.mes || '').toLowerCase().trim().replace(/_/g, ' ');
        return idx === mesActualIdx || mesNorm === mesActualNombre;
      });
    }

    const esMesPasado = (idx: number): boolean => {
      if (idxActual === -1) {
        return this.anioSeleccionado < anioActual;
      }
      return idx < idxActual;
    };

    const esMesActual = (idx: number): boolean => {
      return idxActual !== -1 && idx === idxActual;
    };

    const labels = resultados.map((r) => r.mes.replace(/_/g, ' '));
    const data = resultados.map((r) => Number((r.deudaTotalUSD ?? 0).toFixed(2)));
    const tendencia = calcularTendencia(data);

    // Tonos de verde y rojo más oscuritos para el gráfico USD
    const verdeOscuro = '#047857';
    const verdeOscuroBg = 'rgba(4, 120, 87, 0.25)';
    const rojoOscuro = '#b91c1c';
    const rojoOscuroBg = 'rgba(185, 28, 28, 0.25)';

    const pointBackgroundColors = resultados.map((_, idx) => {
      if (esMesActual(idx)) return '#d97706';
      if (esMesPasado(idx)) return verdeOscuro;
      return rojoOscuro;
    });

    const pointBorderColors = resultados.map((_, idx) => {
      if (esMesActual(idx)) return '#b45309';
      return '#ffffff';
    });

    const pointBorderWidths = resultados.map((_, idx) => (esMesActual(idx) ? 2.5 : 1.5));
    const pointRadiusList = resultados.map((_, idx) => (esMesActual(idx) ? 7 : 4.5));
    const pointHoverRadiusList = resultados.map((_, idx) => (esMesActual(idx) ? 9 : 6.5));

    this.chartData = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Deuda Total USD',
          data,
          borderColor: rojoOscuro,
          backgroundColor: rojoOscuroBg,
          segment: {
            borderColor: (ctx: any) => {
              const p1 = ctx.p1DataIndex;
              if (idxActual === -1) {
                return this.anioSeleccionado < anioActual ? verdeOscuro : rojoOscuro;
              }
              return p1 <= idxActual ? verdeOscuro : rojoOscuro;
            },
            backgroundColor: (ctx: any) => {
              const p1 = ctx.p1DataIndex;
              if (idxActual === -1) {
                return this.anioSeleccionado < anioActual ? verdeOscuroBg : rojoOscuroBg;
              }
              return p1 <= idxActual ? verdeOscuroBg : rojoOscuroBg;
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
          data: tendencia,
          borderColor: '#7f1d1d',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
        },
      ],
    };

    this.isCargando.set(false);
    this.cdr.detectChanges();
    this.chart?.update();
  }
}
