import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Entidad } from '../../../../models/entidad';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';

export interface RowProyeccion {
  mes: string;
  subtotal: number;
  esMesActual: boolean;
  estadoMes: 'mes-pasado' | 'mes-actual' | 'mes-futuro';
}

@Component({
  selector: 'app-tabla-proyeccion-totales',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, MatCardModule, MatProgressSpinnerModule],
  providers: [CurrencyPipe],
  templateUrl: './tabla-proyeccion-totales.html',
  styleUrls: ['./tabla-proyeccion-totales.scss'],
})
export class TablaProyeccionTotales implements OnChanges {
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

  isCargando = signal(false);
  isBrowser = false;

  totalMesActual = signal<number>(0);
  filasProyeccion = signal<RowProyeccion[]>([]);

  private storeGoogle = inject(MovimientosStoreGoogle);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnChanges(): Promise<void> {
    if (this.isBrowser && this.mesSeleccionado) {
      await this.cargarProyeccion();
    }
  }

  obtenerEstadoMes(mes: string, index: number): 'mes-pasado' | 'mes-actual' | 'mes-futuro' {
    if (mes === this.mesSeleccionado) {
      return 'mes-actual';
    }

    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(this.anioSeleccionado);
    const indexActual = mesesDelAnio.indexOf(this.mesSeleccionado);
    const indexEsteMes = mesesDelAnio.indexOf(mes);

    if (indexActual !== -1 && indexEsteMes !== -1) {
      return indexEsteMes < indexActual ? 'mes-pasado' : 'mes-futuro';
    }

    return index < indexActual ? 'mes-pasado' : 'mes-futuro';
  }

  async cargarProyeccion(): Promise<void> {
    this.isCargando.set(true);

    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(this.anioSeleccionado);
    if (!mesesDelAnio || mesesDelAnio.length === 0) {
      this.isCargando.set(false);
      return;
    }

    // Conservar todos los meses del año para no perder los meses anteriores al cambiar de mes
    const mesesAMostrar = [...mesesDelAnio];

    // Asegurar que las hojas de todos los meses a mostrar estén cargadas en el store de Google Sheets
    for (const mes of mesesAMostrar) {
      await this.storeGoogle.asegurarMensualPorAnio(
        this.anioSeleccionado,
        mes,
        'TablaProyeccionTotales',
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const rangos = this.storeGoogle.ValidarRangoEntidades(this.anioSeleccionado);
    const entidades = Object.keys(rangos) as (keyof typeof rangos)[];
    const resultados: RowProyeccion[] = [];

    for (let idx = 0; idx < mesesAMostrar.length; idx++) {
      const mes = mesesAMostrar[idx];
      const estadoMes = this.obtenerEstadoMes(mes, idx);
      const hoja = this.storeGoogle.getMensualPorMes(this.anioSeleccionado, mes);
      if (!hoja?.values) {
        resultados.push({
          mes,
          subtotal: 0,
          esMesActual: estadoMes === 'mes-actual' || mes === this.mesSeleccionado,
          estadoMes,
        });
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

      resultados.push({
        mes,
        subtotal: subtotalMes,
        esMesActual: estadoMes === 'mes-actual' || mes === this.mesSeleccionado,
        estadoMes,
      });
    }

    const mesActualObj = resultados.find((r) => r.estadoMes === 'mes-actual') || resultados.find((r) => r.esMesActual);
    this.totalMesActual.set(mesActualObj ? mesActualObj.subtotal : 0);
    this.filasProyeccion.set(resultados);

    this.cdr.detectChanges();
    this.isCargando.set(false);
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '')) || 0;
  }

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }
}
