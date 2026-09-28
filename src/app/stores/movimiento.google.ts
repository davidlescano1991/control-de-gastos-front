/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-useless-escape */
import { computed, Injectable, Signal, signal, inject, WritableSignal } from '@angular/core';
import { GoogleSheetsService } from '../services/google.sheets.service';
import { AppConfigService } from '../services/app-config.service';
import { Movimiento, Movimiento2 } from '../models/movimiento';
import { Entidad } from '../models/entidad';
import { firstValueFrom } from 'rxjs';
import { Prestamo } from '../models/prestamo';
import { DolarService } from '../services/dolar.service';
import { CotizacionStore } from './dolar.store';
import { formatFechaEsAR, parseFechaEsAR } from '../utils/grafico.utils';
import { SseService } from '../services/sse.service';

interface GoogleSheetResponse {
  range: string;
  majorDimension: 'ROWS' | 'COLUMNS';
  values: string[][];
}
export interface EstimativoRow {
  fecha: string;
  saldoPesos: number;
  saldoUSD: number;
  deuda: number;
  real: number | null;
  deudaReal: number;
}

interface PersistedCacheEntry<T> {
  version: number;
  savedAt: number;
  payload: T;
}

interface AnualCachePayload {
  tablaAnual: Prestamo[];
  tablaSecundaria: Prestamo[];
  valorOtorgado: number;
}
export const RANGOS_ENTIDADES_2026 = {
  visa: { inicio: 1, fin: 20, headerIndex: 0 },
  mastercard: { inicio: 24, fin: 38, headerIndex: 23 },
  naranja: { inicio: 42, fin: 60, headerIndex: 41 },
  bancor: { inicio: 64, fin: 76, headerIndex: 63 },
  otros: { inicio: 79, fin: 90, headerIndex: 78 },
  ml: { inicio: 104, fin: 107, headerIndex: 103 },
};
export const RANGOS_ENTIDADES_2025 = {
  visa: { inicio: 1, fin: 20, headerIndex: 0 },
  mastercard: { inicio: 24, fin: 37, headerIndex: 23 },
  naranja: { inicio: 41, fin: 59, headerIndex: 40 },
  bancor: { inicio: 63, fin: 74, headerIndex: 62 },
  otros: { inicio: 77, fin: 88, headerIndex: 76 },
  ml: { inicio: 102, fin: 104, headerIndex: 101 },
};
export const RANGOS_ENTIDADES_2024 = {
  visa: { inicio: 1, fin: 20, headerIndex: 0 },
  mastercard: { inicio: 24, fin: 36, headerIndex: 23 },
  naranja: { inicio: 40, fin: 58, headerIndex: 39 },
  bancor: { inicio: 62, fin: 72, headerIndex: 61 },
  otros: { inicio: 75, fin: 86, headerIndex: 74 },
  ml: { inicio: 100, fin: 102, headerIndex: 99 },
};
export const RANGOS_ENTIDADES_2023 = {
  visa: { inicio: 1, fin: 20, headerIndex: 0 },
  mastercard: { inicio: 24, fin: 35, headerIndex: 23 },
  naranja: { inicio: 39, fin: 57, headerIndex: 38 },
  bancor: { inicio: 61, fin: 70, headerIndex: 60 },
  otros: { inicio: 74, fin: 84, headerIndex: 73 },
  ml: { inicio: 102, fin: 104, headerIndex: 101 },
};
export const RANGOS_ENTIDADES_2022 = {
  visa: { inicio: 1, fin: 20, headerIndex: 0 },
  mastercard: { inicio: 25, fin: 35, headerIndex: 24 },
  naranja: { inicio: 39, fin: 57, headerIndex: 38 },
  otros: { inicio: 61, fin: 71, headerIndex: 60 },
  ml: { inicio: 102, fin: 104, headerIndex: 101 },
};
export const todosLosMeses = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
  'Enero_2026',
  'Febrero_2026',
];

@Injectable({ providedIn: 'root' })
export class MovimientosStoreGoogle {
  private readonly cachePrefix = 'control-gastos-front';
  private readonly cacheVersion = 2;
  private readonly currentYearCacheMs = 1 * 60 * 1000;
  private readonly historicalCacheMs = 30 * 24 * 60 * 60 * 1000;
  private _movimientos = signal<Movimiento[]>([]);
  private _movimientos2 = signal<Movimiento2[]>([]);
  private _entidadVisa = signal<Entidad[]>([]);
  private _headerVisa = signal<string[]>([]);
  private _entidadMasterGalicia = signal<Entidad[]>([]);
  private _headerMasterGalicia = signal<string[]>([]);
  private _entidadNaranja = signal<Entidad[]>([]);
  private _headerNaranja = signal<string[]>([]);
  private _entidadBancor = signal<Entidad[]>([]);
  private _headerBancor = signal<string[]>([]);
  private _entidadML = signal<Entidad[]>([]);
  private _headerML = signal<string[]>([]);
  private _entidadOtros = signal<Entidad[]>([]);
  private mensualRaw = signal<any | null>(null); // guarda el resultado crudo
  private mensualPorMes = new Map<string, Signal<{ values: string[][] }>>();
  private estimativoPorMes = new Map<string, Signal<EstimativoRow[]>>();
  private estimativoPorMesAnio = new Map<string, Signal<EstimativoRow[]>>();
  readonly tablaAnual = signal<Prestamo[]>([]);
  readonly categoriasAnuales = computed(() => {
    const filas = this.tablaAnual();
    const set = new Set<string>();
    filas.forEach((f) => Object.keys(f.valores).forEach((cat) => set.add(cat)));
    return Array.from(set);
  });
  readonly filaOtorgada = signal<Prestamo | null>(null);
  readonly valorOtorgado = signal<number>(0);
  readonly tablaSecundaria = signal<Prestamo[]>([]);
  readonly categoriasSecundaria = computed(() => {
    const filas = this.tablaSecundaria();
    const set = new Set<string>();
    filas.forEach((f) => Object.keys(f.valores).forEach((cat) => set.add(cat)));
    return Array.from(set);
  });
  private _anualCargado = signal(false);
  //private _anualCargado = new Map<number, Signal<boolean>>();;
  private anualCargadoPorAnio = new Map<number, WritableSignal<boolean>>();
  private mensualEnCarga = new Set<string>();
  private anualEnCarga = new Map<string, Promise<void>>();
  private cargaTimestamp = new Map<string, number>();
  private tablaAnualPorAnio = new Map<number, Signal<Prestamo[]>>();
  private tablaSecundariaPorAnio = new Map<number, Signal<Prestamo[]>>();
  private valorOtorgadoPorAnio = new Map<number, Signal<number>>();
  private movimientosPorAnio = new Map<number, Signal<Movimiento2[]>>();
  private movimientosEnCarga = new Map<number, Promise<void>>();
  private movimientosTimestamp = new Map<number, number>();
  private entidadVisaPorMes = new Map<string, Signal<Entidad[]>>();
  private headerVisaPorMes = new Map<string, Signal<string[]>>();
  private entidadMasterGaliciaPorMes = new Map<string, Signal<Entidad[]>>();
  private headerMasterGaliciaPorMes = new Map<string, Signal<string[]>>();
  private entidadNaranjaPorMes = new Map<string, Signal<Entidad[]>>();
  private headerNaranjaPorMes = new Map<string, Signal<string[]>>();
  private entidadBancorPorMes = new Map<string, Signal<Entidad[]>>();
  private headerBancorPorMes = new Map<string, Signal<string[]>>();
  private entidadOtrosPorMes = new Map<string, Signal<Entidad[]>>();
  private entidadMLPorMes = new Map<string, Signal<Entidad[]>>();
  private headerMLPorMes = new Map<string, Signal<string[]>>();
  private mensualEnCargaResumenYGrafico = new Map<string, Promise<void>>();
  private estimativoEnCarga = new Map<string, Promise<void>>();

  public base = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  private sheets = inject(GoogleSheetsService);
  private appConfig = inject(AppConfigService);
  private dolarService = inject(DolarService);
  private cotizacionStore = inject(CotizacionStore);
  private sseService = inject(SseService);

  constructor() {
    console.log('🧠 MovimientosStoreGoogle instanciado');
    this.suscribirEventosSSE();
  }

  private suscribirEventosSSE(): void {
    this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        const year = msg.data?.year || new Date().getFullYear();
        console.log(`⚡ [MovimientosStoreGoogle] Evento DATA_UPDATED recibido vía SSE para año ${year}. Refrescando store...`);
        // 1. Invalidamos cachés en memoria del año afectado
        this.movimientosPorAnio.delete(year);
        this.movimientosTimestamp.delete(year);
        this.tablaAnualPorAnio.delete(year);
        this.anualCargadoPorAnio.delete(year);

        if (msg.data?.mes) {
          const nombreMes = todosLosMeses[msg.data.mes - 1];
          if (nombreMes) {
            this.mensualPorMes.delete(nombreMes);
            this.estimativoPorMes.delete(nombreMes);
          }
        }

        // 2. Disparamos la recarga inmediata con force = true
        this.cargarDesdeSheetsPorAnio(year, true);
      }
    });
  }

  private puedeUsarStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private getCacheKey(tipo: string, clave: string): string {
    return `${this.cachePrefix}:${tipo}:${clave}`;
  }

  private getCacheTtl(anio: number): number {
    return anio === new Date().getFullYear() ? this.currentYearCacheMs : this.historicalCacheMs;
  }

  private leerDesdeStorage<T>(
    tipo: string,
    clave: string,
    anio: number,
  ): PersistedCacheEntry<T> | null {
    if (!this.puedeUsarStorage()) return null;

    try {
      const cacheKey = this.getCacheKey(tipo, clave);
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as PersistedCacheEntry<T>;
      if (parsed.version !== this.cacheVersion) {
        window.localStorage.removeItem(cacheKey);
        return null;
      }

      if (Date.now() - parsed.savedAt > this.getCacheTtl(anio)) {
        window.localStorage.removeItem(cacheKey);
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(`No se pudo leer cache ${tipo}:${clave}`, error);
      return null;
    }
  }

  private guardarEnStorage<T>(tipo: string, clave: string, payload: T): void {
    if (!this.puedeUsarStorage()) return;

    try {
      const entry: PersistedCacheEntry<T> = {
        version: this.cacheVersion,
        savedAt: Date.now(),
        payload,
      };
      window.localStorage.setItem(this.getCacheKey(tipo, clave), JSON.stringify(entry));
    } catch (error) {
      console.warn(`No se pudo guardar cache ${tipo}:${clave}`, error);
    }
  }

  private hidratarMensualDesdeCache(anio: number, mes: string): boolean {
    const clave = `${anio}::${mes}`;
    if (this.mensualPorMes.has(clave)) return true;

    const cached = this.leerDesdeStorage<{ values: string[][] }>('mensual', clave, anio);
    if (!cached) return false;

    this.mensualPorMes.set(clave, signal(cached.payload));
    return true;
  }

  private hidratarEstimativoDesdeCache(anio: number, hoja: string): boolean {
    const clave = `${anio}::${hoja}`;
    if (this.estimativoPorMes.has(clave)) return true;

    const cached = this.leerDesdeStorage<EstimativoRow[]>('estimativo', clave, anio);
    if (!cached) return false;

    this.estimativoPorMes.set(clave, signal(cached.payload));
    return true;
  }

  private aplicarTablaAnual(anio: number, payload: AnualCachePayload, savedAt = Date.now()): void {
    this.valorOtorgado.set(payload.valorOtorgado);
    this.tablaAnual.set(payload.tablaAnual);
    this.tablaSecundaria.set(payload.tablaSecundaria);
    this.tablaAnualPorAnio.set(anio, signal(payload.tablaAnual));
    this.tablaSecundariaPorAnio.set(anio, signal(payload.tablaSecundaria));
    this.valorOtorgadoPorAnio.set(anio, signal(payload.valorOtorgado));
    this.setAnualCargado(anio, true);
    this.cargaTimestamp.set(`Anual ${anio}`, savedAt);
  }

  private setAnualCargado(anio: number, cargado: boolean): void {
    const existente = this.anualCargadoPorAnio.get(anio);
    if (!existente) {
      this.anualCargadoPorAnio.set(anio, signal(cargado));
      return;
    }

    existente.set(cargado);
  }

  get anualCargado() {
    return this._anualCargado();
  }
  get movimientos() {
    return this._movimientos.asReadonly();
  }
  get movimientos2() {
    return this._movimientos2.asReadonly();
  }

  /* getMensualPorMes(anio: number, mes: string): { values: string[][] } | null {
        const clave = `${anio}_${mes}`;
        return this.mensualPorMes.get(clave)?.() ?? null;
    } */
  /*  getMensualPorMes(anio: number, hoja: string): { values: string[][] } | null {
         return this.mensualPorMes.get(hoja)?.() ?? null;
     } */
  /*  getMensualPorMes(anio: number, hoja: string): { values: string[][] } | null {
         const clave = `${anio}::${hoja}`;
         return this.mensualPorMes.get(clave)?.() ?? null;
     } */
  getMensualPorMes(anio: number, hoja: string): { values: string[][] } | null {
    const clave = `${anio}::${hoja}`;
    const signalHoja = this.mensualPorMes.get(clave);
    return signalHoja ? signalHoja() : null;
  }
  getMesesParaResumen(anio: number): string[] {
    const base = this.base;
    try {
      // Prefer AppConfig-provided months; fallback to built-in base
      const meses = this.appConfig.getMesesForYear
        ? this.appConfig.getMesesForYear(anio, base)
        : [...base, ...(this.appConfig.raw?.mesesExtraPorAnio?.[String(anio)] ?? [])];
      return meses;
    } catch (err) {
      return base;
    }
  }
  calcularPorcentajePendiente(): Record<string, number> {
    const totalOtorgado = this.tablaAnual()[0]; // 👈 primera fila: "Prestado"
    const totalPendiente = this.calcularTotalesPendientes(); // 👈 ya excluye primera y última

    const porcentajes: Record<string, number> = {};
    console.log(`entro al for...`);
    for (const cat of Object.keys(totalOtorgado.valores)) {
      const otorgado = totalOtorgado.valores[cat] ?? 0;
      const pendiente = totalPendiente[cat] ?? 0;
      console.log(`pendiente: ${pendiente} / Otorgado: ${otorgado}`);
      const porcentaje = otorgado > 0 ? (pendiente / otorgado) * 100 : 0;
      porcentajes[cat] = Math.round(porcentaje * 100) / 100; // redondeado a 2 decimales
    }

    return porcentajes;
  }
  /* calcularTotalGlobalPendiente(): number {
        const filas = this.tablaAnual();
        const ultimaFila = filas.at(-1); // 👈 última fila de la hoja

        if (!ultimaFila) return 0;

        const valores = ultimaFila.valores;
        const total = Object.values(valores).reduce((acc, val) => acc + (val ?? 0), 0);

        return Math.round(total * 100) / 100; // redondeado a 2 decimales
    } */
  calcularTotalesPendientes(): Record<string, number> {
    //const filas = this.tablaAnual();
    //const filas = this.tablaAnual().slice(1,-1);
    const filas = this.tablaAnual().slice(1);
    //console.log(`total pendiente ${JSON.stringify(this.tablaAnual().slice(1))}`)
    const totales: Record<string, number> = {};

    for (const fila of filas) {
      for (const cat of Object.keys(fila.valores)) {
        const color = fila.colores?.[cat] ?? '';
        const valor = fila.valores[cat] ?? 0;

        if (color.toLowerCase() !== '#0000ff') {
          //console.log(`calcularTotalesPendientes() valor: ${valor}`)
          totales[cat] = (totales[cat] ?? 0) + valor;
          //console.log(`calcularTotalesPendientes() totales[${cat}]: ${JSON.stringify(totales[cat])}`)
        }
      }
    }

    return totales;
  }

  async cargarEntidadesDeMes(mes: string): Promise<void> {
    await this.asegurarMensual(mes, 'Entidades');

    const res = this.getMensual(mes);
    if (!res?.values) return;

    const valores = res.values;
    this.mensualRaw.set(res); // opcional si querés guardar el crudo

    const rangosIniciales = this.ValidarRangoEntidades(new Date().getFullYear());
    Object.entries(rangosIniciales).forEach(([entidad, { inicio, fin, headerIndex }]) => {
      const headers = valores[headerIndex] ?? [];
      const colIndex = headers.findIndex(
        (h: string | undefined) => this.normalizar(h) === this.normalizar(mes),
      );

      if (colIndex === -1 && entidad != 'otros') {
        console.warn(`❌ No se encontró la columna para ${mes} en ${entidad}`);
        return;
      }
      let registros;
      let headersFiltrados: any = {};
      if (entidad === 'otros') {
        registros = valores
          .slice(inicio, fin + 1)
          .filter((fila: string[]) => {
            const monto = fila[1]?.trim();
            return (
              fila.length >= 2 &&
              monto !== '' &&
              !isNaN(parseFloat(monto.replace(/\./g, '').replace(',', '.').replace('$', '')))
            );
          })
          .map((fila: string[]) => ({
            descripcion: fila[0],
            monto: fila[1],
          }));
        console.log('Registros en otros: ', JSON.stringify(registros));
      } else {
        registros = valores
          .slice(inicio, fin + 1)
          .filter((fila: string[]) => {
            const monto = fila[colIndex]?.trim();
            return (
              fila.length > colIndex &&
              monto !== '' &&
              !isNaN(parseFloat(monto.replace(/\./g, '').replace(',', '.').replace('$', '')))
            );
          })
          .map((fila: string[]) => ({
            descripcion: fila[0],
            monto: fila[colIndex],
          }));

        headersFiltrados = [headers[0], headers[colIndex]];
      }
      switch (entidad) {
        case 'visa':
          this._entidadVisa.set(registros);
          this._headerVisa.set(headersFiltrados);
          break;
        case 'mastercard':
          this._entidadMasterGalicia.set(registros);
          this._headerMasterGalicia.set(headersFiltrados);
          break;
        case 'naranja':
          this._entidadNaranja.set(registros);
          this._headerNaranja.set(headersFiltrados);
          break;
        case 'bancor':
          this._entidadBancor.set(registros);
          this._headerBancor.set(headersFiltrados);
          break;
        case 'ml':
          this._entidadML.set(registros);
          this._headerML.set(headersFiltrados);
          break;
        case 'otros':
          this._entidadOtros.set(registros);
          break;
      }
    });
  }

  async cargarEntidadesDeMesPorAnio(anio: number, hoja: string): Promise<void> {
    const clave = `${anio}::${hoja}`;

    //await this.asegurarMensualPorAnio(anio, hoja, 'Entidades');

    const res = this.getMensual(clave);
    if (!res?.values) return;
    //console.warn(`------> res es igual a ${JSON.stringify(res)} `);
    const valores = res.values;
    this.mensualRaw.set(res); // opcional: guarda el crudo

    const objetoEntidades = this.ValidarRangoEntidades(anio);

    Object.entries(objetoEntidades).forEach(([entidad, { inicio, fin, headerIndex }]) => {
      const headers = valores[headerIndex] ?? [];
      const colIndex = headers.findIndex(
        (h: string | undefined) => this.normalizar(h) === this.normalizar(hoja),
      );

      if (colIndex === -1 && entidad !== 'otros') {
        console.warn(`❌ No se encontró la columna para ${hoja} en ${entidad}`);
        return;
      }

      let registros;
      let headersFiltrados: any = {};

      if (entidad === 'otros') {
        registros = valores
          .slice(inicio, fin + 1)
          .filter((fila: string[]) => {
            const monto = fila[1]?.trim();
            return (
              fila.length >= 2 &&
              monto !== '' &&
              !isNaN(parseFloat(monto.replace(/\./g, '').replace(',', '.').replace('$', '')))
            );
          })
          .map((fila: string[]) => ({
            descripcion: fila[0],
            monto: fila[1],
          }));
      } else {
        registros = valores
          .slice(inicio, fin + 1)
          .filter((fila: string[]) => {
            const monto = fila[colIndex]?.trim();
            return (
              fila.length > colIndex &&
              monto !== '' &&
              !isNaN(parseFloat(monto.replace(/\./g, '').replace(',', '.').replace('$', '')))
            );
          })
          .map((fila: string[]) => ({
            descripcion: fila[0],
            monto: fila[colIndex],
          }));

        headersFiltrados = [headers[0], headers[colIndex]];
      }
      switch (entidad) {
        case 'visa':
          console.warn(`Entidad Visa clave ${clave} registros ${JSON.stringify(registros)}`);
          this.entidadVisaPorMes.set(clave, signal(registros));
          this.headerVisaPorMes.set(clave, signal(headersFiltrados));
          /*  this._entidadVisa.set(registros);
                     this._headerVisa.set(headersFiltrados); */
          break;
        case 'mastercard':
          /* this._entidadMasterGalicia.set(registros);
                    this._headerMasterGalicia.set(headersFiltrados); */
          console.warn(
            `Entidad master-galicia clave ${clave} registros ${JSON.stringify(registros)}`,
          );
          this.entidadMasterGaliciaPorMes.set(clave, signal(registros));
          this.headerMasterGaliciaPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'naranja':
          /* this._entidadNaranja.set(registros);
                    this._headerNaranja.set(headersFiltrados); */
          console.warn(`Entidad naranja clave ${clave} registros ${JSON.stringify(registros)}`);
          this.entidadNaranjaPorMes.set(clave, signal(registros));
          this.headerNaranjaPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'bancor':
          /* this._entidadBancor.set(registros);
                    this._headerBancor.set(headersFiltrados); */
          console.warn(`Entidad bancor clave ${clave} registros ${JSON.stringify(registros)}`);
          this.entidadBancorPorMes.set(clave, signal(registros));
          this.headerBancorPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'ml':
          console.warn(`Entidad ML clave ${clave} registros ${JSON.stringify(registros)}`);
          this.entidadMLPorMes.set(clave, signal(registros));
          this.headerMLPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'otros':
          /* this._entidadOtros.set(registros); */
          console.warn(`Entidad otros clave ${clave} registros ${JSON.stringify(registros)}`);
          this.entidadOtrosPorMes.set(clave, signal(registros));
          break;
      }

      console.log(`📦 Registros de ${entidad}:`, registros);
    });
  }

  ValidarRangoEntidades(
    anioValidar: number,
  ): Record<string, { inicio: number; fin: number; headerIndex: number }> {
    try {
      const cfg = this.appConfig?.getEntityRangesForYear?.(anioValidar);
      if (cfg && Object.keys(cfg).length > 0) return cfg as any;
    } catch (err) {
      // ignore and fallback to built-in constants
    }

    if (anioValidar === 2026) return RANGOS_ENTIDADES_2026;
    if (anioValidar === 2025) return RANGOS_ENTIDADES_2025;
    if (anioValidar === 2024) return RANGOS_ENTIDADES_2024;
    if (anioValidar === 2023) return RANGOS_ENTIDADES_2023;
    return RANGOS_ENTIDADES_2022;
  }
  async cargarMensual(mes: string): Promise<void> {
    if (this.mensualPorMes.has(mes)) return; // ya está cargado

    const res = (await firstValueFrom(this.sheets.obtenerMensual(mes, 'A1:B100'))) as {
      values: string[][];
    };
    const s = signal<{ values: string[][] }>(res);
    console.log('--> el objeto mensual es: ', JSON.stringify(s));
    this.mensualPorMes.set(mes, s);
  }
  async asegurarMensual(hojaBase: string, caller?: string): Promise<void> {
    if (this.mensualPorMes.has(hojaBase)) return;
    if (this.mensualEnCarga.has(hojaBase)) return;

    console.log(`📦 [${caller ?? 'desconocido'}] cargando desde API: ${hojaBase}`);
    this.mensualEnCarga.add(hojaBase);

    try {
      const res = (await firstValueFrom(this.sheets.obtenerMensual(hojaBase, 'A1:K500'))) as {
        values: string[][];
      };
      const s = signal<{ values: string[][] }>(res);
      this.mensualPorMes.set(hojaBase, s);
    } catch (err) {
      console.error(`❌ Error al cargar ${hojaBase}`, err);
    } finally {
      this.mensualEnCarga.delete(hojaBase);
    }
  }

  async asegurarEstimativo(hojaBase: string, caller?: string): Promise<void> {
    console.log(`📊 [${caller ?? 'desconocido'}] cargando estimativo: ${hojaBase}`);
    if (this.estimativoPorMes.has(hojaBase)) return;

    const res = (await firstValueFrom(
      this.sheets.obtenerMensual(hojaBase, 'A1:F500'),
    )) as GoogleSheetResponse;
    const rows = res.values ?? [];

    const normalizados = rows
      .slice(1)
      .filter((r) => r.length >= 6 && r[0])
      .map((r) => ({
        fecha: r[0],
        saldoPesos: this.parseMoneda(r[1]),
        saldoUSD: this.parseMoneda(r[2]),
        deuda: this.parseMoneda(r[3]),
        real: r[4] ? this.parseMoneda(r[4]) : null,
        deudaReal: this.parseMoneda(r[5]),
      }));

    // Si la columna USD viene vacía (0), intentamos calcular USD a partir de Pesos usando cotización por fecha
    await this.enriquecerSaldoUSD(normalizados);

    //this.estimativoPorMes.set(hojaBase, signal(normalizados));

    this.estimativoPorMes.set(hojaBase, signal<EstimativoRow[]>(normalizados));
    console.log('✅ Guardado en estimativoPorMes con clave:', hojaBase);
  }

  async asegurarEstimativoAnio(anio: number, hojaBase: string, caller?: string): Promise<void> {
    console.log(`📊 [${caller ?? 'desconocido'}] cargando estimativo: ${hojaBase} anio ${anio}`);

    const claveClavel = `${anio}::${hojaBase}`;
    if (this.estimativoPorMes.has(hojaBase)) return;

    if (this.estimativoEnCarga.has(claveClavel)) {
      return await this.mensualEnCargaResumenYGrafico.get(claveClavel); // 👈 espera la carga en curso
    }
    const promesa = (async () => {
      try {
        const res = (await firstValueFrom(
          this.sheets.obtenerMensualAnio(anio, hojaBase, 'A1:F500'),
        )) as GoogleSheetResponse;
        const rows = res.values ?? [];

        const normalizados = rows
          .slice(1)
          .filter((r) => r.length >= 6 && r[0])
          .map((r) => ({
            fecha: r[0],
            saldoPesos: this.parseMoneda(r[1]),
            saldoUSD: this.parseMoneda(r[2]),
            deuda: this.parseMoneda(r[3]),
            real: r[4] ? this.parseMoneda(r[4]) : null,
            deudaReal: this.parseMoneda(r[5]),
          }));
        // Enriquecer con USD calculado si la columna USD viene vacía
        await this.enriquecerSaldoUSD(normalizados);

        this.estimativoPorMes.set(claveClavel, signal<EstimativoRow[]>(normalizados));
        console.log('✅✅ Guardado en estimativoPorMes con clave:', claveClavel);
      } catch (err) {
        console.error(`❌ Error al cargar estimativo: ${hojaBase} anio ${anio}`, err);
      }
    })();

    try {
      this.estimativoEnCarga.set(claveClavel, promesa);
      await promesa;
    } finally {
      this.estimativoEnCarga.delete(claveClavel);
    }
  }
  async asegurarEstimativoAnioRange(
    anio: number,
    hojasBase: string[],
    caller?: string,
    force = false,
  ): Promise<void> {
    console.log(
      `📊 [${caller ?? 'desconocido'}] cargando estimativo: ${JSON.stringify(hojasBase)} anio ${anio}`,
    );

    if (!force) {
      hojasBase.forEach((hoja) => {
        this.hidratarEstimativoDesdeCache(anio, hoja);
      });

      const todosDisponibles = hojasBase.every((hoja) =>
        this.estimativoPorMes.has(`${anio}::${hoja}`),
      );
      if (todosDisponibles) return;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const rangoHojas = this.resolverNombreHoja(anio, hojasBase.join(', '));
    console.error(`--- RangoHojas: ${anio}::${rangoHojas} `);
    const claveCarga = `${anio}::${rangoHojas}`;
    if (this.estimativoEnCarga.has(claveCarga)) {
      return await this.estimativoEnCarga.get(claveCarga); // 👈 espera la carga en curso
    }
    const promesa = (async () => {
      try {
        console.log(
          `📦 asegurarEstimativoAnioRange() [${caller ?? 'desconocido'}] cargando desde API: ${rangoHojas} (${anio})`,
        );
        ////////////////////////
        const res: any = await firstValueFrom(
          this.sheets.obtenerMensualBatch(anio, hojasBase, 'A1:F500'),
        );

        // res.valueRanges tendrá un array con los datos de cada mes
        for (let i = 0; i < (res.valueRanges?.length ?? 0); i++) {
          const vr = res.valueRanges[i];
          const mes = hojasBase[i];
          const valores = vr.values ?? [];
          const claveClavel = `${anio}::${mes}`;

          const normalizados = valores
            .slice(1)
            .filter((r: string | any[]) => r.length >= 6 && r[0])
            .map((r: string[]) => ({
              fecha: r[0],
              saldoPesos: this.parseMoneda(r[1]),
              saldoUSD: this.parseMoneda(r[2]),
              deuda: this.parseMoneda(r[3]),
              real: r[4] ? this.parseMoneda(r[4]) : null,
              deudaReal: this.parseMoneda(r[5]),
            }));
          // Intentamos enriquecer con USD calculado si está vacio
          await this.enriquecerSaldoUSD(normalizados);

          this.estimativoPorMes.set(claveClavel, signal<EstimativoRow[]>(normalizados));
          this.guardarEnStorage('estimativo', claveClavel, normalizados);
          console.log('✅✅ Guardado en estimativoPorMes con clave:', claveClavel);
        }
      } catch (err) {
        console.warn(`⚠️ Error en asegurarEstimativoAnioRange para ${anio} (${hojasBase.join(', ')}), hidratando desde cache:`, err);
        hojasBase.forEach((hoja) => this.hidratarEstimativoDesdeCache(anio, hoja));
      }
    })();

    try {
      this.estimativoEnCarga.set(claveCarga, promesa);
      await promesa;
    } finally {
      this.estimativoEnCarga.delete(claveCarga);
    }
  }
  /* getEstimados(anio: number, hoja: string): any {
        const clave = `${anio}::${hoja}`;
        console.warn(`Estimados clave ${clave} `);
        return this.estimativoPorMes.get(clave)?.() ?? [];
    } */

  async asegurarAnual(caller?: string): Promise<void> {
    console.log(`📊 [${caller ?? 'desconocido'}] cargando anual`);
    if (this._movimientos().length > 0) return;

    const res = (await firstValueFrom(this.sheets.obtenerMensual('Anual 2025', 'N83:Z101'))) as {
      values: string[][];
    };
    const filas = res.values;
    const headers = filas[0];
    const movimientos = filas.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((key: string, i: number) => {
        obj[key.toLowerCase()] = row[i];
      });

      // Convertir fecha "dd/MM/yyyy" → Date
      const partes = obj.fecha?.split('/');
      if (partes?.length === 3) {
        const [dia, mes, anio] = partes;
        obj.fecha = new Date(+anio, +mes - 1, +dia);
      }

      // Convertir monto "51.500,00" → 51500.00
      if (typeof obj.monto === 'string') {
        const limpio = obj.monto.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.monto = parseFloat(limpio);
      }

      // Convertir monto "51.500,00" → 51500.00
      if (typeof obj.deudapesos === 'string') {
        console.log('sheet deuda pesos', JSON.stringify(obj.deudapesos));
        const limpio = obj.deudapesos.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.deudapesos = parseFloat(limpio);
      }
      return obj as Movimiento;
    });

    this._movimientos.set(movimientos);
  }

  async asegurarMensualPorAnio(anio: number, hoja: string, caller?: string): Promise<void> {
    const hojaReal = this.resolverNombreHoja(anio, hoja);
    const clave = `${anio}::${hoja}`;

    if (this.mensualPorMes.has(clave)) return;

    if (this.mensualEnCargaResumenYGrafico.has(clave)) {
      return await this.mensualEnCargaResumenYGrafico.get(clave); // 👈 espera la carga en curso
    }

    const promesa = (async () => {
      console.log(`📦 [${caller ?? 'desconocido'}] cargando desde API: ${hojaReal} (${anio})`);
      try {
        const res = (await firstValueFrom(
          this.sheets.obtenerMensualAnio(anio, hojaReal, 'A1:K500'),
        )) as { values: string[][] };
        this.mensualPorMes.set(clave, signal(res));
      } catch (err) {
        console.error(`❌ Error al cargar ${hojaReal} (${anio})`, err);
      }
    })();

    this.mensualEnCargaResumenYGrafico.set(clave, promesa);
    await promesa;
    this.mensualEnCargaResumenYGrafico.delete(clave);
  }
  async asegurarMensualPorAnioRange(
    anio: number,
    meses: string[],
    caller?: string,
    force = false,
  ): Promise<void> {
    const rangoHojas = this.resolverNombreHoja(anio, meses.join(', '));

    if (!force) {
      meses.forEach((mes) => {
        this.hidratarMensualDesdeCache(anio, mes);
      });

      const todosDisponibles = meses.every((mes) => this.mensualPorMes.has(`${anio}::${mes}`));
      if (todosDisponibles) return;
    }

    const promesa = (async () => {
      console.log(`📦 [${caller ?? 'desconocido'}] cargando desde API: ${rangoHojas} (${anio})`);
      try {
        const res: any = await firstValueFrom(
          this.sheets.obtenerMensualBatch(anio, meses, 'A1:K500'),
        );

        // res.valueRanges tendrá un array con los datos de cada mes
        res.valueRanges?.forEach((vr: { values: never[] }, i: number) => {
          const mes = meses[i];
          const valores = vr?.values ?? [];
          console.log(`Mes ${mes}:`, valores);
          const clave = `${anio}::${mes}`;
          const payload = { values: valores };
          this.mensualPorMes.set(clave, signal(payload));
          this.guardarEnStorage('mensual', clave, payload);
        });
        console.log('✅ mensualPorMes cargado en batch:', this.mensualPorMes);
      } catch (batchErr) {
        console.warn(
          `⚠️ Error en batchGet mensual para ${anio}, intentando consulta por mes individual...`,
          batchErr,
        );
        for (const mes of meses) {
          try {
            const hojaRes: any = await firstValueFrom(
              this.sheets.obtenerMensualAnio(anio, mes, 'A1:K500'),
            );
            const valores = hojaRes?.values ?? [];
            const clave = `${anio}::${mes}`;
            const payload = { values: valores };
            this.mensualPorMes.set(clave, signal(payload));
            this.guardarEnStorage('mensual', clave, payload);
          } catch (mesErr) {
            console.warn(`⚠️ Hoja ${mes} no encontrada en año ${anio}, omitiendo`, mesErr);
            this.hidratarMensualDesdeCache(anio, mes);
          }
        }
      }
    })();
    await promesa;
  }
  private resolverNombreHoja(anio: number, hoja: string): string {
    // Si la hoja ya viene con año, usala tal cual
    if (hoja.includes('_')) return hoja;

    // Si el año requiere hoja con sufijo, agregalo
    return anio >= anio + 1 ? `${hoja}_${anio}` : hoja;
  }
  async cargarMovimientosPorAnio(anio: number): Promise<void> {
    const clave = `Anual ${anio}`;
    console.log(`Inicia cargarMovimientosPorAnio(${anio})`);
    if (this.movimientosPorAnio.has(anio)) return;

    const res = (await firstValueFrom(this.sheets.obtenerMensual(clave, 'N83:Z101'))) as {
      values: string[][];
    };
    const filas = res.values;
    const headers = filas[0];
    const movimientos = filas.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((key: string, i: number) => {
        obj[key.toLowerCase()] = row[i];
      });

      const partes = obj.fecha?.split('/');
      if (partes?.length === 3) {
        const [dia, mes, anio] = partes;
        obj.fecha = new Date(+anio, +mes - 1, +dia);
      }

      if (typeof obj.monto === 'string') {
        const limpio = obj.monto.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.monto = parseFloat(limpio);
      }

      if (typeof obj.deudapesos === 'string') {
        const limpio = obj.deudapesos.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.deudapesos = parseFloat(limpio);
      }

      return obj as Movimiento2;
    });
    console.log(`cargarMovimientosPorAnio(${anio}) movimientos: `, JSON.stringify(movimientos));
    this.movimientosPorAnio.set(anio, signal(movimientos));
  }

  async cargarTablaAnual(): Promise<void> {
    /* const raw = await firstValueFrom(
            this.sheets.obtenerMensual('Anual 2025', 'N83:Z98')
        ) as { values: string[][] };

 */
    const raw: any = await firstValueFrom(this.sheets.obtenerMensualAnual('Anual 2025', 'N83:Z99'));

    // Extraer monto de N84
    const montoCelda = raw.sheets?.[0]?.data?.[0]?.rowData?.[1]?.values?.[0];
    const montoCrudo = montoCelda?.effectiveValue?.numberValue ?? 0;
    //console.log('monto crudo:', montoCrudo);
    this.valorOtorgado.set(montoCrudo);
    //Color
    const hoja = raw.sheets[0];
    const datos = hoja.data[0].rowData;

    const encabezados = datos[0].values
      .slice(1)
      .map((c: { effectiveValue: { stringValue: any } }) => c.effectiveValue?.stringValue || '');
    // Procesar filas
    const movimientos = datos.slice(1).map((row: { values: any[] }, i: number) => {
      const nombreFila = row.values[0].effectiveValue?.stringValue || '';
      const valores: Record<string, number> = {};
      const colores: Record<string, string> = {};

      row.values.slice(1).forEach(
        (
          celda: {
            userEnteredFormat: any;
            effectiveValue: { numberValue: number };
            textFormatRuns: { format: { foregroundColor: { rgbColor: any } } }[];
          },
          i: string | number,
        ) => {
          const categoria = encabezados[i];
          const valor = celda.effectiveValue?.numberValue ?? 0;
          //const color = celda.textFormatRuns?.[0]?.format?.foregroundColor?.rgbColor;
          const color = celda.userEnteredFormat?.textFormat?.foregroundColor;

          valores[categoria] = valor;
          colores[categoria] = color ? this.rgbToHex(color) : '';
        },
      );

      return {
        nombreFila,
        valores,
        valoresPrestamo: {},
        colores, // 👈 esto lo agrega al objeto
      };
    });

    this.tablaAnual.set(movimientos);
  }

  async cargarTablaAnualAll(): Promise<void> {
    const clave = 'Anual 2025';
    const ahora = Date.now();
    const vencimientoMs = 10 * 60 * 1000; // 1 minutos

    const ultimaCarga = this.cargaTimestamp.get(clave) ?? 0;
    const expirado = ahora - ultimaCarga > vencimientoMs;

    if (this._anualCargado() && !expirado) return;
    if (this.anualEnCarga.has(clave)) return await this.anualEnCarga.get(clave);

    const promesa = (async () => {
      const raw: any = await firstValueFrom(this.sheets.obtenerMensualAnual(clave, 'N16:Z99'));
      const datos = raw.sheets?.[0]?.data?.[0]?.rowData ?? [];
      console.log(
        `datos `,
        JSON.stringify(datos?.[84 - 16]?.values?.[0]?.effectiveValue?.numberValue),
      );
      const montoCrudo = datos?.[84 - 16]?.values?.[0]?.effectiveValue?.numberValue ?? 0;
      this.valorOtorgado.set(montoCrudo);

      const tablaPrestamos = this.extraerTablaDesdeRango(datos, 67, 82, 0);
      this.tablaAnual.set(tablaPrestamos);

      const otraTabla = this.extraerTablaDesdeRango(datos, 0, 12, 1);
      this.tablaSecundaria.set(otraTabla);

      this._anualCargado.set(true);
      this.cargaTimestamp.set(clave, Date.now()); // 👈 actualiza timestamp
    })();

    this.anualEnCarga.set(clave, promesa);
    await promesa;
    this.anualEnCarga.delete(clave);
  }
  async cargarTablaAnualAllXAnio(anio: number, force = false): Promise<void> {
    const clave = `Anual ${anio}`;
    const ahora = Date.now();
    const vencimientoMs = 10 * 60 * 1000; // 1 minutos

    const ultimaCarga = this.cargaTimestamp.get(clave) ?? 0;
    const expirado = ahora - ultimaCarga > vencimientoMs;
    console.warn(`Inicia método cargarTablaAnualAllXAnio(anio : ${anio})`);
    if (this.getAnualCargado(anio) && !expirado && !force) {
      const tablaPrestamos = this.tablaAnualPorAnio.get(anio)?.() ?? [];
      const otraTabla = this.tablaSecundariaPorAnio.get(anio)?.() ?? [];
      const montoCrudo = this.valorOtorgadoPorAnio.get(anio)?.() ?? 0;

      if (tablaPrestamos.length > 0) {
        this.tablaAnual.set(tablaPrestamos);
        this.tablaSecundaria.set(otraTabla);
        this.valorOtorgado.set(montoCrudo);
      }
      return;
    }

    if (!force) {
      const cached = this.leerDesdeStorage<AnualCachePayload>('anual', String(anio), anio);
      if (cached) {
        this.aplicarTablaAnual(anio, cached.payload, cached.savedAt);
        return;
      }
    }

    if (this.anualEnCarga.has(clave) && !force) return await this.anualEnCarga.get(clave);

    const promesa = (async () => {
      console.warn(
        `this.sheets.obtenerMensualAnualAnio(anio:${anio}, clave:${clave}, rango:N15:AA99)`,
      );
      const raw: any = await firstValueFrom(
        this.sheets.obtenerMensualAnualAnio(anio, clave, 'N15:AA99'),
      );
      const datos = raw.sheets?.[0]?.data?.[0]?.rowData ?? [];
      //console.log(`datos `, JSON.stringify(datos))
      //const montoCrudo = datos?.[84 - 16]?.values?.[0]?.effectiveValue?.numberValue ?? 0;
      const montoCrudo = datos?.[69]?.values?.[0]?.effectiveValue?.numberValue ?? 0;
      console.log(
        `montoCrudo `,
        JSON.stringify(datos?.[69]?.values?.[0]?.effectiveValue?.numberValue),
      );
      this.valorOtorgado.set(montoCrudo);

      const filaFinPrestamos = this.getFilasTablaAnual(anio);
      const tablaPrestamos = await this.extraerTablaDesdeRangoAnual(
        datos,
        69,
        filaFinPrestamos,
        13,
        true,
        'Total a devolver',
      );
      //console.log(`tabla prestamos `, JSON.stringify(tablaPrestamos))
      this.tablaAnual.set(tablaPrestamos);
      console.warn(`...Inicia OtraTabla`);
      const otraTabla = this.extraerTablaDesdeRangoAnual(datos, 2, 13, 1);
      const gastosMensuales = this.extraerGastosMensualesDesdeRangoAnual(datos);
      const gastosDiarioPromedio = this.extraerGastosDiarioPromedioDesdeRangoAnual(datos);
      this.tablaSecundaria.set(otraTabla);
      this.tablaGastosMensualesPorAnio.set(anio, signal(gastosMensuales));
      this.tablaGastosDiarioPromedioPorAnio.set(anio, signal(gastosDiarioPromedio));
      this.tablaAnualPorAnio.set(anio, signal(tablaPrestamos));
      this.tablaSecundariaPorAnio.set(anio, signal(otraTabla));
      this.valorOtorgadoPorAnio.set(anio, signal(montoCrudo));

      this.setAnualCargado(anio, true);
      this.cargaTimestamp.set(clave, Date.now()); // 👈 actualiza timestamp
      this.guardarEnStorage('anual', String(anio), {
        tablaAnual: tablaPrestamos,
        tablaSecundaria: otraTabla,
        tablaGastosMensuales: gastosMensuales,
        tablaGastosDiarioPromedio: gastosDiarioPromedio,
        valorOtorgado: montoCrudo,
      });
    })();

    this.anualEnCarga.set(clave, promesa);
    await promesa;
    this.anualEnCarga.delete(clave);
  }

  tablaGastosMensualesPorAnio = new Map<number, WritableSignal<{ mes: string; total: number }[]>>();
  tablaGastosDiarioPromedioPorAnio = new Map<
    number,
    WritableSignal<{ mes: string; total: number }[]>
  >();

  getGastosMensualesAnio(anio: number): { mes: string; total: number }[] {
    return this.tablaGastosMensualesPorAnio.get(anio)?.() ?? [];
  }

  getGastosDiarioPromedioAnio(anio: number): { mes: string; total: number }[] {
    return this.tablaGastosDiarioPromedioPorAnio.get(anio)?.() ?? [];
  }

  private extraerGastosMensualesDesdeRangoAnual(datos: any[]): { mes: string; total: number }[] {
    const resultados: { mes: string; total: number }[] = [];
    const filaInicio = 29;
    const filaFin = 40;

    for (let i = filaInicio; i <= filaFin && i < datos.length; i++) {
      const row = datos[i];
      if (!row?.values || row.values.length < 2) continue;

      const mesVal =
        row.values[0]?.effectiveValue?.stringValue ?? row.values[0]?.formattedValue ?? '';
      const totalVal = row.values[1]?.effectiveValue?.numberValue ?? 0;

      if (mesVal) {
        const mesFormatted = mesVal.charAt(0).toUpperCase() + mesVal.slice(1).toLowerCase();
        resultados.push({
          mes: mesFormatted,
          total: Math.round(totalVal * 100) / 100,
        });
      }
    }
    return resultados;
  }

  private extraerGastosDiarioPromedioDesdeRangoAnual(
    datos: any[],
  ): { mes: string; total: number }[] {
    const resultados: { mes: string; total: number }[] = [];
    const filaInicio = 56;
    const filaFin = 67;

    for (let i = filaInicio; i <= filaFin && i < datos.length; i++) {
      const row = datos[i];
      if (!row?.values || row.values.length < 2) continue;

      const mesVal =
        row.values[0]?.effectiveValue?.stringValue ?? row.values[0]?.formattedValue ?? '';
      const totalVal = row.values[1]?.effectiveValue?.numberValue ?? 0;

      if (mesVal) {
        const mesFormatted = mesVal.charAt(0).toUpperCase() + mesVal.slice(1).toLowerCase();
        resultados.push({
          mes: mesFormatted,
          total: Math.round(totalVal * 100) / 100,
        });
      }
    }
    return resultados;
  }

  private extraerTablaDesdeRangoAnual(
    datos: any[],
    filaInicio: number,
    filaFin: number,
    //columnas: number[],
    columnas: number,
    usarEncabezadoPorColumna = false,
    ultimaFilaMensaje = '',
  ): Prestamo[] {
    const prestamos: Prestamo[] = [];
    const colum = Array.from({ length: columnas }, (_, i) => i + 1);
    // Si se pide encabezado por columna, lo extraemos
    const encabezados = usarEncabezadoPorColumna
      ? colum.map((colIdx) => {
          const celda = datos[filaInicio - 1]?.values?.[colIdx];
          return celda?.effectiveValue?.stringValue?.toLowerCase() ?? `col_${colIdx}`;
        })
      : [];

    // Si no se pide por columna, usamos el primero no vacío
    const encabezadoGlobal = !usarEncabezadoPorColumna
      ? (datos[filaInicio - 1]?.values
          ?.find((c: any) => c?.effectiveValue?.stringValue)
          ?.effectiveValue?.stringValue?.toLowerCase() ?? 'sin_encabezado')
      : null;

    //console.log("🧠 Encabezados:", usarEncabezadoPorColumna ? encabezados : encabezadoGlobal);

    for (let i = filaInicio; i <= filaFin && i < datos.length; i++) {
      const row = datos[i];
      if (!row?.values || row.values.length === 0) continue;

      const nombreFila =
        row.values[0]?.effectiveValue?.stringValue?.toLowerCase() ?? ultimaFilaMensaje;
      const valores: Record<string, number> = {};
      const colores: Record<string, string> = {};

      colum.forEach((colIdx, j) => {
        const celda = row.values[colIdx];
        const valor = celda?.effectiveValue?.numberValue ?? 0;
        const color = celda?.userEnteredFormat?.textFormat?.foregroundColor;

        const categoria = usarEncabezadoPorColumna ? encabezados[j] : encabezadoGlobal;

        valores[categoria] = valor;
        colores[categoria] = color ? this.rgbToHex(color) : '';

        //console.log(`Fila ${i} (${nombreFila}) → columna ${colIdx} = ${valor} → categoría '${categoria}'`);
      });

      prestamos.push({ nombreFila, valores, valoresPrestamo: {}, colores });
    }

    //console.log("✅ Prestamos generados:", JSON.stringify(prestamos));
    return prestamos;
  }
  getFilasTablaAnual(anio: number): number {
    try {
      const cfg = this.appConfig.getFilasTablaAnualForYear
        ? this.appConfig.getFilasTablaAnualForYear(anio)
        : this.appConfig.raw?.filasTablaAnualPorAnio?.[String(anio)];
      if (typeof cfg === 'number') return cfg;
    } catch (err) {
      // ignore and fallback
    }

    if (anio === 2026) return 84;
    if (anio === 2025) return 84;
    if (anio === 2024) return 83;
    return 82;
  }
  getAnualCargado(anio: number): boolean {
    if (!this.anualCargadoPorAnio.has(anio)) {
      //this.anualCargadoPorAnio.clear();//lo hice yo
      this.anualCargadoPorAnio.set(anio, signal(false));
    }
    return this.anualCargadoPorAnio.get(anio)!();
  }
  async getTablaAnual(anio: number): Promise<Prestamo[]> {
    const clave = `Anual ${anio}`;
    console.warn(`getTablaAnual ${clave}`);

    // Si hay una carga en curso, esperar
    const promesa = this.anualEnCarga.get(clave);
    if (promesa || !this.getAnualCargado(anio)) {
      console.log(`.....espera promesa anualEnCarga`);
      await promesa;
      console.log(`.....promesa anualEnCarga finalizada`);
    }
    // Ahora sí devolver lo cargado
    console.warn(`tablaAnual --> ${JSON.stringify(this.tablaAnual())}`);
    return this.tablaAnual();
  }

  private extraerTablaDesdeRango(
    datos: any[],
    filaInicio: number,
    filaFin: number,
    bloque: number,
  ): Prestamo[] {
    const encabezados =
      datos[0]?.values
        ?.slice(1)
        ?.map((c: any) => c.effectiveValue?.stringValue?.toLowerCase() ?? '') ?? [];

    const prestamos: Prestamo[] = [];

    for (let i = filaInicio; i <= filaFin && i < datos.length; i++) {
      const row = datos[i];
      if (!row?.values) continue;

      const nombreFila = row.values[0]?.effectiveValue?.stringValue ?? '';
      const valores: Record<string, number> = {};
      const colores: Record<string, string> = {};

      row.values.slice(1).forEach((celda: any, j: number) => {
        if (!encabezados[j]) return; // 👈 evitar undefined
        const categoria = encabezados[j];
        const valor = celda?.effectiveValue?.numberValue ?? 0;
        const color = celda?.userEnteredFormat?.textFormat?.foregroundColor;

        valores[categoria] = valor;
        colores[categoria] = color ? this.rgbToHex(color) : '';
      });

      prestamos.push({
        nombreFila,
        valores,
        valoresPrestamo: {},
        colores,
      });
    }

    return prestamos;
  }

  private rgbToHex(rgb: { red?: number; green?: number; blue?: number }): string {
    const r = Math.round((rgb.red ?? 0) * 255);
    const g = Math.round((rgb.green ?? 0) * 255);
    const b = Math.round((rgb.blue ?? 0) * 255);
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  private parseMoneda(valor: any): number {
    if (valor === undefined || valor === null) return 0;
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const convertido = Number(valor.replace(/\./g, '').replace(',', '.').replace('$', ''));
      return isNaN(convertido) ? 0 : convertido;
    }
    return 0;
  }

  // Extrae una fecha en formato dd/mm/yyyy desde un texto que puede contener saltos o espacios
  private extraerFechaNormalizada(texto: string | undefined): string | null {
    if (!texto) return null;
    const t = texto.replace(/\r|\n/g, ' ').trim();
    const match = t.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (match) return match[1];
    // intentar juntar tokens si el año se rompió en dos partes, por ejemplo '08/05/20 26'
    const tokens = t.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (
        /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(tokens[i]) &&
        tokens[i + 1] &&
        /^\d{2}$/.test(tokens[i + 1])
      ) {
        return `${tokens[i]}${tokens[i + 1]}`; // ej. '08/05/20' + '26' => '08/05/2026' (pero quedan 2026 mal formateados)
      }
    }
    return null;
  }

  private obtenerCotizacionVigenteDesdeMap(
    fechaISO: string,
    cotMap: Map<string, number>,
    diasBusqueda = 10,
  ): number {
    const fechaBase = new Date(`${fechaISO}T12:00:00`);
    for (let offset = 0; offset <= diasBusqueda; offset++) {
      const f = new Date(fechaBase);
      f.setDate(fechaBase.getDate() - offset);
      const iso = f.toISOString().split('T')[0];
      const cot = cotMap.get(iso);
      if (cot != null && cot > 0) {
        return cot;
      }
    }
    return 0;
  }

  // Enriquecer filas estimativo con valor USD calculado si la columna USD viene vacía.
  // Primero intenta usar CotizacionStore.enriquecerConDolarPorRango (consulta por rango + cache).
  private async enriquecerSaldoUSD(normalizados: EstimativoRow[]): Promise<void> {
    if (!normalizados || normalizados.length === 0) return;

    const pendientes = normalizados.filter(
      (r) => (r.saldoUSD === 0 || r.saldoUSD == null) && r.saldoPesos && r.saldoPesos !== 0,
    );
    if (pendientes.length === 0) return;

    // Detectar año a partir de la primera fecha disponible
    let detectedAnio: number | undefined = undefined;
    for (const p of pendientes) {
      const fechaNorm = this.extraerFechaNormalizada(p.fecha);
      if (!fechaNorm) continue;
      const parts = fechaNorm.split('/');
      if (parts.length === 3) {
        detectedAnio = parts[2].length === 2 ? Number(`20${parts[2]}`) : Number(parts[2]);
        break;
      }
    }
    if (!detectedAnio) detectedAnio = new Date().getFullYear();

    try {
      const resumen = pendientes.map((r) => ({
        fecha: r.fecha,
        total: r.saldoPesos,
        diferencia: 0,
        deudaPesos: r.deuda ?? 0,
      }));

      const enriched = await this.cotizacionStore.enriquecerConDolarPorRango(
        resumen as any,
        detectedAnio,
        'MovimientosStoreGoogle.enriquecerSaldoUSD',
      );

      if (enriched && enriched.length > 0) {
        // enriched order matches resumen order
        for (let i = 0; i < enriched.length; i++) {
          const e = enriched[i];
          const target = pendientes[i];
          if (e && e.totalUSD != null) {
            target.saldoUSD = Number(Number(e.totalUSD).toFixed(2));
          } else {
            target.saldoUSD = 0;
          }
        }
        return;
      }
    } catch (err) {
      console.warn('⚠️ CotizacionStore enrich failed, falling back to range service', err);
    }

    // Fallback: pedir por rango usando el servicio
    const fechas = new Set<string>();
    for (const r of pendientes) {
      const fechaNorm = this.extraerFechaNormalizada(r.fecha);
      if (!fechaNorm) continue;
      const parts = fechaNorm.split('/');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      fechas.add(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }

    if (fechas.size === 0) return;

    const arrFechas = Array.from(fechas).sort();
    const start = arrFechas[0];
    const end = arrFechas[arrFechas.length - 1];
    try {
      const rangoRes: any = await this.dolarService.obtenerDolarPorRango(start, end);
      const cotMap = new Map<string, number>();
      if (rangoRes?.results?.length) {
        for (const entry of rangoRes.results) {
          const fecha = entry.fecha;
          const cot = entry.detalle?.[0]?.tipoCotizacion || 0;
          cotMap.set(fecha, cot);
        }
      }

      for (const r of pendientes) {
        const fechaNorm = this.extraerFechaNormalizada(r.fecha);
        if (!fechaNorm) {
          r.saldoUSD = 0;
          continue;
        }
        const parts = fechaNorm.split('/');
        const iso = `${parts[2].length === 2 ? `20${parts[2]}` : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(
          2,
          '0',
        )}`;
        let rate = cotMap.get(iso) || 0;
        if (!rate || rate === 0) {
          rate = this.obtenerCotizacionVigenteDesdeMap(iso, cotMap);
        }
        r.saldoUSD = rate > 0 ? Number((r.saldoPesos / rate).toFixed(2)) : 0;
      }
      return;
    } catch (err) {
      console.warn('❌ Error requesting dolar range', err);
    }
  }
  isMesCargado(mes: string): boolean {
    return this.mensualPorMes.has(mes);
  }

  getMensual(hojaBase: string): any | null {
    return this.mensualPorMes.get(hojaBase)?.() ?? null;
  }
  cleanMensual(): any | null {
    return this.mensualPorMes.clear();
  }
  /* getMensual2(mes: string, entidad: string): any | null {
        return this.mensualPorMes.get(`${entidad}_${mes}`)?.() ?? null;
    } */
  getEstimativo(mes: string): any | null {
    return this.estimativoPorMes.get(mes)?.() ?? null;
  }
  /* getEstimativoPorFecha(mes: string, fecha: string) {
        return this.getEstimativo(mes).find(r => r.fecha === fecha);
    } */
  getRegistrosDeEntidadPorMes(entidad: string, mes: string): any[] {
    const res = this.getMensual(mes);
    if (!res?.values) return [];
    const rangos = this.ValidarRangoEntidades(new Date().getFullYear());
    const rango = rangos?.[entidad];
    if (!rango) return [];
    const { inicio, fin, headerIndex } = rango;
    const headers = res.values[headerIndex] ?? [];
    const colIndex = headers.findIndex(
      (h: string | undefined) => this.normalizar(h) === this.normalizar(mes),
    );

    if (colIndex === -1) return [];

    return res.values
      .slice(inicio, fin + 1)
      .filter((fila: string | any[]) => {
        const monto = fila[colIndex]?.trim();
        return (
          fila.length > colIndex &&
          monto !== '' &&
          !isNaN(parseFloat(monto.replace(/\./g, '').replace(',', '.').replace('$', '')))
        );
      })
      .map((fila: any[]) => ({
        descripcion: fila[0],
        monto: fila[colIndex],
      }));
  }

  async actualizarSaldoReal(
    mes: string,
    fecha: string,
    formula: string,
  ): Promise<{ status: string; mensaje: string }> {
    const filas = this.estimativoPorMes.get(mes)?.();
    if (!filas) throw new Error(`No hay datos para el mes: ${mes}`);

    const filaIndex = filas.findIndex((f) => f.fecha === fecha);
    if (filaIndex === -1) throw new Error(`No se encontró la fecha: ${fecha}`);

    const celda = `E${filaIndex + 2}`;
    const res = await this.sheets.actualizarCeldaViaProxy(mes, celda, formula).toPromise();
    if (!res) throw new Error('Respuesta vacía del proxy');

    return res;
  }

  obtenerTotalesGlobalesDesdeResumen(meses: string[]): { mes: string; total: number }[] {
    const rangos = this.ValidarRangoEntidades(new Date().getFullYear());
    const entidades = Object.keys(rangos) as string[];
    const resultados: { mes: string; total: number }[] = [];

    for (const mes of meses) {
      let totalMes = 0;

      for (const entidad of entidades) {
        const res = this.getMensual(mes);
        if (!res?.values) {
          console.warn(`❌ Datos faltantes para ${mes}`);
          continue;
        }

        const valores = res.values;
        const headers = valores[0] ?? [];
        const nombreMes = this.extraerMes(mes);
        const colIndex = headers.findIndex(
          (h: string | undefined) => this.normalizar(h) === this.normalizar(nombreMes),
        );
        if (colIndex === -1) continue;

        const { inicio, fin } = rangos[entidad];
        const registros = valores.slice(inicio, fin + 1);

        const subtotal = registros.reduce((sum: number, fila: string[]) => {
          const valor = fila[colIndex];
          const monto =
            typeof valor === 'string'
              ? parseFloat(valor.replace(/\./g, '').replace(',', '.').replace('$', ''))
              : typeof valor === 'number'
                ? valor
                : 0;
          return sum + (isNaN(monto) ? 0 : monto);
        }, 0);

        totalMes += subtotal;
      }

      resultados.push({ mes, total: totalMes });
    }

    return resultados;
  }

  async obtenerTotalesGlobalesDesdeResumenSaldoAnio(
    anio: number,
    force = false,
  ): Promise<{ mes: string; total: number }[]> {
    const objetoEntidades = this.ValidarRangoEntidades(anio);
    const entidades = Object.keys(objetoEntidades) as (keyof typeof objetoEntidades)[];
    const resultados: { mes: string; total: number }[] = [];
    const meses = this.base;
    //

    //
    await this.asegurarMensualPorAnioRange(
      anio,
      meses,
      '--> storeGoogle.obtenerTotalesGlobalesDesdeResumenAnio()',
      force,
    );
    for (const mes of meses) {
      let totalMes = 0;
      //await this.asegurarMensualPorAnio(anio, mes, "--> storeGoogle.obtenerTotalesGlobalesDesdeResumenAnio()")
      const mensl = this.getMensualPorMes(anio, mes);
      if (!mensl?.values) {
        //console.warn(`❌ Datos faltantes para ${mes}`);
        continue;
      }
      const celdaPresupuesto = mensl.values[20]?.[10];
      const presupuesto = this.parseMoneda(celdaPresupuesto);
      for (const entidad of entidades) {
        const res = this.getMensualPorMes(anio, mes);
        if (!res?.values) {
          //console.warn(`❌ Datos faltantes para ${mes}`);
          continue;
        }

        const valores = res.values;
        const headers = valores[0] ?? [];
        const nombreMes = this.extraerMes(mes);
        const colIndex = headers.findIndex(
          (h: string | undefined) => this.normalizar(h) === this.normalizar(nombreMes),
        );
        if (colIndex === -1) continue;

        const { inicio, fin } = objetoEntidades[entidad];
        const registros = valores.slice(inicio, fin + 1);

        const subtotal = registros.reduce((sum: number, fila: string[]) => {
          const valor = fila[colIndex];
          const monto = this.parseMoneda(valor);
          return sum + (isNaN(monto) ? 0 : monto);
        }, 0);

        totalMes += subtotal;
      }

      const saldo = -presupuesto - totalMes;
      resultados.push({ mes, total: saldo });
    }

    return resultados;
  }

  async obtenerTotalesGastosMensualesAnio(
    anio: number,
    force = false,
  ): Promise<{ mes: string; total: number }[]> {
    const objetoEntidades = this.ValidarRangoEntidades(anio);
    const entidades = Object.keys(objetoEntidades) as (keyof typeof objetoEntidades)[];
    const resultados: { mes: string; total: number }[] = [];
    const meses = this.base;

    await this.asegurarMensualPorAnioRange(
      anio,
      meses,
      '--> storeGoogle.obtenerTotalesGastosMensualesAnio()',
      force,
    );

    for (const mes of meses) {
      let totalMes = 0;
      for (const entidad of entidades) {
        const res = this.getMensualPorMes(anio, mes);
        if (!res?.values) continue;

        const valores = res.values;
        const headers = valores[0] ?? [];
        const nombreMes = this.extraerMes(mes);
        const colIndex = headers.findIndex(
          (h: string | undefined) => this.normalizar(h) === this.normalizar(nombreMes),
        );
        if (colIndex === -1) continue;

        const { inicio, fin } = objetoEntidades[entidad];
        const registros = valores.slice(inicio, fin + 1);

        const subtotal = registros.reduce((sum: number, fila: string[]) => {
          const valor = fila[colIndex];
          const monto =
            typeof valor === 'string'
              ? parseFloat(valor.replace(/\./g, '').replace(',', '.').replace('$', ''))
              : typeof valor === 'number'
                ? valor
                : 0;
          return sum + (isNaN(monto) ? 0 : monto);
        }, 0);

        totalMes += subtotal;
      }

      resultados.push({ mes, total: totalMes });
    }

    return resultados;
  }

  async obtenerProyeccionTotalesFuturosAnio(
    anio: number,
    force = false,
  ): Promise<{ mes: string; subtotal: number; desglose: Record<string, number> }[]> {
    const objetoEntidades = this.ValidarRangoEntidades(anio);
    const entidades = Object.keys(objetoEntidades) as (keyof typeof objetoEntidades)[];
    const mesesAMostrar = this.getMesesParaResumen(anio);
    const resultados: { mes: string; subtotal: number; desglose: Record<string, number> }[] = [];

    await this.asegurarMensualPorAnioRange(
      anio,
      mesesAMostrar,
      '--> storeGoogle.obtenerProyeccionTotalesFuturosAnio()',
      force,
    );

    for (const mes of mesesAMostrar) {
      const hoja = this.getMensualPorMes(anio, mes);
      if (!hoja?.values) {
        resultados.push({ mes, subtotal: 0, desglose: {} });
        continue;
      }

      let subtotalMes = 0;
      const desgloseMes: Record<string, number> = {};

      for (const entidad of entidades) {
        const { inicio, fin, headerIndex } = objetoEntidades[entidad];
        const headers = hoja.values[headerIndex] ?? [];
        const colIndex = headers.findIndex(
          (h: string | undefined) => this.normalizar(h) === this.normalizar(mes),
        );

        if (colIndex === -1 && entidad !== 'otros') continue;
        const targetCol = entidad === 'otros' ? 1 : colIndex;

        let subtotalEntidad = 0;
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
            subtotalEntidad += monto * cuotasRestantes;
          }
        }

        if (subtotalEntidad > 0) {
          desgloseMes[entidad] = subtotalEntidad;
        }
        subtotalMes += subtotalEntidad;
      }

      resultados.push({ mes, subtotal: subtotalMes, desglose: desgloseMes });
    }

    return resultados;
  }

  obtenerTotalesPorEntidad(entidad: string, meses: string[]): { mes: string; total: number }[] {
    const resultados: { mes: string; total: number }[] = [];

    for (const mes of meses) {
      const res = this.getMensual(mes);
      if (!res?.values) {
        console.warn(`❌ Datos faltantes para ${mes}`);
        resultados.push({ mes, total: 0 });
        continue;
      }

      const valores = res.values;
      const headers = valores[0] ?? [];

      const nombreMes = this.extraerMes(mes);
      const colIndex = headers.findIndex(
        (h: string | undefined) => this.normalizar(h) === this.normalizar(nombreMes),
      );
      headers.forEach((h: string, i: any) => {
        const match = h?.toLowerCase().replace(/[\s\-]/g, '_') === nombreMes.toLowerCase();
      });
      if (colIndex === -1) {
        resultados.push({ mes, total: 0 });
        continue;
      }

      const rangos = this.ValidarRangoEntidades(new Date().getFullYear());
      const { inicio, fin } = rangos[entidad];
      const registros = valores.slice(inicio, fin + 1);

      const subtotal = registros.reduce((sum: number, fila: Record<string, any>) => {
        const valor = fila[colIndex];
        const monto =
          typeof valor === 'string'
            ? parseFloat(valor.replace(/\./g, '').replace(',', '.').replace('$', ''))
            : typeof valor === 'number'
              ? valor
              : 0;
        return sum + (isNaN(monto) ? 0 : monto);
      }, 0);

      resultados.push({ mes, total: subtotal });
    }
    return resultados;
  }
  private extraerMes(mesCompleto: string): string {
    return mesCompleto.split('_')[0]; // "Enero_2026" → "Enero"
  }

  async cargarDesdeSheets(): Promise<void> {
    if (this._movimientos().length > 0) return;

    const res = (await firstValueFrom(this.sheets.obtenerMovimientos())) as { values: string[][] };
    const filas = res.values;
    const headers = filas[0];
    const movimientos = filas.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((key: string, i: number) => {
        obj[key.toLowerCase()] = row[i];
      });

      // Convertir fecha "dd/MM/yyyy" → Date
      const partes = obj.fecha?.split('/');
      if (partes?.length === 3) {
        const [dia, mes, anio] = partes;
        obj.fecha = new Date(+anio, +mes - 1, +dia);
      }

      // Convertir monto "51.500,00" → 51500.00
      if (typeof obj.monto === 'string') {
        const limpio = obj.monto.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.monto = parseFloat(limpio);
      }

      // Convertir monto "51.500,00" → 51500.00
      if (typeof obj.deudapesos === 'string') {
        console.log('sheet deuda pesos', JSON.stringify(obj.deudapesos));
        const limpio = obj.deudapesos.replace(/\./g, '').replace(/\$/g, '').replace(',', '.');
        obj.deudapesos = parseFloat(limpio);
      }
      return obj as Movimiento;
    });

    this._movimientos.set(movimientos);
  }
  async cargarDesdeSheetsPorAnio(anio: number, force = false): Promise<void> {
    console.log(`Inicia cargarDesdeSheetsPorAnio(${anio})`);
    const ahora = Date.now();
    const vencimientoMs = this.getCacheTtl(anio);
    const ultimaCarga = this.movimientosTimestamp.get(anio) ?? 0;
    const expirado = ahora - ultimaCarga > vencimientoMs;

    // 1. Hidratación inmediata desde localStorage si no está en memoria (carga ultrarrápida en UI)
    if (!this.movimientosPorAnio.has(anio) && !force) {
      const cached = this.leerDesdeStorage<Movimiento2[]>('movimientos', String(anio), anio);
      if (cached) {
        const movimientos = cached.payload.map((mov) => ({
          ...mov,
          fecha: parseFechaEsAR(mov.fecha),
        }));
        this.movimientosPorAnio.set(Number(anio), signal(movimientos));
        this.movimientosTimestamp.set(anio, cached.savedAt);
      }
    }

    // 2. Si ya está cargado en memoria, no ha expirado y no se fuerza recarga, se retorna inmediatamente
    if (this.movimientosPorAnio.has(anio) && !expirado && !force) return;

    if (this.movimientosEnCarga.has(anio) && !force) return await this.movimientosEnCarga.get(anio);

    console.log(`📦 [Movimientos] cargando desde API para año ${anio}`);

    const promesa = (async () => {
      try {
        const clave = 'Movimientos';
        const res = (await firstValueFrom(
          this.sheets.obtenerMensualAnio(anio, clave, 'A1:F3000'),
        )) as { values: string[][] };
        const filas = res.values ?? [];
        const movimientos: Movimiento2[] = [];

        for (const fila of filas.slice(1)) {
          const [fechaRaw, tipo, montoRaw, deudaRaw] = fila;

          if (!fechaRaw || !montoRaw) continue;

          const fecha = parseFechaEsAR(fechaRaw);

          if (fecha.getFullYear() > anio) continue;

          const monto = parseFloat(montoRaw.replace(/\./g, '').replace(',', '.').replace('$', ''));
          const deudapesos = deudaRaw
            ? parseFloat(deudaRaw.replace(/\./g, '').replace(',', '.').replace('$', ''))
            : null;

          movimientos.push({
            fecha,
            tipo,
            monto,
            deudapesos,
          });
        }

        console.log(`✅ movimientos cargados para ${anio}:`, movimientos.length);
        this.movimientosPorAnio.set(Number(anio), signal(movimientos));
        this.movimientosTimestamp.set(anio, Date.now());
        this.guardarEnStorage('movimientos', String(anio), movimientos);
        this.cotizacionStore.limpiarCacheAnio(anio);
      } catch (err) {
        console.error(`❌ Error al cargar movimientos desde API para año ${anio}`, err);
      }
    })();

    this.movimientosEnCarga.set(anio, promesa);
    await promesa;
    this.movimientosEnCarga.delete(anio);
    console.log(`Finaliza cargarDesdeSheetsPorAnio(${anio})`);
  }

  limpiarStorageYRecargar(): void {
    if (this.puedeUsarStorage()) {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(this.cachePrefix)) {
            toRemove.push(key);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
        console.log('🧹 Caché de localStorage limpiado');
      } catch (err) {
        console.warn('Error al limpiar localStorage', err);
      }
    }
    this.movimientosPorAnio.clear();
    this.movimientosTimestamp.clear();
    this.mensualPorMes.clear();
    this.estimativoPorMes.clear();
    this.tablaAnualPorAnio.clear();
    this.cotizacionStore.limpiarTodoCache();
  }

  agregar(movimiento: Movimiento) {
    this._movimientos.update((lista) => [...lista, movimiento]);
    // Aquí podrías agregar lógica para escribir en Sheets si tenés OAuth
  }

  limpiar() {
    this._movimientos.set([]);
  }

  getResumenPorDia(
    anio?: number,
  ): { fecha: string; total: number; diferencia: number; deudaPesos: number }[] {
    console.log(`getResumenPorDia(${anio}?: number)`);
    console.log(
      '🔍 claves disponibles en movimientosPorAnio:',
      Array.from(this.movimientosPorAnio.keys()),
    );
    const movimientos = anio ? (this.movimientosPorAnio.get(anio)?.() ?? []) : this._movimientos2();

    const movimientosPorFecha = new Map<string, number>();
    const deudaPorFecha = new Map<string, number>();

    for (const mov of movimientos) {
      const fecha = formatFechaEsAR(mov.fecha);
      const monto = mov.monto;
      if (mov.deudapesos != null) {
        const deuda = mov.deudapesos;
        deudaPorFecha.set(fecha, (deudaPorFecha.get(fecha) || 0) + deuda);
      }

      movimientosPorFecha.set(fecha, (movimientosPorFecha.get(fecha) || 0) + monto);
    }

    const fechas = Array.from(movimientosPorFecha.keys()).sort((a, b) => {
      return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
    });

    return fechas.map((fecha, i) => {
      const total = movimientosPorFecha.get(fecha)!;
      const anterior = i > 0 ? movimientosPorFecha.get(fechas[i - 1])! : 0;
      const diferencia = total - anterior;
      const deudaPesos = deudaPorFecha.get(fecha) ?? 0;
      return { fecha, total, diferencia, deudaPesos };
    });
  }
  getMovimientos(anio: number): Movimiento2[] {
    return this.movimientosPorAnio.get(anio)?.() ?? [];
  }
  /* getMovimientosPorAnio(anio: number): Movimiento2[] {
        return this._movimientos2().filter(m => {
            const fecha = new Date(m.fecha);
            return fecha.getFullYear() === anio;
        });
    } */
  getMovimientosPorAnio(anio: number): Movimiento2[] {
    return this.movimientosPorAnio.get(anio)?.() ?? [];
  }
  getMovimientosOrdenados(): Movimiento[] {
    return this.movimientos()
      .slice()
      .sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaB - fechaA; // orden descendente
      });
  }

  getTablaAnualPorAnio(anio: number): Prestamo[] {
    return this.tablaAnualPorAnio.get(anio)?.() ?? [];
  }

  getValorOtorgado(anio: number): number {
    return this.valorOtorgadoPorAnio.get(anio)?.() ?? 0;
  }
  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace('$', '')
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }

  get entidadVisa() {
    const ent = this._entidadVisa.asReadonly();
    return ent;
  }
  get headerVisa() {
    return this._headerVisa.asReadonly();
  }

  getEntidadVisa(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad Visa clave ${clave} `);
    return this.entidadVisaPorMes.get(clave)?.() ?? [];
  }

  getHeaderVisa(anio: number, mes: string): string[] {
    return this.headerVisaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }
  getEntidadMasterGalicia(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad Master Galicia clave ${clave} `);
    return this.entidadMasterGaliciaPorMes.get(clave)?.() ?? [];
  }

  getHeaderMasterGalicia(anio: number, mes: string): string[] {
    return this.headerMasterGaliciaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }
  getEntidadNaranja(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad Naranja clave ${clave} `);
    return this.entidadNaranjaPorMes.get(clave)?.() ?? [];
  }

  getHeaderNaranja(anio: number, mes: string): string[] {
    return this.headerNaranjaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }
  getEntidadBancor(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad Bancor clave ${clave} `);
    return this.entidadBancorPorMes.get(clave)?.() ?? [];
  }

  getEntidadML(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad ML clave ${clave} `);
    return this.entidadMLPorMes.get(clave)?.() ?? [];
  }
  getHeaderML(anio: number, mes: string): string[] {
    return this.headerMLPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }
  getEntidadOtros(anio: number, mes: string): Entidad[] {
    const clave = `${anio}::${mes}`;
    console.warn(`Entidad Otros clave ${clave} `);
    return this.entidadOtrosPorMes.get(clave)?.() ?? [];
  }
  async getEstimados(anio: number, hoja: string): Promise<any> {
    const clave = `${anio}::${hoja}`;
    console.warn(`Estimados clave ${clave}`);

    // Si hay una carga en curso, esperar
    const promesa = this.estimativoEnCarga.get(clave);
    if (promesa) {
      await promesa;
    }

    // Ahora sí devolver lo cargado
    return this.estimativoPorMes.get(clave)?.() ?? [];
  }
  /* async getEstimadosRange(anio: number, meses: string[]): Promise<any> {
        const listaMeses = this.resolverNombreHoja(anio,meses.join(', '))
        const clave = `${anio}::${listaMeses}`;
        console.warn(`Estimados clave ${listaMeses}`);

        // Si hay una carga en curso, esperar
        const promesa = this.estimativoEnCarga.get(clave);
        if (promesa) {
            await promesa;
        }

        // Ahora sí devolver lo cargado
        return this.estimativoPorMes.get(clave)?.() ?? [];
    } */
  async getEstimadosRange(anio: number, meses: string[]): Promise<EstimativoRow[]> {
    const resultados: EstimativoRow[] = [];
    for (const mes of meses) {
      const clave = `${anio}::${mes}`;
      const promesa = this.estimativoEnCarga.get(clave);
      if (promesa) await promesa;
      const datos = this.estimativoPorMes.get(clave)?.() ?? [];
      resultados.push(...datos);
    }
    return resultados;
  }

  getHeaderBancor(anio: number, mes: string): string[] {
    return this.headerBancorPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }
  get entidadMasterGalicia() {
    const ent = this._entidadMasterGalicia.asReadonly();
    return ent;
  }
  get headerMasterGalicia() {
    return this._headerMasterGalicia.asReadonly();
  }
  get entidadNaranja() {
    const ent = this._entidadNaranja.asReadonly();
    return ent;
  }
  get headerNaranja() {
    return this._headerNaranja.asReadonly();
  }
  get entidadBancor() {
    const ent = this._entidadBancor.asReadonly();
    return ent;
  }
  get headerBancor() {
    return this._headerBancor.asReadonly();
  }
  get entidadML() {
    const ent = this._entidadML.asReadonly();
    return ent;
  }
  get headerML() {
    return this._headerML.asReadonly();
  }

  get entidadOtros() {
    const ent = this._entidadOtros.asReadonly();
    return ent;
  }
  resetAnual() {
    this._anualCargado.set(false);
    this.tablaAnual.set([]);
    this.tablaSecundaria.set([]);
    this.valorOtorgado.set(0);
  }
}
