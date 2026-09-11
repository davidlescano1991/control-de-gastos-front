import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  PLATFORM_ID,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { Entidad } from '../../../../models/entidad';
import { getGridColor, getLineWidth } from '../../../../utils/grafico.utils';

@Component({
  selector: 'app-grafico-cuotas-coincidentes',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatCardModule],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './grafico-cuotas-coincidentes.html',
  styleUrls: ['./grafico-cuotas-coincidentes.scss'],
})
export class GraficoCuotasCoincidentes implements OnChanges {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @Input() visa: Entidad[] = [];
  @Input() master: Entidad[] = [];
  @Input() naranja: Entidad[] = [];
  @Input() bancor: Entidad[] = [];
  @Input() otros: Entidad[] = [];
  @Input() ml: Entidad[] = [];

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);

  chartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Mes Anterior',
        data: [],
        backgroundColor: 'rgba(56, 189, 248, 0.35)', // Celeste translúcido
        borderColor: 'rgba(2, 132, 199, 0.65)',
        borderWidth: 1,
        borderRadius: 2,
        categoryPercentage: 0.85,
        barPercentage: 1.0,
      },
      {
        label: 'Mes Actual',
        data: [],
        backgroundColor: '#2563eb', // Azul sólido destacado
        borderColor: '#1d4ed8',
        borderWidth: 1.5,
        borderRadius: 2,
        categoryPercentage: 0.85,
        barPercentage: 1.0,
      },
      {
        label: 'Mes Siguiente',
        data: [],
        backgroundColor: 'rgba(168, 85, 247, 0.35)', // Lila translúcido
        borderColor: 'rgba(126, 34, 206, 0.65)',
        borderWidth: 1,
        borderRadius: 2,
        categoryPercentage: 0.85,
        barPercentage: 1.0,
      },
    ],
  };

  chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    skipNull: true,
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = context.raw as number | null;
            if (raw === null || raw === undefined) return '';
            const datasetLabel = context.dataset.label ?? '';
            return ` ${datasetLabel}: $${raw.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnChanges(): void {
    if (this.isBrowser) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    this.isCargando.set(true);

    const todas = [
      ...(this.visa ?? []),
      ...(this.master ?? []),
      ...(this.naranja ?? []),
      ...(this.bancor ?? []),
      ...(this.otros ?? []),
      ...(this.ml ?? []),
    ];

    const mapaDatos = new Map<
      string,
      { label: string; actual: number; total: number; sumMontoMensual: number }
    >();

    for (const item of todas) {
      const descripcionRaw = item['descripcion'];
      const montoRaw = item['monto'];
      if (!descripcionRaw) continue;

      const desc = typeof descripcionRaw === 'string' ? descripcionRaw.trim() : String(descripcionRaw);
      const montoCuota = this.parseMoneda(typeof montoRaw === 'string' ? montoRaw : String(montoRaw ?? 0));
      if (montoCuota === 0) continue;

      const matchCuota = desc.match(/(\d+)\/(\d+)/);
      if (!matchCuota) continue; // Solo procesar ítems con formato de cuotas X/Y

      const actual = parseInt(matchCuota[1], 10);
      const total = parseInt(matchCuota[2], 10);

      const ratioStr = `${actual}/${total}`;
      const label = `Cuota ${ratioStr}`;
      const key = `cuota_${actual}_${total}`;

      if (mapaDatos.has(key)) {
        mapaDatos.get(key)!.sumMontoMensual += montoCuota;
      } else {
        mapaDatos.set(key, { label, actual, total, sumMontoMensual: montoCuota });
      }
    }

    const items = Array.from(mapaDatos.values());
    const labels = items.map((i) => i.label);

    const dataAnterior = items.map((i) => {
      if (i.actual > 1) {
        return i.sumMontoMensual * (i.total - i.actual + 2);
      }
      return null; // 1/N (incluyendo 1/1) no tiene nivel de mes anterior
    });

    const dataActual = items.map((i) => {
      return i.sumMontoMensual * (i.total - i.actual + 1); // 1/1 y todas las cuotas actuales en Azul
    });

    const dataSiguiente = items.map((i) => {
      if (i.actual < i.total) {
        return i.sumMontoMensual * (i.total - i.actual);
      }
      return null; // N/N (incluyendo 1/1) no tiene nivel de mes siguiente
    });

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Mes Anterior',
          data: dataAnterior,
          backgroundColor: 'rgba(56, 189, 248, 0.35)', // Celeste translúcido
          borderColor: 'rgba(2, 132, 199, 0.65)',
          borderWidth: 1,
          borderRadius: 2,
          categoryPercentage: 0.85,
          barPercentage: 1.0,
        },
        {
          label: 'Mes Actual',
          data: dataActual,
          backgroundColor: '#2563eb', // Azul sólido destacado
          borderColor: '#1d4ed8',
          borderWidth: 1.5,
          borderRadius: 2,
          categoryPercentage: 0.85,
          barPercentage: 1.0,
        },
        {
          label: 'Mes Siguiente',
          data: dataSiguiente,
          backgroundColor: 'rgba(168, 85, 247, 0.35)', // Lila translúcido
          borderColor: 'rgba(126, 34, 206, 0.65)',
          borderWidth: 1,
          borderRadius: 2,
          categoryPercentage: 0.85,
          barPercentage: 1.0,
        },
      ],
    };

    this.cdr.detectChanges();
    this.chart?.update();
    this.isCargando.set(false);
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    const num = Number(valor.replace(/\./g, '').replace(',', '.').replace('$', ''));
    return isNaN(num) ? 0 : num;
  }
}
