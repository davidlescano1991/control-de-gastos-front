import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
  ChangeDetectorRef,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { SelectorAnioDelorean } from '../../common/selector-anio-delorean/selector-anio-delorean';
import { AuthService } from '../../services/auth.service';
import { AppConfigService } from '../../services/app-config.service';
import { WakeLockService } from '../../services/wake-lock.service';
import {
  ReportesService,
  ReporteSaldoAnualResponse,
  SaldoPunto,
  CorteBimonetario,
  ReporteCortesBimonetariosResponse,
} from '../../services/reportes.service';
import { calcularTendencia, getGridColor, getLineWidth } from '../../utils/grafico.utils';

export interface ReporteSubmenu {
  id: 'saldo' | 'bimonetario' | 'anual' | 'dinamico';
  titulo: string;
  subtitulo: string;
  icono: string;
  badge: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    SelectorAnioDelorean,
  ],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
})
export class ReportesComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private appConfig = inject(AppConfigService);
  private reportesService = inject(ReportesService);
  private wakeLockService = inject(WakeLockService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public isBrowser = false;

  // Listado de años configurados
  public aniosDisponibles = signal<number[]>([2026, 2025, 2024, 2023, 2022]);
  public anioSeleccionado = signal<number>(2026);

  // Submenú activo
  public tabActiva = signal<'saldo' | 'bimonetario' | 'anual' | 'dinamico'>('saldo');

  // Estado del reporte de saldo
  public isLoadingSaldo = signal<boolean>(false);
  public reporteSaldo = signal<ReporteSaldoAnualResponse | null>(null);

  // Estado del reporte de cortes bimonetarios (Saldo!K47:R60)
  public isLoadingCortes = signal<boolean>(false);
  public reporteCortes = signal<ReporteCortesBimonetariosResponse | null>(null);
  public serieBimonetariaActiva = signal<'totalUSD' | 'saldoDeuda' | 'variaciones' | 'integral'>('totalUSD');

  // Filtros interactivos de la vista de Saldo
  public serieActiva = signal<'pesos' | 'usd' | 'deuda' | 'comparativa'>('pesos');
  public mesFiltro = signal<string>('TODOS');

  // Definición de pestañas / submenús
  public readonly submenus: ReporteSubmenu[] = [
    {
      id: 'saldo',
      titulo: 'Evolución de Saldo',
      subtitulo: 'Curvas de saldo en el tiempo (Saldo [Año])',
      icono: 'show_chart',
      badge: 'Saldo',
    },
    {
      id: 'bimonetario',
      titulo: 'Cortes Bimonetarios',
      subtitulo: 'Comparativa $ vs U$ y variaciones (Saldo!K47:R60)',
      icono: 'currency_exchange',
      badge: 'Bimonetario',
    },
    {
      id: 'anual',
      titulo: 'Análisis Anual',
      subtitulo: 'Saldos, gastos condicionales rojo/azul y préstamos',
      icono: 'insights',
      badge: 'Macro',
    },
    {
      id: 'dinamico',
      titulo: 'Consultas y Reportes',
      subtitulo: 'Explorador multicriterio con gráficos dinámicos',
      icono: 'manage_search',
      badge: 'Admin',
      adminOnly: true,
    },
  ];

  // Submenús visibles según rol
  public submenusVisibles = computed(() => {
    const esAdmin = this.authService.isAdmin();
    return this.submenus.filter((s) => !s.adminOnly || esAdmin);
  });

  // Puntos filtrados según el mes seleccionado
  public puntosFiltrados = computed<SaldoPunto[]>(() => {
    const rep = this.reporteSaldo();
    if (!rep || !rep.puntos) return [];
    const mes = this.mesFiltro();
    if (mes === 'TODOS') return rep.puntos;

    if (mes.toLowerCase() === 'mes actual') {
      return rep.puntos.filter(
        (p) =>
          p.mes.toLowerCase() === 'mes actual' ||
          (p.fechaISO && p.fechaISO.startsWith('2026-10'))
      );
    }

    if (mes.toLowerCase() === 'octubre') {
      return rep.puntos.filter(
        (p) =>
          p.mes.toLowerCase() === 'octubre' &&
          (!p.fechaISO || !p.fechaISO.startsWith('2026-10'))
      );
    }

    return rep.puntos.filter(
      (p) => p.mes.toLowerCase() === mes.toLowerCase()
    );
  });

  // Métricas dinámicas recalculadas sobre los puntos filtrados con fechas exactas
  public metricsFiltradas = computed(() => {
    const puntos = this.puntosFiltrados();
    if (puntos.length === 0) {
      return {
        ultimoSaldoPesos: 0,
        ultimoSaldoUSD: 0,
        ultimaDeuda: 0,
        saldoMaxPesos: 0,
        fechaMaxPesos: '',
        saldoMinPesos: 0,
        fechaMinPesos: '',
        saldoMaxUSD: 0,
        fechaMaxUSD: '',
        saldoMinUSD: 0,
        fechaMinUSD: '',
        promedioSaldoPesos: 0,
        totalPuntos: 0,
        variacionPeriodoPesos: 0,
        fechaUltimo: '',
        fechaPrimero: '',
      };
    }

    const ultimo = puntos[puntos.length - 1];
    const primero = puntos[0];

    let puntoMaxPesos = puntos[0];
    let puntoMinPesos = puntos[0];
    let puntoMaxUSD = puntos[0];
    let puntoMinUSD = puntos[0];
    let sumPesos = 0;

    for (const p of puntos) {
      sumPesos += p.saldoPesos;
      if (p.saldoPesos > puntoMaxPesos.saldoPesos) puntoMaxPesos = p;
      if (p.saldoPesos < puntoMinPesos.saldoPesos) puntoMinPesos = p;
      if (p.saldoUSD > puntoMaxUSD.saldoUSD) puntoMaxUSD = p;
      if (p.saldoUSD < puntoMinUSD.saldoUSD) puntoMinUSD = p;
    }

    return {
      ultimoSaldoPesos: ultimo.saldoPesos,
      ultimoSaldoUSD: ultimo.saldoUSD,
      ultimaDeuda: ultimo.deuda,
      saldoMaxPesos: puntoMaxPesos.saldoPesos,
      fechaMaxPesos: puntoMaxPesos.fecha,
      saldoMinPesos: puntoMinPesos.saldoPesos,
      fechaMinPesos: puntoMinPesos.fecha,
      saldoMaxUSD: puntoMaxUSD.saldoUSD,
      fechaMaxUSD: puntoMaxUSD.fecha,
      saldoMinUSD: puntoMinUSD.saldoUSD,
      fechaMinUSD: puntoMinUSD.fecha,
      promedioSaldoPesos: sumPesos / puntos.length,
      totalPuntos: puntos.length,
      variacionPeriodoPesos: ultimo.saldoPesos - primero.saldoPesos,
      fechaUltimo: ultimo.fecha,
      fechaPrimero: primero.fecha,
    };
  });

  // Configuración de Chart.js
  public chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
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
          font: {
            size: 12,
            weight: 'bold',
            family: 'Inter, system-ui, -apple-system, sans-serif',
          },
          color: '#475569',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#90caf9',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            const val = context.parsed.y;
            if (val === null || val === undefined) return label + 'N/A';
            if (label.includes('USD') || label.includes('Dólar')) {
              return `${label}U$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            return `${label}$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          maxRotation: 45,
          minRotation: 0,
          font: { size: 11 },
          color: '#64748b',
        },
      },
      y: {
        beginAtZero: true,
        suggestedMin: 0,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) {
              return (num / 1000000).toFixed(1) + 'M';
            }
            if (Math.abs(num) >= 1000) {
              return (num / 1000).toFixed(0) + 'k';
            }
            return num.toLocaleString('es-AR');
          },
        },
      },
    },
  };

  // Configuración de Chart.js para Cortes Bimonetarios
  public chartDataBimonetario: ChartConfiguration<'line' | 'bar'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptionsBimonetario: ChartConfiguration<'line' | 'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
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
          font: {
            size: 12,
            weight: 'bold',
            family: 'Inter, system-ui, -apple-system, sans-serif',
          },
          color: '#475569',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#90caf9',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            const val = context.parsed.y;
            if (val === null || val === undefined) return label + 'N/A';
            if (label.includes('USD') || label.includes('U$') || label.includes('Dólar')) {
              return `${label}U$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            return `${label}$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          maxRotation: 45,
          minRotation: 0,
          font: { size: 11 },
          color: '#64748b',
        },
      },
      y: {
        beginAtZero: true,
        suggestedMin: 0,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) {
              return (num / 1000000).toFixed(1) + 'M';
            }
            if (Math.abs(num) >= 1000) {
              return (num / 1000).toFixed(0) + 'k';
            }
            return num.toLocaleString('es-AR');
          },
        },
      },
    },
  };

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.wakeLockService.requestWakeLock();
    }

    const aniosAnual = this.appConfig.yearsAnual;
    if (aniosAnual && aniosAnual.length > 0) {
      this.aniosDisponibles.set(aniosAnual);
      if (aniosAnual.includes(2026)) {
        this.anioSeleccionado.set(2026);
      } else {
        this.anioSeleccionado.set(aniosAnual[0]);
      }
    }

    if (this.isBrowser) {
      this.cargarReporteSaldo();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      void this.wakeLockService.releaseWakeLock();
    }
  }

  public seleccionarAnio(index: number): void {
    const anios = this.aniosDisponibles();
    if (index >= 0 && index < anios.length) {
      const nuevoAnio = anios[index];
      if (nuevoAnio !== this.anioSeleccionado()) {
        this.anioSeleccionado.set(nuevoAnio);
        this.mesFiltro.set('TODOS');
        this.reporteSaldo.set(null);
        this.reporteCortes.set(null);
        if (this.tabActiva() === 'saldo') {
          this.cargarReporteSaldo();
        } else if (this.tabActiva() === 'bimonetario') {
          this.cargarReporteCortes();
        }
      }
    }
  }

  public cambiarTab(id: 'saldo' | 'bimonetario' | 'anual' | 'dinamico'): void {
    this.tabActiva.set(id);
    if (id === 'saldo' && !this.reporteSaldo()) {
      this.cargarReporteSaldo();
    } else if (id === 'bimonetario' && !this.reporteCortes()) {
      this.cargarReporteCortes();
    }
  }

  public cambiarSerie(serie: 'pesos' | 'usd' | 'deuda' | 'comparativa'): void {
    this.serieActiva.set(serie);
    this.actualizarGrafico();
  }

  public filtrarPorMes(mes: string): void {
    this.mesFiltro.set(mes);
    this.actualizarGrafico();
  }

  public cargarReporteSaldo(force = false): void {
    const anio = this.anioSeleccionado();
    this.isLoadingSaldo.set(true);

    this.reportesService.getSaldoAnual(anio, force).subscribe({
      next: (data) => {
        this.reporteSaldo.set(data);
        this.isLoadingSaldo.set(false);
        this.actualizarGrafico();
      },
      error: (err) => {
        console.error(`[ReportesComponent] Error al cargar saldo anual para ${anio}:`, err);
        this.isLoadingSaldo.set(false);
      },
    });
  }

  public actualizarGrafico(): void {
    if (!this.isBrowser) return;

    const puntos = this.puntosFiltrados();
    if (!puntos || puntos.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      this.cdr.detectChanges();
      this.chart?.update();
      return;
    }

    const labels = puntos.map((p) => p.fecha);
    const serie = this.serieActiva();

    if (serie === 'pesos') {
      const data = puntos.map((p) => p.saldoPesos);
      const tendencia = calcularTendencia(data);
      const pointColors = data.map((v) => (v >= 0 ? '#706cd6' : '#ef4444'));

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo en Pesos ($)',
            data,
            borderColor: '#706cd6',
            backgroundColor: 'rgba(112, 108, 214, 0.12)',
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: data.length > 60 ? 2 : 4,
            pointHoverRadius: 6,
            borderWidth: 2.2,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Tendencia ($)',
            data: tendencia,
            borderColor: '#94a3b8',
            borderDash: [4, 4],
            pointRadius: 0,
            borderWidth: 1.8,
            fill: false,
          },
        ],
      };
    } else if (serie === 'usd') {
      const data = puntos.map((p) => p.saldoUSD);
      const tendencia = calcularTendencia(data);

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo en Dólares (USD)',
            data,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.08)',
            pointBackgroundColor: '#059669',
            pointBorderColor: '#059669',
            pointRadius: data.length > 60 ? 2 : 4,
            pointHoverRadius: 6,
            borderWidth: 2.2,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Tendencia (USD)',
            data: tendencia,
            borderColor: '#94a3b8',
            borderDash: [4, 4],
            pointRadius: 0,
            borderWidth: 1.8,
            fill: false,
          },
        ],
      };
    } else if (serie === 'deuda') {
      const data = puntos.map((p) => p.deuda);
      const tendencia = calcularTendencia(data);

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Deuda Registrada ($)',
            data,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#dc2626',
            pointRadius: data.length > 60 ? 2 : 4,
            pointHoverRadius: 6,
            borderWidth: 2.2,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Tendencia Deuda',
            data: tendencia,
            borderColor: '#f87171',
            borderDash: [4, 4],
            pointRadius: 0,
            borderWidth: 1.8,
            fill: false,
          },
        ],
      };
    } else if (serie === 'comparativa') {
      const dataSaldo = puntos.map((p) => p.saldoPesos);
      const dataDeuda = puntos.map((p) => p.deuda);

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo en Pesos ($)',
            data: dataSaldo,
            borderColor: '#706cd6',
            backgroundColor: 'rgba(112, 108, 214, 0.08)',
            pointBackgroundColor: '#706cd6',
            pointBorderColor: '#706cd6',
            pointRadius: dataSaldo.length > 60 ? 2 : 3,
            borderWidth: 2,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Deuda ($)',
            data: dataDeuda,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.05)',
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#dc2626',
            pointRadius: dataDeuda.length > 60 ? 2 : 3,
            borderWidth: 2,
            tension: 0.25,
            fill: false,
          },
        ],
      };
    }

    this.cdr.detectChanges();
    this.chart?.update();
  }

  public formatearMoneda(val: number | null | undefined, moneda: 'ARS' | 'USD' = 'ARS'): string {
    if (val === null || val === undefined) return '$ 0,00';
    const num = Number(val);
    const prefix = moneda === 'USD' ? 'U$ ' : '$ ';
    return `${prefix}${num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  public cargarReporteCortes(force = false): void {
    const anio = this.anioSeleccionado();
    this.isLoadingCortes.set(true);

    this.reportesService.getCortesBimonetarios(anio, force).subscribe({
      next: (data) => {
        this.reporteCortes.set(data);
        this.isLoadingCortes.set(false);
        this.actualizarGraficoBimonetario();
      },
      error: (err) => {
        console.error(`[ReportesComponent] Error al cargar cortes bimonetarios para ${anio}:`, err);
        this.isLoadingCortes.set(false);
      },
    });
  }

  public cambiarSerieBimonetaria(serie: 'totalUSD' | 'saldoDeuda' | 'variaciones' | 'integral'): void {
    this.serieBimonetariaActiva.set(serie);
    this.actualizarGraficoBimonetario();
  }

  public actualizarGraficoBimonetario(): void {
    if (!this.isBrowser) return;

    const rep = this.reporteCortes();
    if (!rep || !rep.cortes || rep.cortes.length === 0) {
      this.chartDataBimonetario = { labels: [], datasets: [] };
      this.cdr.detectChanges();
      this.chart?.update();
      return;
    }

    const cortes = rep.cortes;
    const labels = cortes.map((c) => c.fecha);
    const serie = this.serieBimonetariaActiva();

    if (serie === 'totalUSD') {
      const data = cortes.map((c) => c.totalSaldoUSD);
      const tendencia = calcularTendencia(data);
      const pointColors = data.map((v) => (v >= 0 ? '#059669' : '#ef4444'));

      this.chartDataBimonetario = {
        labels,
        datasets: [
          {
            label: 'Total Saldo U$S',
            data,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.09)',
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.4,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Tendencia U$S',
            data: tendencia,
            borderColor: '#94a3b8',
            borderDash: [4, 4],
            pointRadius: 0,
            borderWidth: 1.8,
            fill: false,
          },
        ],
      };
    } else if (serie === 'saldoDeuda') {
      const dataSaldo = cortes.map((c) => c.saldoPesos);
      const dataDeuda = cortes.map((c) => c.deuda);

      this.chartDataBimonetario = {
        labels,
        datasets: [
          {
            label: 'Saldo en Pesos ($)',
            data: dataSaldo,
            borderColor: '#706cd6',
            backgroundColor: 'rgba(112, 108, 214, 0.10)',
            pointBackgroundColor: '#706cd6',
            pointBorderColor: '#706cd6',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.2,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Deuda ($)',
            data: dataDeuda,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.06)',
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#dc2626',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.2,
            tension: 0.25,
            fill: false,
          },
        ],
      };
    } else if (serie === 'variaciones') {
      const dataVarUSD = cortes.map((c) => c.variacionUSD);
      const bgColors = dataVarUSD.map((v) => (v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)'));
      const borderColors = dataVarUSD.map((v) => (v >= 0 ? '#059669' : '#dc2626'));

      this.chartDataBimonetario = {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Variación en U$S',
            data: dataVarUSD,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      };
    } else if (serie === 'integral') {
      const dataUSD = cortes.map((c) => c.totalSaldoUSD);
      const dataPesos = cortes.map((c) => c.saldoPesos);
      const dataDeuda = cortes.map((c) => c.deuda);

      this.chartDataBimonetario = {
        labels,
        datasets: [
          {
            label: 'Total Saldo (U$S)',
            data: dataUSD,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            pointBackgroundColor: '#059669',
            pointBorderColor: '#059669',
            pointRadius: 4,
            borderWidth: 2.4,
            tension: 0.25,
            fill: false,
          },
          {
            label: 'Saldo ($ / 1000)',
            data: dataPesos.map((v) => Number((v / 1000).toFixed(1))),
            borderColor: '#706cd6',
            pointBackgroundColor: '#706cd6',
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.25,
            fill: false,
          },
          {
            label: 'Deuda ($ / 1000)',
            data: dataDeuda.map((v) => Number((v / 1000).toFixed(1))),
            borderColor: '#dc2626',
            pointBackgroundColor: '#dc2626',
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.25,
            fill: false,
          },
        ],
      };
    }

    this.cdr.detectChanges();
    this.chart?.update();
  }
}
