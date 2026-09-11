import {
  ChangeDetectorRef,
  Component,
  Input,
  SimpleChanges,
  ViewChild,
  Inject,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartConfiguration, elements } from 'chart.js';
import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables
} from 'ng2-charts';
import { MovimientosStoreGoogle } from '../../../../../stores/movimiento.google';
import { getGridColor, getLineWidth } from '../../../../../utils/grafico.utils';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-grafico-visa',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './grafico-visa.html',
  styleUrls: ['./grafico-visa.scss'],
  providers: [provideCharts(withDefaultRegisterables())]
})
export class GraficoVisa {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = false;
  isCargando = signal(false);
  @Input() anioSeleccionado = 2025;

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        label: 'Total mensual $',
        data: [],
        borderColor: '#007bff',
        fill: false
      }
    ]
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }
    },
    scales: {
      x: {},
      y: {
        beginAtZero: true,
        grid: {
          color: (ctx) => getGridColor(ctx),
          lineWidth: (ctx) => getLineWidth(ctx),
        }
      }
    }
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private storeGoogle: MovimientosStoreGoogle
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['mesSeleccionado'] && this.isBrowser) {
      await this.cargarTotales();
    }
  }

  async cargarTotales() {
    this.isCargando.set(true);
    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(this.anioSeleccionado);
    const index = mesesDelAnio.indexOf(this.mesSeleccionado);
    const anterioresYPosteriores: string[] = [];

    if (index === -1) {
      console.warn(`❌ mesSeleccionado no encontrado en mesesDelAnio: ${this.mesSeleccionado}`);
      this.isCargando.set(false);
      return;
    }

    if (index > 0) anterioresYPosteriores.push(mesesDelAnio[index - 1]);
    anterioresYPosteriores.push(mesesDelAnio[index]);

    for (let i = 1; anterioresYPosteriores.length < 6 && index + i < mesesDelAnio.length; i++) {
      anterioresYPosteriores.push(mesesDelAnio[index + i]);
    }

    // Asegurar que todas las hojas estén cargadas
    for (const mes of anterioresYPosteriores) {
      await this.storeGoogle.asegurarMensualPorAnio(this.anioSeleccionado, mes, 'GraficoVisa');
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 🔑 Aquí aplicamos la misma lógica que usa Resumen
    const rangos = this.storeGoogle.ValidarRangoEntidades(this.anioSeleccionado);
    const entidades = Object.keys(rangos) as Array<keyof typeof rangos>;
    const resultados: { mes: string; total: number }[] = [];

    for (const mes of anterioresYPosteriores) {
      const hoja = this.storeGoogle.getMensualPorMes(this.anioSeleccionado, mes);
      if (!hoja?.values) {
        resultados.push({ mes, total: 0 });
        continue;
      }

      let totalMes = 0;
      for (const entidad of entidades) {
        const { inicio, fin, headerIndex } = rangos[entidad];
        const headers = hoja.values[headerIndex] ?? [];
        const colIndex = headers.findIndex(h => this.normalizar(mes).includes(this.normalizar(h)));
       

        if (colIndex === -1 && entidad !== 'otros') continue;

        if (entidad === 'otros') {
          for (let i = inicio; i <= fin; i++) {
            const fila = hoja.values[i];
            const monto = fila?.[1];
            if (monto) totalMes += this.parseMoneda(monto);
          }
        } else {
          for (let i = inicio; i <= fin; i++) {
            const fila = hoja.values[i];
            const monto = fila?.[colIndex];
            if (monto) totalMes += this.parseMoneda(monto);
          }
        }
      }
      resultados.push({ mes, total: totalMes });
    }

    // Configurar gráfico
    const labels = resultados.map(r => r.mes);
    const data = resultados.map(r => r.total);
    const pointColors = labels.map(mes => mes === this.mesSeleccionado ? 'green' : '#007bff');
    const borderColors = labels.map(mes => mes === this.mesSeleccionado ? 'green' : '#007bff');
    const pointRadius = labels.map(mes => mes === this.mesSeleccionado ? 6 : 4);

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Total mensual $',
          data,
          borderColor: borderColors,
          pointBackgroundColor: pointColors,
          pointBorderColor: borderColors,
          pointRadius,
          borderWidth: 2,
          fill: false,
          tension: 0.3
        }
      ]
    };

    this.cdr.detectChanges();
    this.chart?.ngOnDestroy();
    this.chart?.update();
    this.isCargando.set(false);

  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '')) || 0;
  }
  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, c =>
        ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c)
      );
  }
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
