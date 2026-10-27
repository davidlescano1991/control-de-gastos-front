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
  signal,
  OnChanges,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { getGridColor, getLineWidth, calcularTendencia } from '../../../utils/grafico.utils';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { OrigenDatosComponent } from '../../../common/origen-datos/origen-datos.component';

@Component({
  selector: 'app-grafico-estimativo',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatIconModule, OrigenDatosComponent],
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
  serieActiva = signal<'todas' | 'saldos' | 'deudas'>('todas');

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  cambiarSerie(serie: 'todas' | 'saldos' | 'deudas') {
    if (this.serieActiva() === serie) return;
    this.serieActiva.set(serie);
    if (this.datosActuales.length > 0) {
      this.generarDatasets();
      this.cdr.detectChanges();
      this.chart?.update();
    }
  }

  @Input() mesSeleccionado = '';
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() estimativoFilas: any[] = [];
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);

  private datosActuales: any[] = [];

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 150,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: { size: 12, weight: 'bold' },
          color: '#475569',
          filter: (legendItem: any) =>
            !legendItem.text.startsWith('Tendencia'),
        },
      },
      tooltip: {
        filter: (tooltipItem: any) => {
          const dsLabel = tooltipItem?.dataset?.label || '';
          return !dsLabel.toLowerCase().includes('tendencia');
        },
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#f1f5f9',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (context) => {
            const raw = context.parsed.y;
            if (raw === null || raw === undefined) return '';
            const dsLabel = context.dataset.label || '';
            return ` ${dsLabel}: $` + raw.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: (ctx) => getGridColor(ctx),
        },
        ticks: {
          color: '#64748b',
          font: { size: 11, weight: 'bold' },
          maxRotation: 45,
          minRotation: 0,
          callback: function (val, index) {
            const label = this.getLabelForValue(val as number);
            if (!label) return '';
            // Si el formato es DD/MM/YYYY, mostramos solo DD/MM en el eje para máxima limpieza
            const partes = label.split('/');
            if (partes.length >= 2) {
              return `${partes[0]}/${partes[1]}`;
            }
            return label;
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (value) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (Math.abs(num) >= 1000) return (num / 1000).toFixed(0) + 'k';
            return num.toLocaleString('es-AR');
          },
        },
      },
    },
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private cdr: ChangeDetectorRef,
    private storeGoogle: MovimientosStoreGoogle,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (
      (changes['mesSeleccionado'] ||
        changes['anioSeleccionado'] ||
        changes['estimativoFilas']) &&
      this.isBrowser
    ) {
      await this.cargarGrafico();
    }
  }

  async cargarGrafico() {
    this.isCargando.set(true);

    try {
      const hoja = 'Estimativo ' + this.mesSeleccionado;
      const anio = this.anioSeleccionado;
      const datos =
        this.estimativoFilas && this.estimativoFilas.length > 0
          ? this.estimativoFilas
          : await this.storeGoogle.getEstimados(anio, hoja);

      if (!datos || datos.length === 0) {
        this.datosActuales = [];
        this.chartData = { labels: [], datasets: [] };
        this.cdr.detectChanges();
        this.chart?.update();
        return;
      }

      this.datosActuales = datos;
      this.generarDatasets();
      this.cdr.detectChanges();
      this.chart?.update();
    } catch (err) {
      console.warn('⚠️ Error en GraficoEstimativo.cargarGrafico:', err);
    } finally {
      this.isCargando.set(false);
      this.cdr.detectChanges();
    }
  }

  private generarDatasets() {
    const datos = this.datosActuales;
    if (!datos || datos.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      return;
    }

    const labels = datos.map((d: { fecha: any }) => d.fecha);
    const saldoPesos = datos.map((d: { saldoPesos: any }) => d.saldoPesos);
    const deuda = datos.map((d: { deuda: any }) => d.deuda);
    const real = datos.map((d: { real: any }) => (d.real !== null && d.real !== undefined ? d.real : null));
    const deudaReal = datos.map((d: { deudaReal: any }) => (d.deudaReal !== null && d.deudaReal !== undefined ? d.deudaReal : null));

    const tendenciaSaldo = calcularTendencia(saldoPesos);
    const tendenciaReal = calcularTendencia(real);
    const tendenciaDeudaReal = calcularTendencia(deudaReal);

    // Detección de picos positivo y negativo entre Real y Saldo Estimado
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
        (min, curr) => (curr.diff < min.diff ? curr : min),
        diferencias[0],
      );
      indexNegativo = minObj.index;

      const maxObj = diferencias.reduce(
        (max, curr) => (curr.diff > max.diff ? curr : max),
        diferencias[0],
      );
      indexPositivo = maxObj.index;
    }

    // Estilos de puntos para Real (azul original #2196f3, destacando picos con verde/rojo y halos blancos elegantes)
    const pointColors = datos.map((d: any, i: number) => {
      if (d.real === null || d.real === undefined) return 'transparent';
      if (i === indexNegativo) return '#ef4444'; // Rojo coral para peor brecha
      if (i === indexPositivo) return '#10b981'; // Verde esmeralda para mejor saldo
      return '#2196f3'; // Azul original solicitado por el usuario
    });

    const pointBorderColors = datos.map((d: any) => {
      if (d.real === null || d.real === undefined) return 'transparent';
      return '#ffffff';
    });

    const pointRadius = datos.map((d: any, i: number) => {
      if (d.real === null || d.real === undefined) return 0;
      return i === indexNegativo || i === indexPositivo ? 6.5 : 4.5;
    });

    const serie = this.serieActiva();
    const datasets: any[] = [];

    // 🔵 SERIE SALDOS (Saldo Real en azul original #2196f3)
    if (serie === 'todas' || serie === 'saldos') {
      const isSoloSaldos = serie === 'saldos';
      datasets.push(
        {
          label: 'Saldo Real',
          data: real,
          borderColor: '#2196f3',
          backgroundColor: isSoloSaldos ? 'rgba(33, 150, 243, 0.12)' : 'rgba(33, 150, 243, 0.03)',
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorderColors,
          pointBorderWidth: 1.5,
          pointRadius,
          pointHoverRadius: 7.5,
          fill: isSoloSaldos,
          tension: 0.35,
          borderWidth: 2.6,
          spanGaps: false,
        },
        {
          label: 'Tendencia Real',
          data: tendenciaReal,
          borderColor: '#7bb5f8ff',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Saldo Estimado',
          data: saldoPesos,
          borderColor: '#ab01d5ff',
          backgroundColor: 'transparent',
          pointBackgroundColor: '#ab01d5ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.35,
          borderWidth: 2.2,
        },
      );
    }

    // 🔴 SERIE DEUDAS
    if (serie === 'todas' || serie === 'deudas') {
      const isSoloDeudas = serie === 'deudas';
      datasets.push(
        {
          label: 'Deuda Real',
          data: deudaReal,
          borderColor: '#ef4444',
          backgroundColor: isSoloDeudas ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.04)',
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4.5,
          pointHoverRadius: 7.5,
          fill: isSoloDeudas,
          tension: 0.35,
          borderWidth: 2.6,
          spanGaps: false,
        },
        {
          label: 'Tendencia Deuda',
          data: tendenciaDeudaReal,
          borderColor: '#fca5a5',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Deuda Estimada',
          data: deuda,
          borderColor: '#f97316',
          backgroundColor: 'transparent',
          pointBackgroundColor: '#f97316',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.35,
          borderWidth: 2.2,
        },
      );
    }

    // Cálculo dinámico de escala Y
    const valoresParaMax = [
      ...(serie !== 'deudas' ? saldoPesos : []),
      ...(serie !== 'saldos' ? deuda : []),
      ...(serie !== 'deudas' ? real.filter((r: null) => r !== null) : []),
      ...(serie !== 'saldos' ? deudaReal.filter((d: null) => d !== null) : []),
    ].filter((v) => typeof v === 'number' && !isNaN(v));

    const maxValor = valoresParaMax.length > 0 ? Math.max(...valoresParaMax) : 0;
    const pasoRedondeo = maxValor > 2000000 ? 500000 : 250000;
    const maxY = isFinite(maxValor) && maxValor > 0 ? redondearArriba(maxValor * 1.08, pasoRedondeo) : 2000000;

    this.chartOptions = {
      ...this.chartOptions,
      scales: {
        ...this.chartOptions?.scales,
        y: {
          ...this.chartOptions?.scales?.['y'],
          beginAtZero: true,
          max: maxY,
        },
      },
    };

    this.chartData = {
      labels,
      datasets,
    };
  }
}

function redondearArriba(valor: number, paso: number): number {
  return Math.ceil(valor / paso) * paso;
}

