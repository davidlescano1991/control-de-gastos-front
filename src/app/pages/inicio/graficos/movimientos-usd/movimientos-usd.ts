import {
  ChangeDetectorRef,
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
  OnChanges,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration, LegendItem } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { calcularTendencia, generarDatosGraficoUSD, getGridColor, getLineWidth } from '../../../../utils/grafico.utils';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Cotizacion } from '../../../../models/cotizacion';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OrigenDatosComponent } from '../../../../common/origen-datos/origen-datos.component';

@Component({
  selector: 'app-movimientos-usd',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatIconModule, MatButtonModule, OrigenDatosComponent],
  templateUrl: './movimientos-usd.html',
  styleUrl: './movimientos-usd.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class MovimientosUsd implements OnChanges {
  isCollapsed = signal(false);
  @Input() isColDerechaContraida = false;
  @Output() toggleHorizontalCollapse = new EventEmitter<void>();

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  onToggleHorizontalCollapse() {
    this.toggleHorizontalCollapse.emit();
  }

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;


  @Input() anio: number = new Date().getFullYear();
  @Input() resumen: Cotizacion[] = []; // 👈 sin setter, solo input
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  isBrowser = false;
  movimientos: Cotizacion[] = [];
  isCargando = signal(true);

  chartDataUSD: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptionsUSD: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // 👈 permite que el gráfico se expanda verticalmente
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (li: LegendItem) => li.text !== 'Tendencia' && li.text !== 'TendenciaDeuda',
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        border: { display: true },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['anio'] || changes['resumen']) {
      this.recalcular();
    }
  }

  private parseYear(fecha: string): number | null {
    // esperado dd/MM/yyyy
    const [d, m, y] = fecha.split('/');
    const yy = Number(y);
    return Number.isFinite(yy) ? yy : null;
  }

  private recalcular() {
    // 1) filtrar por año activo (hasta el año seleccionado inclusive)
    const porAnio = (this.resumen ?? []).filter((m) => {
      const y = this.parseYear(m.fecha);
      return y !== null && y <= this.anio;
    });

    // 2) actualizar estado
    this.movimientos = porAnio;
    this.isCargando.set(false);

    // 3) reset gráfico si no hay datos o si es año futuro
    if (this.movimientos.length === 0 || this.anio > new Date().getFullYear()) {
      this.chartDataUSD = { labels: [], datasets: [] }; // 👈 nueva referencia
      this.actualizarDibujo();
      return;
    }

    // 4) preparar datos con todas las fechas disponibles (coincidiendo con la tabla de saldos diarios)
    const { fechas, saldos, deudas } = generarDatosGraficoUSD(this.movimientos);
    const tendencia = calcularTendencia(saldos);
    const tendenciaDeuda = calcularTendencia(deudas);

    // 5) asignar NUEVAS referencias a chart (forzar rerender)
    this.chartDataUSD = {
      labels: [...fechas],
      datasets: [
        { label: 'Saldo USD$', data: [...saldos], borderColor: '#0dab04ff', fill: false },
        {
          label: 'Tendencia',
          data: [...tendencia],
          borderColor: '#2dd127ff',
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        },
        { label: 'Deuda USD$', data: [...deudas], borderColor: '#d60303ff', fill: false },
        {
          label: 'TendenciaDeuda',
          data: [...tendenciaDeuda],
          borderColor: '#ff6d6dff',
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        },
      ],
    };

    this.actualizarDibujo();
  }

  private actualizarDibujo() {
    this.chart?.update();
    this.cdr.detectChanges();
  }
}
