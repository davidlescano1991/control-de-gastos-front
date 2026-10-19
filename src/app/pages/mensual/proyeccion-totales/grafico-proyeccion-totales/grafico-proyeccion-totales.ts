import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Entidad } from '../../../../models/entidad';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { getGridColor, getLineWidth } from '../../../../utils/grafico.utils';
import { AppConfigService } from '../../../../services/app-config.service';
import { MensualItemsService } from '../../../../services/mensual-items.service';
import { firstValueFrom } from 'rxjs';

export interface PuntoProyeccion {
  mes: string;
  gasto: number;
  saldo: number;
}

@Component({
  selector: 'app-grafico-proyeccion-totales',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './grafico-proyeccion-totales.html',
  styleUrls: ['./grafico-proyeccion-totales.scss'],
})
export class GraficoProyeccionTotales implements OnChanges {
  isCollapsed = signal(false);
  serieActiva = signal<'gastos' | 'saldo' | 'comparativa'>('gastos');

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  cambiarSerie(serie: 'gastos' | 'saldo' | 'comparativa'): void {
    if (this.serieActiva() === serie) return;
    this.serieActiva.set(serie);
    this.renderizarGrafico();
  }

  @Input() mesSeleccionado = '';
  @Input() anioSeleccionado = 2026;
  @Input() visa: Entidad[] = [];
  @Input() master: Entidad[] = [];
  @Input() naranja: Entidad[] = [];
  @Input() bancor: Entidad[] = [];
  @Input() otros: Entidad[] = [];
  @Input() ml: Entidad[] = [];

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);

  puntosProyeccion: PuntoProyeccion[] = [];

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
        titleColor: '#f1f5f9',
        bodyColor: '#ffffff',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const raw = context.parsed.y;
            if (raw === null || raw === undefined) return '';
            const dsLabel = context.dataset.label || (this.serieActiva() === 'gastos' ? 'Gastos Proyectados' : 'Saldo Proyectado');
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
        },
      },
      y: {
        beginAtZero: false,
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

  private appConfig = inject(AppConfigService);
  private mensualItemsService = inject(MensualItemsService);
  private storeGoogle = inject(MovimientosStoreGoogle);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnChanges(): Promise<void> {
    if (this.isBrowser && this.mesSeleccionado) {
      await this.cargarTotalesProyeccion();
    }
  }

  private async cargarTotalesProyeccion(): Promise<void> {
    this.isCargando.set(true);

    // 🚀 Modo Base de Datos (PostgreSQL)
    if (!this.appConfig.isSheetsActivo(this.anioSeleccionado)) {
      try {
        const resAnio = await firstValueFrom(this.mensualItemsService.getItems(this.anioSeleccionado));
        const allItems = resAnio?.items || [];
        const mesesDelAnio = this.storeGoogle.getMesesParaResumen(this.anioSeleccionado);
        const indexActual = mesesDelAnio.indexOf(this.mesSeleccionado);
        const puntosBD: PuntoProyeccion[] = [];

        if (indexActual !== -1) {
          const mesesAMostrar = mesesDelAnio.slice(indexActual, indexActual + 6);
          for (const m of mesesAMostrar) {
            const idxOriginal = mesesDelAnio.indexOf(m);
            const mesNum = idxOriginal + 1;
            let subtotalMes = 0;
            if (mesNum <= 12) {
              const itemsMes = allItems.filter((it) => it.mes === mesNum);
              for (const it of itemsMes) {
                subtotalMes += Number(it.monto || 0);
              }
            }
            puntosBD.push({
              mes: m,
              gasto: subtotalMes,
              saldo: 0,
            });
          }
        }

        this.puntosProyeccion = puntosBD;
        this.renderizarGrafico();
        this.isCargando.set(false);
        return;
      } catch (err) {
        console.warn('⚠️ [GraficoProyeccionTotales] Error al cargar proyección desde BD:', err);
        this.puntosProyeccion = [];
        this.renderizarGrafico();
        this.isCargando.set(false);
        return;
      }
    }

    // 🌐 Modo Google Sheets
    try {
      await this.storeGoogle.asegurarMensualPorAnio(
        this.anioSeleccionado,
        this.mesSeleccionado,
        'GraficoProyeccionTotales',
      );

      const hoja = this.storeGoogle.getMensualPorMes(this.anioSeleccionado, this.mesSeleccionado);
      if (!hoja?.values || hoja.values.length === 0) {
        this.puntosProyeccion = [];
        this.renderizarGrafico();
        this.isCargando.set(false);
        return;
      }

      const MESES_VALIDOS = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];

      // Detección dinámica de la fila de meses (fila 23 -> índice 22)
      let idxFilaMeses = -1;
      for (let r = 20; r <= 25; r++) {
        const row = hoja.values[r];
        if (row && row.some((c: string) => c && MESES_VALIDOS.includes(String(c).trim().toLowerCase()))) {
          idxFilaMeses = r;
          break;
        }
      }
      if (idxFilaMeses === -1) idxFilaMeses = 22;

      const rowMeses = hoja.values[idxFilaMeses] || [];
      const rowGastos = hoja.values[idxFilaMeses + 13] || []; // Fila 36
      const rowSaldo = hoja.values[idxFilaMeses + 15] || [];  // Fila 38

      const puntos: PuntoProyeccion[] = [];
      // Columnas de proyección a partir de la columna I (índice 8)
      for (let c = 8; c < rowMeses.length; c++) {
        const rawMes = String(rowMeses[c] || '').trim();
        if (!rawMes) break;
        const lower = rawMes.toLowerCase().replace(/[^a-záéíóú]/g, '');
        if (MESES_VALIDOS.includes(lower)) {
          puntos.push({
            mes: rawMes,
            gasto: this.parseMoneda(rowGastos[c]),
            saldo: this.parseMoneda(rowSaldo[c]),
          });
        } else {
          break;
        }
      }

      this.puntosProyeccion = puntos;
      this.renderizarGrafico();
    } catch (err) {
      console.warn('⚠️ [GraficoProyeccionTotales] Error al procesar proyección de Google Sheets:', err);
      this.puntosProyeccion = [];
      this.renderizarGrafico();
    } finally {
      this.isCargando.set(false);
    }
  }

  private renderizarGrafico(): void {
    if (!this.puntosProyeccion || this.puntosProyeccion.length === 0) {
      this.chartData = { labels: [], datasets: [] };
      this.cdr.detectChanges();
      this.chart?.update();
      return;
    }

    const labels = this.puntosProyeccion.map((p) => p.mes);
    const serie = this.serieActiva();

    if (serie === 'gastos') {
      const data = this.puntosProyeccion.map((p) => p.gasto);
      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Gastos Proyectados ($)',
            data,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            fill: true,
            tension: 0.25,
            borderWidth: 2.2,
          },
        ],
      };
    } else if (serie === 'saldo') {
      const data = this.puntosProyeccion.map((p) => p.saldo);
      const pointColors = data.map((v) => (v >= 0 ? '#10b981' : '#ef4444'));
      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo Proyectado ($)',
            data,
            borderColor: '#706cd6',
            backgroundColor: 'rgba(112, 108, 214, 0.12)',
            pointBackgroundColor: pointColors,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            fill: true,
            tension: 0.25,
            borderWidth: 2.2,
          },
        ],
      };
    } else {
      // Comparativa: Saldo vs Gastos Proyectados
      const dataSaldo = this.puntosProyeccion.map((p) => p.saldo);
      const dataGastos = this.puntosProyeccion.map((p) => p.gasto);
      const pointColorsSaldo = dataSaldo.map((v) => (v >= 0 ? '#10b981' : '#ef4444'));

      this.chartData = {
        labels,
        datasets: [
          {
            label: 'Saldo Proyectado ($)',
            data: dataSaldo,
            borderColor: '#706cd6',
            backgroundColor: 'rgba(112, 108, 214, 0.08)',
            pointBackgroundColor: pointColorsSaldo,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            fill: false,
            tension: 0.25,
            borderWidth: 2.4,
          },
          {
            label: 'Gastos Proyectados ($)',
            data: dataGastos,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            fill: false,
            tension: 0.25,
            borderWidth: 2.4,
          },
        ],
      };
    }

    this.cdr.detectChanges();
    this.chart?.update();
  }

  private parseMoneda(valor: any): number {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return Number(valor.toFixed(2));
    let str = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (str.includes(',') && str.includes('.')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Number(n.toFixed(2));
  }
}
