/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  computed,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { CommonModule, CurrencyPipe, NgClass, NgIf } from '@angular/common';
import { CotizacionStore } from '../../../stores/dolar.store';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { parseFechaEsAR } from '../../../utils/grafico.utils';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OrigenDatosComponent } from '../../../common/origen-datos/origen-datos.component';

@Component({
  selector: 'app-lista-saldo-diario',
  imports: [
    NgClass,
    CommonModule,
    NgIf,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    OrigenDatosComponent,
  ],
  providers: [CurrencyPipe],
  templateUrl: './lista-saldo-diario.html',
  styleUrl: './lista-saldo-diario.scss',
  standalone: true,
})
export class ListaSaldoDiario implements OnChanges {
  isCollapsed = signal(false);
  @Input() isColIzquierdaContraida = false;
  @Output() toggleHorizontalCollapse = new EventEmitter<void>();

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  onToggleHorizontalCollapse() {
    this.toggleHorizontalCollapse.emit();
  }

  /*  @Input() anio: number = 2025; */
  private _anio = signal<number>(0);
  @Input() set anio(value: number) {
    if (this._anio() !== value) {
      this._anio.set(value);
      // No llamar cargarDatosPorAnio aquí: el padre maneja el enriquecimiento USD.
      // cargarDatosPorAnio2 se disparará via el setter de resumenPorDiaUSD cuando lleguen los datos.
    }
  }

  private _resumenPorDia = signal<
    { fecha: string; total: number; diferencia: number; deudaPesos: number }[]
  >([]);

  private _resumenPorDiaUSD = signal<
    {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number | undefined;
      diferenciaUSD?: number | undefined;
      deudaPesos: number;
      deudaUSD?: number | undefined;
    }[]
  >([]);
  /* @Input() set resumenPorDia(value: { fecha: string; total: number; diferencia: number; deudaPesos: number }[]) { 
    // Guardar el valor que llega 
    this._resumenPorDia.set(value ?? []); // Si hay datos y el año ya está seteado, cargar 
    if (value && value.length > 0 && this._anio() > 0) { this.cargarDatosPorAnio(this._anio()); }
  } */
  @Input() set resumenPorDia(
    value: { fecha: string; total: number; diferencia: number; deudaPesos: number }[],
  ) {
    this._resumenPorDia.set(value ?? []); // Solo cargar si realmente hay registros
    this.anioCargado = null; // Invalidar caché para que siempre se recargue con los nuevos datos
    if (value && value.length > 0 && this._anio() > 0) {
      this.cargarDatosPorAnio(this._anio());
    }
  }
  @Input() set resumenPorDiaUSD(
    value: {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number | undefined;
      diferenciaUSD?: number | undefined;
      deudaPesos: number;
      deudaUSD?: number | undefined;
    }[],
  ) {
    this._resumenPorDiaUSD.set(value ?? []);
    this.anioCargado = null; // invalidar caché para forzar recarga con los nuevos datos
    if (value && value.length > 0 && this._anio() > 0) {
      this.cargarDatosPorAnio2(this._anio());
    }
  }

  resumen = signal<any[]>([]);
  resumenFormateado = signal<any[]>([]);
  paginaActual = signal<any[]>([]);
  ordenDescendente = signal(true);
  cargando = signal(true);
  mostrarTabla = signal(false);
  datosCargados = signal(false);
  pageSize = 30;
  pageIndex = 0;
  errorMsj = signal<string>('');
  mostrarContenido = computed(() => !this.cargando() && this.resumenFormateado().length > 0);
  mostrarSinDatos = computed(() => !this.cargando() && this.resumenFormateado().length === 0);
  private anioCargado: number | null = null;
  private resumenEmitidoPorAnio = new Map<number, string>();
  mensajeEstado = signal<string>('');

  /*  @Output() resumenGenerado = new EventEmitter<any[]>(); */

  private storeGoogle = inject(MovimientosStoreGoogle);
  private cotizacionStore = inject(CotizacionStore);
  private currencyPipe = inject(CurrencyPipe);

  /* async ngOnInit() {
    const anio = this._anio();
    if (!this.datosCargados()) {
      await this.cargarDatosPorAnio(anio);
    }
  } */

  /* ngOnChanges(changes: SimpleChanges) {
    if (changes['resumenPorDia'] && changes['resumenPorDia'].currentValue?.length > 0) 
      {
      this.cargarDatosPorAnio(this._anio());
    }
  } */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['resumenPorDiaUSD'] && changes['resumenPorDiaUSD'].currentValue?.length > 0) {
      this.cargarDatosPorAnio2(this._anio());
    }
  }

  async cargarDatosPorAnio(anio: number) {
    this.logEstado(`...inicia  cargarDatosPorAnio(anio: ${anio})`);
    this.anioCargado = anio;

    if (this.resumenFormateado().length === 0) {
      this.cargando.set(true);
    }
    try {
      //await this.storeGoogle.cargarDesdeSheetsPorAnio(anio); //5/1/2026
      //await new Promise(resolve => setTimeout(resolve, 0)); // 👈 deja que se actualicen los signals
      //const baseResumen = await this.storeGoogle.getResumenPorDia(anio);
      this.logEstado(`...obteniendo _resumenPorDia()`);
      const baseResumen = this._resumenPorDia();
      if (!baseResumen || baseResumen.length === 0) {
        this.logEstado('⚠️ No hay datos aún, espero actualización del padre');
        this.cargando.set(false);
        return;
      }
      console.warn(`base resumen es: ${JSON.stringify(baseResumen)}`);
      /* if (baseResumen.length === 0) {
        const msj = `No hay datos para el año seleccionado `;
        console.log(msj);
        this.errorMsj.set(msj);
        this.resumenFormateado.set([]); // 👈 importante
      } */
      this.logEstado(`...baseResumen tiene ${baseResumen.length} registros para el anio ${anio}`);
      console.warn(
        `...baseResumen tiene ${baseResumen.length} registros para el anio ${this.anioCargado}`,
      );
      if (anio <= new Date().getFullYear()) {
        this.logEstado(`...obteniendo resumenConUSD`);
        const resumenConUSD = await this.cotizacionStore.enriquecerConDolarPorRango(
          baseResumen,
          anio,
          'ListaSaldoDiario',
        );
        this.logEstado(`...se obtuvo resumenConUSD con ${resumenConUSD.length} registros`);
        const resumenHash = JSON.stringify(resumenConUSD);
        if (this.resumenEmitidoPorAnio.get(anio) !== resumenHash) {
          this.resumen.set(resumenConUSD);
          this.resumenEmitidoPorAnio.set(anio, resumenHash);
        }
        this.logEstado(`...se procede a ordenar los movimientos`);
        const mapaDeuda = this.calcularMapaDiferenciasDeuda(resumenConUSD);
        const ordenado = resumenConUSD.slice().sort((a, b) => {
          const fechaA = parseFechaEsAR(a.fecha).getTime();
          const fechaB = parseFechaEsAR(b.fecha).getTime();
          return this.ordenDescendente() ? fechaB - fechaA : fechaA - fechaB;
        });
        this.logEstado(`...se procede a formatear los movimientos`);
        const formateado = ordenado.map((r) => {
          const difDeuda = mapaDeuda.get(r.fecha) ?? { difARS: 0, difUSD: 0 };
          return {
            fecha: r.fecha,
            total: this.currencyPipe.transform(r.total, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            totalRaw: r.total,
            diferencia:
              this.currencyPipe.transform(r.diferencia, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            diferenciaRaw: r.diferencia,
            totalUSD:
              r.totalUSD != null
                ? (this.currencyPipe.transform(r.totalUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : 'Sin datos',
            totalUSDRaw: r.totalUSD,
            diferenciaUSD:
              r.diferenciaUSD != null
                ? (this.currencyPipe.transform(r.diferenciaUSD, 'USD', 'symbol', '1.2-2', 'en-US') ??
                  '-')
                : '-',
            diferenciaUSDRaw: r.diferenciaUSD,
            deudaPesos:
              this.currencyPipe.transform(r.deudaPesos, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaPesosRaw: r.deudaPesos,
            diferenciaDeudaPesosRaw: difDeuda.difARS,
            diferenciaDeudaPesos:
              this.currencyPipe.transform(difDeuda.difARS, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaUSD:
              r.deudaUSD != null
                ? (this.currencyPipe.transform(r.deudaUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : 'Sin datos',
            deudaUSDRaw: r.deudaUSD ?? 0,
            diferenciaDeudaUSDRaw: r.deudaUSD != null ? difDeuda.difUSD : null,
            diferenciaDeudaUSD:
              r.deudaUSD != null
                ? (this.currencyPipe.transform(difDeuda.difUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : '-',
          };
        });
        console.log(' 📝 Formateado con Dolar es ', JSON.stringify(formateado));
        this.resumenFormateado.set(formateado);
      } else {
        const resumenHash = JSON.stringify(baseResumen);
        if (this.resumenEmitidoPorAnio.get(anio) !== resumenHash) {
          this.resumen.set(baseResumen);
          this.resumenEmitidoPorAnio.set(anio, resumenHash);
        }

        const mapaDeuda = this.calcularMapaDiferenciasDeuda(baseResumen);
        const ordenado = baseResumen.slice().sort((a, b) => {
          const fechaA = parseFechaEsAR(a.fecha).getTime();
          const fechaB = parseFechaEsAR(b.fecha).getTime();
          return this.ordenDescendente() ? fechaB - fechaA : fechaA - fechaB;
        });

        const formateado = ordenado.map((r) => {
          const difDeuda = mapaDeuda.get(r.fecha) ?? { difARS: 0, difUSD: 0 };
          return {
            fecha: r.fecha,
            total: this.currencyPipe.transform(r.total, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            totalRaw: r.total,
            diferencia:
              this.currencyPipe.transform(r.diferencia, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            diferenciaRaw: r.diferencia,
            totalUSD: 'Sin datos',
            totalUSDRaw: 0,
            diferenciaUSD: '-',
            diferenciaUSDRaw: 0,
            deudaPesos:
              this.currencyPipe.transform(r.deudaPesos, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaPesosRaw: r.deudaPesos,
            diferenciaDeudaPesosRaw: difDeuda.difARS,
            diferenciaDeudaPesos:
              this.currencyPipe.transform(difDeuda.difARS, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaUSD: 'Sin datos',
            deudaUSDRaw: 0,
            diferenciaDeudaUSDRaw: null,
            diferenciaDeudaUSD: '-',
          };
        });
        console.log(' 📝 Formateado sin Dolar es ', JSON.stringify(formateado));
        this.resumenFormateado.set(formateado);
      }
      this.actualizarPagina();
      this.datosCargados.set(true);
    } catch (error) {
      const msj = `❌ Error al obtener datos ${JSON.stringify(error)}`;
      console.log(msj);
      this.errorMsj.set(msj);
    }
    this.logEstado(`...finaliza método cargarDatosPorAnio(anio: ${anio})`);
    this.cargando.set(false);
  }
  async cargarDatosPorAnio2(anio: number) {
    this.logEstado(`...inicia  cargarDatosPorAnio2(anio: ${anio})`);
    this.anioCargado = anio;

    if (this.resumenFormateado().length === 0) {
      this.cargando.set(true);
    }
    try {
      this.logEstado(`...obteniendo _resumenPorDia()`);
      const baseResumen = this._resumenPorDiaUSD();
      if (!baseResumen || baseResumen.length === 0) {
        this.logEstado('⚠️ No hay datos aún, espero actualización del padre');
        this.cargando.set(false);
        return;
      }
      //console.warn(`base resumen es: ${JSON.stringify(baseResumen)}`);
      this.logEstado(`...baseResumen tiene ${baseResumen.length} registros para el anio ${anio}`);
      console.warn(
        `...baseResumen tiene ${baseResumen.length} registros para el anio ${this.anioCargado}`,
      );
      if (anio <= new Date().getFullYear()) {
        this.logEstado(`...obteniendo resumenConUSD`);
        const resumenConUSD = baseResumen;
        this.logEstado(`...se obtuvo resumenConUSD con ${resumenConUSD.length} registros`);
        const resumenHash = JSON.stringify(resumenConUSD);
        if (this.resumenEmitidoPorAnio.get(anio) !== resumenHash) {
          this.resumen.set(resumenConUSD);
          this.resumenEmitidoPorAnio.set(anio, resumenHash);
        }
        this.logEstado(`...se procede a ordenar los movimientos`);
        const mapaDeuda = this.calcularMapaDiferenciasDeuda(resumenConUSD);
        const ordenado = resumenConUSD.slice().sort((a, b) => {
          const fechaA = parseFechaEsAR(a.fecha).getTime();
          const fechaB = parseFechaEsAR(b.fecha).getTime();
          return this.ordenDescendente() ? fechaB - fechaA : fechaA - fechaB;
        });
        this.logEstado(`...se procede a formatear los movimientos`);
        const formateado = ordenado.map((r) => {
          const difDeuda = mapaDeuda.get(r.fecha) ?? { difARS: 0, difUSD: 0 };
          return {
            fecha: r.fecha,
            total: this.currencyPipe.transform(r.total, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            totalRaw: r.total,
            diferencia:
              this.currencyPipe.transform(r.diferencia, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            diferenciaRaw: r.diferencia,
            totalUSD:
              r.totalUSD != null
                ? (this.currencyPipe.transform(r.totalUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : 'Sin datos',
            totalUSDRaw: r.totalUSD,
            diferenciaUSD:
              r.diferenciaUSD != null
                ? (this.currencyPipe.transform(r.diferenciaUSD, 'USD', 'symbol', '1.2-2', 'en-US') ??
                  '-')
                : '-',
            diferenciaUSDRaw: r.diferenciaUSD,
            deudaPesos:
              this.currencyPipe.transform(r.deudaPesos, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaPesosRaw: r.deudaPesos,
            diferenciaDeudaPesosRaw: difDeuda.difARS,
            diferenciaDeudaPesos:
              this.currencyPipe.transform(difDeuda.difARS, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaUSD:
              r.deudaUSD != null
                ? (this.currencyPipe.transform(r.deudaUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : 'Sin datos',
            deudaUSDRaw: r.deudaUSD ?? 0,
            diferenciaDeudaUSDRaw: r.deudaUSD != null ? difDeuda.difUSD : null,
            diferenciaDeudaUSD:
              r.deudaUSD != null
                ? (this.currencyPipe.transform(difDeuda.difUSD, 'USD', 'symbol', '1.2-2', 'en-US') ?? '-')
                : '-',
          };
        });
        //console.log(' 📝 Formateado con Dolar es ', JSON.stringify(formateado));
        this.resumenFormateado.set(formateado);
      } else {
        const resumenHash = JSON.stringify(baseResumen);
        if (this.resumenEmitidoPorAnio.get(anio) !== resumenHash) {
          this.resumen.set(baseResumen);
          this.resumenEmitidoPorAnio.set(anio, resumenHash);
        }

        const mapaDeuda = this.calcularMapaDiferenciasDeuda(baseResumen);
        const ordenado = baseResumen.slice().sort((a, b) => {
          const fechaA = parseFechaEsAR(a.fecha).getTime();
          const fechaB = parseFechaEsAR(b.fecha).getTime();
          return this.ordenDescendente() ? fechaB - fechaA : fechaA - fechaB;
        });

        const formateado = ordenado.map((r) => {
          const difDeuda = mapaDeuda.get(r.fecha) ?? { difARS: 0, difUSD: 0 };
          return {
            fecha: r.fecha,
            total: this.currencyPipe.transform(r.total, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            totalRaw: r.total,
            diferencia:
              this.currencyPipe.transform(r.diferencia, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            diferenciaRaw: r.diferencia,
            totalUSD: 'Sin datos',
            totalUSDRaw: 0,
            diferenciaUSD: '-',
            diferenciaUSDRaw: 0,
            deudaPesos:
              this.currencyPipe.transform(r.deudaPesos, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaPesosRaw: r.deudaPesos,
            diferenciaDeudaPesosRaw: difDeuda.difARS,
            diferenciaDeudaPesos:
              this.currencyPipe.transform(difDeuda.difARS, 'ARS', 'symbol', '1.2-2', 'es-AR') ?? '-',
            deudaUSD: 'Sin datos',
            deudaUSDRaw: 0,
            diferenciaDeudaUSDRaw: null,
            diferenciaDeudaUSD: '-',
          };
        });
        console.log(' 📝 Formateado sin Dolar es ', JSON.stringify(formateado));
        this.resumenFormateado.set(formateado);
      }
      this.actualizarPagina();
      this.datosCargados.set(true);
    } catch (error) {
      const msj = `❌ Error al obtener datos ${JSON.stringify(error)}`;
      console.log(msj);
      this.errorMsj.set(msj);
    }
    this.logEstado(`...finaliza método cargarDatosPorAnio(anio: ${anio})`);
    this.cargando.set(false);
  }

  onPageChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.actualizarPagina();
  }

  actualizarPagina() {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    //console.warn(`start=${start} , end=${end}`);
    this.paginaActual.set(this.resumenFormateado().slice(start, end));
    //console.log(`pagina actual =${JSON.stringify(this.resumenFormateado().slice(start, end))}`);
  }

  compararDeudaUSD(
    actual: number | undefined,
    siguiente: number | undefined,
  ): 'positivo' | 'negativo' | '' {
    if (actual == null || siguiente == null) return '';
    if (actual < siguiente) return 'positivo';
    if (actual > siguiente) return 'negativo';
    return '';
  }

  private calcularMapaDiferenciasDeuda(resumen: any[]): Map<string, { difARS: number; difUSD: number }> {
    const ordenAsc = resumen
      .slice()
      .sort(
        (a, b) => parseFechaEsAR(a.fecha).getTime() - parseFechaEsAR(b.fecha).getTime(),
      );
    const mapa = new Map<string, { difARS: number; difUSD: number }>();
    let deudaARSAnterior = 0;
    let deudaUSDAnterior = 0;
    ordenAsc.forEach((r, idx) => {
      const deudaARSActual = r.deudaPesos ?? 0;
      const deudaUSDActual = r.deudaUSD ?? 0;

      const difARS = idx === 0 ? 0 : deudaARSActual - deudaARSAnterior;
      const difUSD = idx === 0 ? 0 : deudaUSDActual - deudaUSDAnterior;

      mapa.set(r.fecha, { difARS, difUSD });
      deudaARSAnterior = deudaARSActual;
      deudaUSDAnterior = deudaUSDActual;
    });
    return mapa;
  }

  private logEstado(mensaje: string) {
    this.mensajeEstado.set(mensaje);
  }
}
