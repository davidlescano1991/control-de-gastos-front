import {
  ChangeDetectorRef,
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  SimpleChanges,
  ViewChild,
  PLATFORM_ID,
  inject,
  OnChanges,
} from '@angular/core';
import { ChartConfiguration, LegendItem } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { calcularTendencia, generarDatosGrafico2, getGridColor, getLineWidth } from '../../../../utils/grafico.utils';
import { Movimiento2 } from '../../../../models/movimiento';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-movimientos',
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatIconModule, MatButtonModule],
  templateUrl: './movimientos.html',
  styleUrl: './movimientos.scss',
  providers: [provideCharts(withDefaultRegisterables())],
})
export class Movimientos implements OnChanges {
  isCollapsed = signal(false);
  @Input() isColDerechaContraida = false;
  @Output() toggleHorizontalCollapse = new EventEmitter<void>();

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  onToggleHorizontalCollapse() {
    this.toggleHorizontalCollapse.emit();
  }

  isBrowser = false;

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  isCargando = signal(true);
  private _anio = signal<number>(0);
  // Inyección con la nueva API
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private storeGoogle = inject(MovimientosStoreGoogle);
  @Input() movimientos: Movimiento2[] = [];
  @Input() set anio(value: number) {
    if (this._anio() !== value) {
      this._anio.set(value);
      //this.cargarMovimientosPorAnio(value);
    }
  }
  get anio(): number {
    return this._anio();
  }
  private _resumenPorDia = signal<
    { fecha: string; total: number; diferencia: number; deudaPesos: number }[]
  >([]);
  @Input() set resumenPorDia(
    value: { fecha: string; total: number; diferencia: number; deudaPesos: number }[],
  ) {
    this._resumenPorDia.set(value ?? []); // Solo cargar si realmente hay registros
    if (value && value.length > 0 && this._anio() > 0) {
      this.cargarMovimientosPorAnio(this._anio());
    }
  }

  /* ngOnInit() {
    if (this.isBrowser) {
      this.cargarMovimientosPorAnio(this.anio);
    }
  } */
  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  ngOnChanges(changes: SimpleChanges) {
    console.log(`---entra método ngOnChanges() de Movimientos anio: ${this._anio()} ---`);
    if (
      changes['anio'] ||
      (changes['resumenPorDia'] && changes['resumenPorDia'].currentValue?.length > 0)
    ) {
      console.log(`---inicia método cargarDatosPorAnio(anio: ${this._anio()}) en  ngOnChanges() ---`);
      this.cargarMovimientosPorAnio(this._anio());
    }
  }

  async cargarMovimientosPorAnio(anio: number) {
    if (!this.isBrowser || anio === undefined) return;
    console.warn(`Entro a cargarMovimientosPorAnio(anio: ${anio}) en Movimientos`);

    this.isCargando.set(true);
    //await this.storeGoogle.cargarDesdeSheetsPorAnio(anio);
    const lista = this.storeGoogle.getMovimientosPorAnio(anio);
    console.warn(`lista tiene ${lista.length} registros`);

    this.movimientos = lista;

    this.actualizarGrafico();

    this.actualizarDibujo();
    this.isCargando.set(false);
  }

  actualizarDibujo() {
    this.chart?.update();
    this.cdr.detectChanges();
  }

  actualizarGrafico() {
    const { fechas, saldos, deudas } = generarDatosGrafico2(this.movimientos);
    const tendencia = calcularTendencia(saldos);
    const tendenciaDeuda = calcularTendencia(deudas);
    this.chartData.labels = fechas;
    this.chartData.datasets = [
      {
        label: 'Saldo $',
        data: saldos,
        borderColor: '#aa51f3ff',
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const valor = ctx.p1.parsed.y ?? 0; // valor del punto final del segmento (fallback 0)
            return valor < 0 ? '#800000' : '#aa51f3ff';
          },
        },
      },
      {
        label: 'Tendencia',
        data: tendencia,
        borderColor: '#d09ff7ff',
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Deudas $',
        data: deudas,
        borderColor: '#f00000ff',
        fill: false,
      },
      {
        label: 'TendenciaDeuda',
        data: tendenciaDeuda,
        borderColor: '#f79f9fff',
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      },
    ];
  }

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Saldo $',
        data: [],
        borderColor: '#aa51f3ff',
        fill: false,
      },
    ],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // 👈 permite que el gráfico se expanda verticalmente
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: (legendItem: LegendItem) =>
            legendItem.text !== 'Tendencia' && legendItem.text !== 'TendenciaDeuda',
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        border: {
          display: true,
        },
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };
}
