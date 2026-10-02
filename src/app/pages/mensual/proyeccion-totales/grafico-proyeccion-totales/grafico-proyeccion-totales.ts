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
import { Entidad } from '../../../../models/entidad';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { getGridColor, getLineWidth } from '../../../../utils/grafico.utils';
import { AppConfigService } from '../../../../services/app-config.service';

@Component({
  selector: 'app-grafico-proyeccion-totales',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatCardModule],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './grafico-proyeccion-totales.html',
  styleUrls: ['./grafico-proyeccion-totales.scss'],
})
export class GraficoProyeccionTotales implements OnChanges {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @Input() anioSeleccionado = 2025;
  @Input() visa: Entidad[] = [];
  @Input() master: Entidad[] = [];
  @Input() naranja: Entidad[] = [];
  @Input() bancor: Entidad[] = [];
  @Input() otros: Entidad[] = [];
  @Input() ml: Entidad[] = [];

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Subtotal $',
        data: [],
        borderColor: '#dc2626',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#dc2626',
        pointRadius: 5,
        fill: true,
        tension: 0.2,
      },
    ],
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = context.raw as number;
            return ` Subtotal: $${raw.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        },
      },
    },
  };

  private appConfig = inject(AppConfigService);
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

    if (!this.appConfig.isSheetsActivo(this.anioSeleccionado)) {
      this.chartData = { labels: [], datasets: [] };
      this.chart?.update();
      this.cdr.detectChanges();
      this.isCargando.set(false);
      return;
    }

    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(this.anioSeleccionado);
    const indexActual = mesesDelAnio.indexOf(this.mesSeleccionado);

    if (indexActual === -1) {
      this.isCargando.set(false);
      return;
    }

    const mesesAMostrar: string[] = [];
    if (indexActual > 0) {
      mesesAMostrar.push(mesesDelAnio[indexActual - 1]);
    }
    for (let i = indexActual; i < mesesDelAnio.length; i++) {
      mesesAMostrar.push(mesesDelAnio[i]);
    }

    for (const mes of mesesAMostrar) {
      await this.storeGoogle.asegurarMensualPorAnio(
        this.anioSeleccionado,
        mes,
        'GraficoProyeccionTotales',
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const rangos = this.storeGoogle.ValidarRangoEntidades(this.anioSeleccionado);
    const entidades = Object.keys(rangos) as (keyof typeof rangos)[];
    const resultados: { mes: string; subtotal: number }[] = [];

    for (const mes of mesesAMostrar) {
      const hoja = this.storeGoogle.getMensualPorMes(this.anioSeleccionado, mes);
      if (!hoja?.values) {
        resultados.push({ mes, subtotal: 0 });
        continue;
      }

      let subtotalMes = 0;
      for (const entidad of entidades) {
        const { inicio, fin, headerIndex } = rangos[entidad];
        const headers = hoja.values[headerIndex] ?? [];
        const colIndex = headers.findIndex((h: string | undefined) =>
          this.normalizar(h) === this.normalizar(mes),
        );

        if (colIndex === -1 && entidad !== 'otros') continue;
        const targetCol = entidad === 'otros' ? 1 : colIndex;

        for (let i = inicio; i <= fin; i++) {
          const fila = hoja.values[i];
          const desc = fila?.[0]?.trim();
          const montoStr = fila?.[targetCol];
          if (!desc || !montoStr) continue;

          const monto = this.parseMoneda(montoStr);
          if (monto === 0) continue;

          const matchCuota = desc.match(/(\d+)\/(\d+)/);
          if (matchCuota) {
            const actual = parseInt(matchCuota[1], 10);
            const total = parseInt(matchCuota[2], 10);
            const cuotasRestantes = total - actual + 1;
            subtotalMes += monto * cuotasRestantes;
          }
        }
      }

      resultados.push({ mes, subtotal: subtotalMes });
    }

    const labels = resultados.map((r) => r.mes);
    const data = resultados.map((r) => r.subtotal);

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Subtotal $',
          data,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          pointBackgroundColor: '#dc2626',
          pointBorderColor: '#dc2626',
          pointRadius: 5,
          fill: true,
          tension: 0.2,
        },
      ],
    };

    this.cdr.detectChanges();
    this.chart?.update();
    this.isCargando.set(false);
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', ''));
  }

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }
}
