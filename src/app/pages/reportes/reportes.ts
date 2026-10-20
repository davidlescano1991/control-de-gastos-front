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
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Plugin } from 'chart.js';
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
  ReporteAnalisisAnualResponse,
  MesSaldoItem,
  MesGastoItem,
  MesPrestamoItem,
  FiltrosExplorador,
  ExploradorRegistro,
  ExploradorResponse,
  ExploradorResumen,
  ExploradorDistribucion,
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

/**
 * Plugin de Chart.js para dibujar etiquetas numéricas de moneda ($X.XXX.XXX,XX)
 * arriba de los puntos de la serie, idéntico al diseño de Google Sheets.
 */
export const googleSheetsDataLabelsPlugin: Plugin = {
  id: 'googleSheetsDataLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset: any, i) => {
      if (!dataset.showDataLabels) return;
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;

      ctx.save();
      ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = dataset.dataLabelColor || '#2563eb';

      meta.data.forEach((point, index) => {
        const val = dataset.data[index];
        if (val === null || val === undefined) return;
        const num = Number(val);
        const formatted =
          '$' +
          num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

        const offset = dataset.dataLabelOffset || -8;
        ctx.fillText(formatted, point.x, point.y + offset);
      });
      ctx.restore();
    });
  },
};

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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


  // Estado del reporte de Análisis Anual Reorganizado (Submenú 3)
  public isLoadingAnalisis = signal<boolean>(false);
  public reporteAnalisis = signal<ReporteAnalisisAnualResponse | null>(null);
  public subTabAnalisis = signal<'todos' | 'saldo' | 'gastos' | 'prestamos'>('todos');
  public mesProximoAPagarNombre = signal<string>('');
  public gastosPlugins = [googleSheetsDataLabelsPlugin];

  // =========================================================================
  // SUBMENÚ 4: EXPLORADOR ANALÍTICO DINÁMICO MULTICRITERIO (Fase 6.18)
  // =========================================================================
  public isLoadingExplorador = signal<boolean>(false);
  public datosExplorador = signal<ExploradorResponse | null>(null);

  // Filtros interactivos
  public tablaExplorador = signal<'movimientos' | 'pagos_entidades' | 'items_mensuales' | 'prestamos' | 'estimativos'>('movimientos');
  public filtroAnio = signal<string>('TODOS');
  public filtroDesde = signal<string>('');
  public filtroHasta = signal<string>('');
  public filtroEntidades = signal<string[]>([]);
  public filtroTipo = signal<string>('TODOS');
  public filtroEstado = signal<string>('TODOS');
  public filtroConcepto = signal<string>('');
  public filtroMontoMin = signal<number | null>(null);
  public filtroMontoMax = signal<number | null>(null);
  public paginaActual = signal<number>(1);
  public limitePorPagina = signal<number>(25);

  // Visualización del gráfico
  public tipoGraficoExplorador = signal<'entidad' | 'temporal' | 'estados'>('entidad');
  public chartTypeExplorador = signal<'bar' | 'doughnut' | 'line'>('bar');

  public readonly entidadesDisponibles: string[] = [
    'Visa Galicia',
    'Master Card Galicia',
    'Naranja X',
    'Naranja',
    'Bancor',
    'Mercado Libre',
    'Santander',
    'Galicia',
    'Efectivo',
    'Otros',
  ];

  public chartDataExplorador: ChartConfiguration<'bar' | 'doughnut' | 'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptionsExplorador: ChartConfiguration<'bar' | 'doughnut' | 'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          font: { size: 12, weight: 'bold', family: 'Inter, system-ui, sans-serif' },
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
          label: (ctx) => {
            const val = ctx.raw as number;
            return ` Total: $${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: 'bold' } },
      },
      y: {
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
        ticks: {
          color: '#64748b',
          callback: (val) => `$${Number(val).toLocaleString('es-AR')}`,
        },
      },
    },
  };

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


  // Configuración de Chart.js para Análisis Anual - Saldo
  public chartDataAnalisisSaldo: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptionsAnalisisSaldo: ChartConfiguration<'line'>['options'] = {
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
          font: { size: 12, weight: 'bold' },
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
            const val = context.parsed.y;
            if (val === null || val === undefined) return ' Saldo Anual: N/A';
            return ` Saldo Anual: $ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: (ctx) => getGridColor(ctx) },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: (ctx) => getGridColor(ctx), lineWidth: (ctx) => getLineWidth(ctx) },
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

  // Configuración de Chart.js para Análisis Anual - Gastos (Estilo Google Sheets)
  public chartDataAnalisisGastos: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptionsAnalisisGastos: ChartConfiguration<'line'>['options'] = {
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
          font: { size: 12, weight: 'bold' },
          color: '#475569',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#fca5a5',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const idx = context.dataIndex;
            const val = context.parsed.y;
            if (val === null || val === undefined) return ' N/A';
            const rep = this.reporteAnalisis();
            const g = rep?.gastos?.[idx];
            let extra = '';
            if (g && idx > 0) {
              const sign = g.variacion > 0 ? '+' : '';
              extra = ` (${sign}$ ${g.variacion.toLocaleString('es-AR')} | ${sign}${g.porcentajeVariacion}%)`;
            }
            return ` Gasto: $ ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${extra}`;
          },
          afterLabel: (context) => {
            const idx = context.dataIndex;
            const rep = this.reporteAnalisis();
            const g = rep?.gastos?.[idx];
            if (!g || idx === 0) return '';
            return g.aumento ? ' ⚠️ Aumento de gasto vs mes previo' : ' 📉 Gasto en descenso / contenido';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: (ctx) => getGridColor(ctx) },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: false,
        grid: { color: (ctx) => getGridColor(ctx), lineWidth: (ctx) => getLineWidth(ctx) },
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

  public chartDataAnalisisPrestamos: ChartConfiguration<'bar' | 'line'>['data'] = {
    labels: [],
    datasets: [],
  };

  public chartOptionsAnalisisPrestamos: ChartConfiguration<'bar' | 'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        titleColor: '#c084fc',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const idx = context.dataIndex;
            const rep = this.reporteAnalisis();
            if (!rep || !rep.prestamos[idx]) return `$ ${context.raw}`;
            const p = rep.prestamos[idx];
            const mesProximoObj = rep.prestamos.find(
              (item: MesPrestamoItem) => item.cuotasDetalle && item.cuotasDetalle.some((c: any) => !c.pagada)
            );
            const esProximo = mesProximoObj ? p.numeroMes === mesProximoObj.numeroMes : false;
            const prevTotal = idx > 0 ? rep.prestamos[idx - 1].totalCuotas : 0;
            const aumento = idx > 0 && p.totalCuotas > prevTotal;
            const diff = idx > 0 ? p.totalCuotas - prevTotal : 0;

            let estadoTexto = '';
            if (esProximo) {
              estadoTexto = ' • 🔵 PRÓXIMO MES A PAGAR';
            } else if (aumento) {
              estadoTexto = ` • 🔴 Aumento (+$ ${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })} vs mes previo)`;
            }

            return ` Cuotas a pagar: $ ${Number(context.raw).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${p.cantidadCuotas} cuotas)${estadoTexto}`;
          },
          afterBody: (context) => {
            const idx = context[0]?.dataIndex;
            const rep = this.reporteAnalisis();
            if (!rep || !rep.prestamos[idx]) return [];
            const p = rep.prestamos[idx];
            if (!p.cuotasDetalle || p.cuotasDetalle.length === 0) return [' (Sin cuotas este mes)'];
            return p.cuotasDetalle.slice(0, 8).map(
              (c: any) => ` • ${c.prestamoNombre} (${c.entidad}): $ ${c.monto.toLocaleString('es-AR')} [${c.pagada ? 'PAGADA' : 'PENDIENTE'}]`
            );
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: (ctx) => getGridColor(ctx) },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: (ctx) => getGridColor(ctx), lineWidth: (ctx) => getLineWidth(ctx) },
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
        this.reporteAnalisis.set(null);
        if (this.tabActiva() === 'saldo') {
          this.cargarReporteSaldo();
        } else if (this.tabActiva() === 'bimonetario') {
          this.cargarReporteCortes();
        } else if (this.tabActiva() === 'anual') {
          this.cargarReporteAnalisis();
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
    } else if (id === 'anual' && !this.reporteAnalisis()) {
      this.cargarReporteAnalisis();
    } else if (id === 'dinamico' && !this.datosExplorador()) {
      this.cargarExplorador();
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


  public cambiarSubTabAnalisis(tab: 'todos' | 'saldo' | 'gastos' | 'prestamos'): void {
    this.subTabAnalisis.set(tab);
    setTimeout(() => {
      this.cdr.detectChanges();
      this.chart?.update();
    }, 50);
  }

  public cargarReporteAnalisis(force = false): void {
    const anio = this.anioSeleccionado();
    this.isLoadingAnalisis.set(true);

    this.reportesService.getAnalisisAnual(anio, force).subscribe({
      next: (data) => {
        this.isLoadingAnalisis.set(false);
        if (data) {
          this.reporteAnalisis.set(data);
          this.actualizarGraficosAnalisis();
        } else {
          this.reporteAnalisis.set(null);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar reporte de análisis anual:', err);
        this.isLoadingAnalisis.set(false);
        this.reporteAnalisis.set(null);
        this.cdr.detectChanges();
      },
    });
  }

  private actualizarGraficosAnalisis(): void {
    const rep = this.reporteAnalisis();
    if (!rep) return;

    const labels = rep.saldos.map((s: MesSaldoItem) => s.mes);

    // 1. Gráfico de Saldo Anual
    const saldosData = rep.saldos.map((s: MesSaldoItem) => s.saldo);
    const tendenciaSaldo = calcularTendencia(saldosData);
    const pointColorsSaldo = saldosData.map((v: number) => (v >= 0 ? '#10b981' : '#ef4444'));

    this.chartDataAnalisisSaldo = {
      labels,
      datasets: [
        {
          label: 'Saldo Anual ($)',
          data: saldosData,
          borderColor: '#706cd6',
          backgroundColor: 'rgba(112, 108, 214, 0.12)',
          pointBackgroundColor: pointColorsSaldo,
          pointBorderColor: pointColorsSaldo,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.2,
          tension: 0.25,
          fill: true,
        },
        {
          label: 'Tendencia ($)',
          data: tendenciaSaldo,
          borderColor: '#94a3b8',
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.8,
          fill: false,
        },
      ],
    };

    // 2. Gráfico de Gastos Anuales (Similar a Saldo Anual, en Rojo y sin Nafta)
    const gastosData = rep.gastos.map((g: MesGastoItem) => g.total);
    const tendenciaGastos = calcularTendencia(gastosData);

    this.chartDataAnalisisGastos = {
      labels,
      datasets: [
        {
          label: 'Gastos Mensuales ($)',
          data: gastosData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 5,
          pointHoverRadius: 7.5,
          borderWidth: 2.2,
          tension: 0.25,
          fill: true,
        },
        {
          label: 'Tendencia ($)',
          data: tendenciaGastos,
          borderColor: '#94a3b8',
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.8,
          fill: false,
        },
      ],
    };

    // 3. Gráfico de Préstamos Mensuales con lógica reactiva de coloración:
    // - Azul: Mes próximo a pagar (primer mes con cuotas pendientes)
    // - Rojo: Meses donde la cantidad aumentó con respecto al mes anterior
    // - Violeta: Meses normales, en descenso o ya abonados
    const tienePrestamos = rep.prestamos && rep.prestamos.some((p: MesPrestamoItem) => p.totalCuotas > 0);
    const mesProximoObj = rep.prestamos.find(
      (p: MesPrestamoItem) => p.cuotasDetalle && p.cuotasDetalle.some((c: any) => !c.pagada)
    );
    const mesProximoNum = mesProximoObj ? mesProximoObj.numeroMes : null;
    this.mesProximoAPagarNombre.set(
      mesProximoObj ? mesProximoObj.mes : (tienePrestamos ? 'Completado' : 'Sin préstamos')
    );

    const prestamosData = rep.prestamos.map((p: MesPrestamoItem) => p.totalCuotas);
    const tendenciaPrestamos = calcularTendencia(prestamosData);

    const bgColorsPrestamos = rep.prestamos.map((p: MesPrestamoItem, idx: number) => {
      if (p.numeroMes === mesProximoNum) {
        return 'rgba(59, 130, 246, 0.88)'; // Azul: Próximo mes a pagar
      }
      const prevTotal = idx > 0 ? rep.prestamos[idx - 1].totalCuotas : 0;
      if (idx > 0 && p.totalCuotas > prevTotal) {
        return 'rgba(239, 68, 68, 0.88)'; // Rojo: Aumento respecto al mes previo
      }
      return 'rgba(139, 92, 246, 0.85)'; // Violeta institucional
    });

    const borderColorsPrestamos = rep.prestamos.map((p: MesPrestamoItem, idx: number) => {
      if (p.numeroMes === mesProximoNum) {
        return '#2563eb';
      }
      const prevTotal = idx > 0 ? rep.prestamos[idx - 1].totalCuotas : 0;
      if (idx > 0 && p.totalCuotas > prevTotal) {
        return '#dc2626';
      }
      return '#7c3aed';
    });

    this.chartDataAnalisisPrestamos = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Cuotas de Préstamos ($)',
          data: prestamosData,
          backgroundColor: bgColorsPrestamos,
          borderColor: borderColorsPrestamos,
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          type: 'line',
          label: 'Tendencia Amortizaciones',
          data: tendenciaPrestamos,
          borderColor: '#a855f7',
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1.8,
          fill: false,
        },
      ],
    };

    this.cdr.detectChanges();
    this.chart?.update();
  }

  // =========================================================================
  // MÉTODOS DEL SUBMENÚ 4: EXPLORADOR ANALÍTICO DINÁMICO MULTICRITERIO
  // =========================================================================

  public cargarExplorador(resetPage = false): void {
    if (resetPage) {
      this.paginaActual.set(1);
    }
    this.isLoadingExplorador.set(true);

    const desde = this.filtroDesde().trim() || undefined;
    const hasta = this.filtroHasta().trim() || undefined;

    // Solo enviamos year si el usuario seleccionó un año específico en filtroAnio o si no hay rango desde/hasta
    let yearParam: number | undefined;
    if (this.filtroAnio() !== 'TODOS') {
      yearParam = Number(this.filtroAnio());
    }

    const filtros: FiltrosExplorador = {
      tabla: this.tablaExplorador(),
      year: yearParam,
      desde,
      hasta,
      entidades: this.filtroEntidades().length > 0 ? this.filtroEntidades() : undefined,
      tipo: this.filtroTipo() !== 'TODOS' ? this.filtroTipo() : undefined,
      estados: this.filtroEstado() !== 'TODOS' ? [this.filtroEstado()] : undefined,
      concepto: this.filtroConcepto().trim() || undefined,
      montoMin: this.filtroMontoMin() !== null ? this.filtroMontoMin()! : undefined,
      montoMax: this.filtroMontoMax() !== null ? this.filtroMontoMax()! : undefined,
      page: this.paginaActual(),
      limit: this.limitePorPagina(),
      sortBy: 'fecha',
      sortOrder: 'desc',
    };

    this.reportesService.getExplorador(filtros).subscribe({
      next: (data) => {
        this.datosExplorador.set(data);
        this.isLoadingExplorador.set(false);
        this.actualizarGraficoExplorador();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[ReportesComponent] Error en cargarExplorador:', err);
        this.isLoadingExplorador.set(false);
      },
    });
  }

  public cambiarFiltroAnio(anioStr: string): void {
    this.filtroAnio.set(anioStr);
    if (anioStr === 'TODOS') {
      this.filtroDesde.set('');
      this.filtroHasta.set('');
    } else {
      this.filtroDesde.set(`${anioStr}-01-01`);
      this.filtroHasta.set(`${anioStr}-12-31`);
    }
    this.cargarExplorador(true);
  }

  public limpiarFiltrosExplorador(): void {
    this.filtroAnio.set('TODOS');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.filtroEntidades.set([]);
    this.filtroTipo.set('TODOS');
    this.filtroEstado.set('TODOS');
    this.filtroConcepto.set('');
    this.filtroMontoMin.set(null);
    this.filtroMontoMax.set(null);
    this.cargarExplorador(true);
  }

  public aplicarPresetFecha(preset: 'mes_actual' | 'mes_anterior' | 'anio_actual' | 'historico'): void {
    const ahora = new Date();
    const y = this.filtroAnio() !== 'TODOS' ? Number(this.filtroAnio()) : this.anioSeleccionado();

    if (preset === 'mes_actual') {
      const m = String(ahora.getMonth() + 1).padStart(2, '0');
      this.filtroDesde.set(`${y}-${m}-01`);
      this.filtroHasta.set(`${y}-${m}-${new Date(y, ahora.getMonth() + 1, 0).getDate()}`);
    } else if (preset === 'mes_anterior') {
      const mesPrevIdx = ahora.getMonth() === 0 ? 11 : ahora.getMonth() - 1;
      const anioPrev = ahora.getMonth() === 0 ? y - 1 : y;
      const m = String(mesPrevIdx + 1).padStart(2, '0');
      this.filtroDesde.set(`${anioPrev}-${m}-01`);
      this.filtroHasta.set(`${anioPrev}-${m}-${new Date(anioPrev, mesPrevIdx + 1, 0).getDate()}`);
    } else if (preset === 'anio_actual') {
      this.filtroDesde.set(`${y}-01-01`);
      this.filtroHasta.set(`${y}-12-31`);
    } else if (preset === 'historico') {
      this.filtroAnio.set('TODOS');
      this.filtroDesde.set('');
      this.filtroHasta.set('');
    }
    this.cargarExplorador(true);
  }

  public cambiarTablaExplorador(t: 'movimientos' | 'pagos_entidades' | 'items_mensuales' | 'prestamos' | 'estimativos'): void {
    this.tablaExplorador.set(t);
    if (t === 'estimativos') {
      this.tipoGraficoExplorador.set('temporal');
      this.chartTypeExplorador.set('line');
    } else {
      this.tipoGraficoExplorador.set('entidad');
      this.chartTypeExplorador.set('bar');
    }
    this.cargarExplorador(true);
  }

  public cambiarTipoGraficoExplorador(t: 'entidad' | 'temporal' | 'estados'): void {
    this.tipoGraficoExplorador.set(t);
    this.actualizarGraficoExplorador();
  }

  public cambiarChartTypeExplorador(type: 'bar' | 'doughnut' | 'line'): void {
    this.chartTypeExplorador.set(type);
    this.actualizarGraficoExplorador();
  }

  public cambiarPaginaExplorador(delta: number): void {
    const totalPags = this.datosExplorador()?.totalPaginas || 1;
    const nueva = this.paginaActual() + delta;
    if (nueva >= 1 && nueva <= totalPags) {
      this.paginaActual.set(nueva);
      this.cargarExplorador(false);
    }
  }

  public actualizarGraficoExplorador(): void {
    const data = this.datosExplorador();
    if (!data) return;

    const modo = this.tipoGraficoExplorador();
    const chartType = this.chartTypeExplorador();
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
    const isEstimativos = this.tablaExplorador() === 'estimativos';

    const paleta = [
      '#4b5896', '#706cd6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6',
    ];

    if (modo === 'entidad') {
      const topEntidades = (data.distribuciones.distribucionPorEntidad || []).slice(0, 10);
      const labels = topEntidades.map((e) => e.entidad);
      const valores = topEntidades.map((e) => e.monto);

      this.chartDataExplorador = {
        labels,
        datasets: [
          {
            type: chartType as any,
            label: isEstimativos ? 'Saldo por Tipo ($)' : 'Monto por Entidad ($)',
            data: valores,
            backgroundColor: chartType === 'doughnut' ? paleta.slice(0, labels.length) : (isDark ? '#706cd6' : '#4b5896'),
            borderColor: chartType === 'doughnut' ? (isDark ? '#1e293b' : '#ffffff') : '#4b5896',
            borderWidth: chartType === 'doughnut' ? 2 : 1,
            borderRadius: chartType === 'bar' ? 6 : 0,
          },
        ],
      };
    } else if (modo === 'temporal') {
      const temporales = data.distribuciones.distribucionTemporal || [];
      const labels = temporales.map((t) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(t.periodo)) {
          const parts = t.periodo.split('-');
          return `${parts[2]}/${parts[1]}`;
        }
        return t.periodo;
      });
      const valores = temporales.map((t) => t.monto);
      const labelSerie = isEstimativos ? 'Saldo Diario ($)' : 'Evolución de Montos ($)';

      const pointColors = isEstimativos
        ? valores.map((v) => (v >= 0 ? '#10b981' : '#ef4444'))
        : '#4b5896';

      this.chartDataExplorador = {
        labels,
        datasets: [
          {
            type: chartType === 'doughnut' ? 'bar' : (chartType as any),
            label: labelSerie,
            data: valores,
            backgroundColor: chartType === 'line' ? 'rgba(112, 108, 214, 0.18)' : '#706cd6',
            borderColor: '#706cd6',
            borderWidth: 2,
            fill: chartType === 'line',
            tension: 0.35,
            pointRadius: isEstimativos ? 4.5 : 4,
            pointHoverRadius: 6.5,
            pointBackgroundColor: pointColors,
            pointBorderColor: isEstimativos ? '#ffffff' : '#706cd6',
            borderRadius: 6,
          },
        ],
      };
    } else if (modo === 'estados') {
      const estados = data.distribuciones.distribucionEstados || [];
      const labels = estados.map((e) => e.estado);
      const valores = estados.map((e) => e.monto);

      this.chartDataExplorador = {
        labels,
        datasets: [
          {
            type: chartType as any,
            label: 'Monto por Estado ($)',
            data: valores,
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#706cd6'],
            borderColor: isDark ? '#1e293b' : '#ffffff',
            borderWidth: 2,
            borderRadius: chartType === 'bar' ? 6 : 0,
          },
        ],
      };
    }

    if (chartType === 'doughnut') {
      this.chartOptionsExplorador = {
        ...this.chartOptionsExplorador,
        scales: undefined,
      };
    } else {
      this.chartOptionsExplorador = {
        ...this.chartOptionsExplorador,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11, weight: 'bold' } },
          },
          y: {
            grid: { color: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.6)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              callback: (val) => `$${Number(val).toLocaleString('es-AR')}`,
            },
          },
        },
      };
    }

    this.cdr.detectChanges();
    this.chart?.update();
  }

  public exportarCSVExplorador(): void {
    const data = this.datosExplorador();
    if (!data || !data.items || data.items.length === 0) return;

    const headers = ['ID', 'Fecha', 'Entidad', 'Concepto', 'Monto', 'Tipo', 'Estado', 'Detalle'];
    const rows = data.items.map((it) => [
      `"${it.id}"`,
      `"${it.fecha}"`,
      `"${it.entidad.replace(/"/g, '""')}"`,
      `"${it.concepto.replace(/"/g, '""')}"`,
      it.monto,
      `"${it.tipo || ''}"`,
      `"${it.estado || ''}"`,
      `"${(it.detalle || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_explorador_${this.tablaExplorador()}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
