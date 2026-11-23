import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, Input, OnInit, ViewChild, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DolarService } from '../../../services/dolar.service';
import { EstimativoRow } from '../../../stores/movimiento.google';
import { calcularTendencia, getGridColor, getLineWidth, yearBackgroundPlugin } from '../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-historico',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './grafico-historico.html',
  styleUrl: './grafico-historico.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class GraficoHistorico implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  private dolarService = inject(DolarService);
  private cdr = inject(ChangeDetectorRef);

  isCollapsed = signal(false);
  serieActiva = signal<'todas' | 'saldos' | 'deudas'>('todas');
  monedaActiva = signal<'ARS' | 'USD'>('ARS');

  private datosActuales: EstimativoRow[] = [];
  private dolarFallback = 0;
  private cotizacionesMap = new Map<string, number>();

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  cambiarSerie(serie: 'todas' | 'saldos' | 'deudas') {
    if (this.serieActiva() === serie) return;
    this.serieActiva.set(serie);
    this.actualizarGrafico();
  }

  cambiarMoneda(moneda: 'ARS' | 'USD') {
    if (this.monedaActiva() === moneda) return;
    this.monedaActiva.set(moneda);
    this.actualizarGrafico();
  }

  @Input() isCargando = false;

  isBrowser = false;
  chartPlugins: any[] = [yearBackgroundPlugin];

  @Input() set datosHistoricosEstimativos(value: EstimativoRow[]) {
    if (value && value.length > 0) {
      this.datosActuales = value;
      this.actualizarGrafico();
    }
  }

  ngOnInit(): void {
    void this.cargarCotizacionesHistoricas();
  }

  private async cargarCotizacionesHistoricas(): Promise<void> {
    try {
      const lista = await this.dolarService.obtenerTodasCotizaciones();
      if (Array.isArray(lista) && lista.length > 0) {
        let ultima = 0;
        for (const item of lista) {
          const val = Number(item?.venta || item?.compra || 0);
          if (item?.fecha && val > 0) {
            this.cotizacionesMap.set(item.fecha, val);
            ultima = val;
          }
        }
        if (ultima > 0) {
          this.dolarFallback = ultima;
        }
      }

      if (this.dolarFallback <= 0) {
        const hoy = new Date();
        const isoHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const cot = await this.dolarService.obtenerDolar(isoHoy);
        if (cot > 0) this.dolarFallback = cot;
      }

      if (this.monedaActiva() === 'USD' && this.datosActuales.length > 0) {
        this.actualizarGrafico();
      }
    } catch {
      // Silencioso: usa última tasa disponible
    }
  }

  private fechaEsARaISO(fechaStr: string): string {
    const partes = (fechaStr || '').split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
    return '';
  }

  private obtenerTasaFecha(fechaStr: string, ultimaTasaConocida: number): number {
    const iso = this.fechaEsARaISO(fechaStr);
    if (iso && this.cotizacionesMap.size > 0) {
      const directa = this.cotizacionesMap.get(iso);
      if (directa && directa > 0) return directa;

      const base = new Date(`${iso}T12:00:00`);
      if (!isNaN(base.getTime())) {
        for (let offset = 1; offset <= 15; offset++) {
          const d = new Date(base);
          d.setDate(base.getDate() - offset);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const val = this.cotizacionesMap.get(key);
          if (val && val > 0) return val;
        }
      }
    }

    if (ultimaTasaConocida > 0) return ultimaTasaConocida;
    return this.dolarFallback > 0 ? this.dolarFallback : 1;
  }

  private actualizarGrafico(): void {
    const value = this.datosActuales;
    if (!value || value.length === 0) return;

    const esUSD = this.monedaActiva() === 'USD';
    const serie = this.serieActiva();
    const hoy = new Date();
    const formatoHoy = `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
    const labels = value.map((v) => v.fecha);

    // Precalcular tasa USD por fila usando el historial oficial de cotizaciones (evita distorsiones por redondeo cuando saldoPesos es bajo)
    let ultimaTasa = this.dolarFallback;
    if (ultimaTasa <= 0) {
      for (let i = value.length - 1; i >= 0; i--) {
        const r = value[i];
        if (r.saldoUSD && Math.abs(r.saldoUSD) >= 10 && Math.abs(r.saldoPesos) >= 1000) {
          ultimaTasa = Math.abs(r.saldoPesos / r.saldoUSD);
          break;
        }
      }
    }

    const tasas: number[] = [];
    let tasaCorriente = ultimaTasa;
    for (const r of value) {
      const t = this.obtenerTasaFecha(r.fecha, tasaCorriente);
      if (t > 1) {
        tasaCorriente = t;
      }
      tasas.push(t);
    }

    const convertir = (monto: number | null | undefined, idx: number): number | null => {
      if (monto === null || monto === undefined) return null;
      if (!esUSD) return Number(monto);
      const t = tasas[idx] || 1;
      return Number((Number(monto) / t).toFixed(2));
    };

    const dataReal = value.map((v, i) => convertir(v.real, i));
    const dataEstimado = value.map((v, i) => convertir(v.saldoPesos, i) ?? 0);
    const dataDeudaReal = value.map((v, i) => convertir(v.deudaReal, i) ?? 0);
    const dataDeuda = value.map((v, i) => convertir(v.deuda, i) ?? 0);

    const datasets: any[] = [];

    if (serie === 'todas' || serie === 'saldos') {
      const isSoloSaldos = serie === 'saldos';
      datasets.push(
        {
          label: 'Saldo Real',
          data: dataReal,
          borderColor: '#2196f3',
          backgroundColor: isSoloSaldos ? 'rgba(33, 150, 243, 0.12)' : 'transparent',
          fill: isSoloSaldos,
          tension: 0.35,
          borderWidth: 2.4,
          spanGaps: true,
          pointBackgroundColor: value.map((v) => (v.fecha === formatoHoy ? '#10b981' : '#2196f3')),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.2,
          pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
          pointHoverRadius: 6,
        },
        {
          label: 'Tendencia',
          data: calcularTendencia(dataReal),
          borderColor: '#7bb5f8ff',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: esUSD ? 'Saldo Estimado US$' : 'Saldo Estimado $',
          data: dataEstimado,
          borderColor: '#ab01d5ff',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          spanGaps: true,
          pointBackgroundColor: '#ab01d5ff',
          pointBorderColor: '#ffffff',
          pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
          pointHoverRadius: 6,
        },
      );
    }

    if (serie === 'todas' || serie === 'deudas') {
      const isSoloDeudas = serie === 'deudas';
      datasets.push(
        {
          label: 'Deuda Real',
          data: dataDeudaReal,
          borderColor: '#ef4444',
          backgroundColor: isSoloDeudas ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
          fill: isSoloDeudas,
          tension: 0.35,
          borderWidth: 2.4,
          spanGaps: true,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
          pointHoverRadius: 6,
        },
        {
          label: 'TendenciaDeuda',
          data: calcularTendencia(dataDeudaReal),
          borderColor: '#fca5a5',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Deuda Estimada',
          data: dataDeuda,
          borderColor: '#f97316',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          spanGaps: true,
          pointBackgroundColor: '#f97316',
          pointBorderColor: '#ffffff',
          pointRadius: value.map((v) => (v.fecha === formatoHoy ? 5 : 0)),
          pointHoverRadius: 6,
        },
      );
    }

    this.chartOptions = {
      ...this.chartOptions,
      plugins: {
        ...this.chartOptions?.plugins,
        tooltip: {
          ...this.chartOptions?.plugins?.tooltip,
          callbacks: {
            label: (context) => {
              const raw = context.parsed.y;
              if (raw === null || raw === undefined) return '';
              const dsLabel = context.dataset.label || '';
              const prefix = esUSD ? 'US$ ' : '$ ';
              return ` ${dsLabel}: ${prefix}${raw.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            },
          },
        },
      },
      scales: {
        ...this.chartOptions?.scales,
        y: {
          ...this.chartOptions?.scales?.['y'],
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: (val) => {
              const num = Number(val);
              const prefix = esUSD ? 'US$ ' : '';
              if (Math.abs(num) >= 1000000) return `${prefix}${(num / 1000000).toFixed(1)}M`;
              if (Math.abs(num) >= 1000) return `${prefix}${(num / 1000).toFixed(1)}k`;
              return `${prefix}${num.toLocaleString('es-AR')}`;
            },
          },
        },
      },
    };

    this.chartData = {
      labels,
      datasets,
    };

    this.cdr.detectChanges();
    this.chart?.update();
  }

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
    layout: {
      padding: {
        bottom: 15,
        top: 6,
      },
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
          filter: (legendItem: unknown) => {
            const li = legendItem as { text?: string };
            return (li.text ?? '') !== 'Tendencia' && (li.text ?? '') !== 'TendenciaDeuda';
          },
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
            return ` ${dsLabel}: $ ${raw.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    animation: false,
    transitions: {
      active: {
        animation: {
          duration: 0,
        },
      },
    },
  };
}
