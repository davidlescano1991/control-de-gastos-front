/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-useless-escape */
import { computed, Injectable, Signal, signal, inject, WritableSignal } from '@angular/core';
import { GoogleSheetsService } from '../services/google.sheets.service';
import { AppConfigService } from '../services/app-config.service';
import { Movimiento2 } from '../models/movimiento';
import { Entidad } from '../models/entidad';
import { firstValueFrom } from 'rxjs';
import { Prestamo } from '../models/prestamo';
import { DolarService } from '../services/dolar.service';
import { CotizacionStore } from './dolar.store';
import { formatFechaEsAR, parseFechaEsAR } from '../utils/grafico.utils';
import { SseService } from '../services/sse.service';
import { MovimientosService } from '../services/movimientos.service';

/**
 * Respuesta devuelta por la API de Google Sheets para consultas estándar.
 */
interface GoogleSheetResponse {
  range: string;
  majorDimension: 'ROWS' | 'COLUMNS';
  values: string[][];
}

/**
 * Representa una fila procesada de la hoja mensual de estimativos diarios.
 */
export interface EstimativoRow {
  fecha: string;
  saldoPesos: number;
  saldoUSD: number;
  deuda: number;
  real: number | null;
  deudaReal: number;
}

/**
 * Estructura para el almacenamiento de entradas con versionado en LocalStorage.
 */
interface PersistedCacheEntry<T> {
  version: number;
  savedAt: number;
  payload: T;
}

/**
 * Payload persistido para las tablas de resumen anual y préstamos.
 */
interface AnualCachePayload {
  tablaAnual: Prestamo[];
  tablaSecundaria: Prestamo[];
  tablaGastosMensuales?: { mes: string; total: number }[];
  tablaGastosDiarioPromedio?: { mes: string; total: number }[];
  valorOtorgado: number;
}

/**
 * Configuración de rangos de filas para cada entidad por año en las hojas mensuales.
 */
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

/**
 * Store centralizado para la carga, gestión en memoria, caché local y reactividad
 * de movimientos, estimativos diarios, tablas de préstamos anuales y tarjetas de crédito.
 */
@Injectable({ providedIn: 'root' })
export class MovimientosStoreGoogle {
  private readonly cachePrefix = 'control-gastos-front';
  private readonly cacheVersion = 2;
  private readonly currentYearCacheMs = 1 * 60 * 1000;
  private readonly historicalCacheMs = 30 * 24 * 60 * 60 * 1000;

  // Mapas de almacenamiento en memoria reactivos por clave (año::mes o año)
  private mensualPorMes = new Map<string, Signal<{ values: string[][] }>>();
  private estimativoPorMes = new Map<string, Signal<EstimativoRow[]>>();

  // Tablas anuales de préstamos y secundarias
  readonly tablaAnual = signal<Prestamo[]>([]);
  readonly categoriasAnuales = computed(() => {
    const filas = this.tablaAnual();
    const set = new Set<string>();
    filas.forEach((f) => Object.keys(f.valores).forEach((cat) => set.add(cat)));
    return Array.from(set);
  });
  readonly valorOtorgado = signal<number>(0);
  readonly tablaSecundaria = signal<Prestamo[]>([]);
  readonly categoriasSecundaria = computed(() => {
    const filas = this.tablaSecundaria();
    const set = new Set<string>();
    filas.forEach((f) => Object.keys(f.valores).forEach((cat) => set.add(cat)));
    return Array.from(set);
  });

  // Estado anual y locks de concurrencia
  private anualCargadoPorAnio = new Map<number, WritableSignal<boolean>>();
  private anualEnCarga = new Map<string, Promise<void>>();
  private cargaTimestamp = new Map<string, number>();
  private tablaAnualPorAnio = new Map<number, Signal<Prestamo[]>>();
  private tablaSecundariaPorAnio = new Map<number, Signal<Prestamo[]>>();
  private valorOtorgadoPorAnio = new Map<number, Signal<number>>();

  // Gastos anuales agregados
  readonly tablaGastosMensualesPorAnio = new Map<
    number,
    WritableSignal<{ mes: string; total: number }[]>
  >();
  readonly tablaGastosDiarioPromedioPorAnio = new Map<
    number,
    WritableSignal<{ mes: string; total: number }[]>
  >();

  // Movimientos diarios por año
  private movimientosPorAnio = new Map<number, Signal<Movimiento2[]>>();
  private movimientosEnCarga = new Map<number, Promise<void>>();
  private movimientosTimestamp = new Map<number, number>();

  // Entidades (Tarjetas de crédito / Otros) indexadas por `${anio}::${mes}`
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

  // Promesas de sincronización para evitar duplicidad de solicitudes HTTP
  private mensualEnCargaResumenYGrafico = new Map<string, Promise<void>>();
  private estimativoEnCarga = new Map<string, Promise<void>>();

  public readonly base = [
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
  private movimientosService = inject(MovimientosService);

  constructor() {
    console.log('🧠 MovimientosStoreGoogle instanciado');
    this.suscribirEventosSSE();
  }

  /**
   * Se suscribe al canal SSE para invalidar la caché reactivamente cuando ocurren mutaciones en la API.
   */
  private suscribirEventosSSE(): void {
    this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        const year = msg.data?.year || new Date().getFullYear();
        console.log(`⚡ [MovimientosStoreGoogle] Evento DATA_UPDATED recibido vía SSE para año ${year}. Invalidando caché...`);

        // Invalidar cachés en memoria del año afectado
        this.movimientosPorAnio.delete(year);
        this.movimientosTimestamp.delete(year);
        this.tablaAnualPorAnio.delete(year);
        this.anualCargadoPorAnio.delete(year);

        if (msg.data?.mes) {
          const nombreMes = todosLosMeses[msg.data.mes - 1];
          if (nombreMes) {
            this.mensualPorMes.delete(`${year}::${nombreMes}`);
            this.estimativoPorMes.delete(`${year}::${nombreMes}`);
          }
        }
      }
    });
  }

  /**
   * Verifica la disponibilidad de LocalStorage en el entorno de ejecución actual (evita errores en SSR).
   */
  private puedeUsarStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  /**
   * Construye una clave homogénea para el almacenamiento en LocalStorage.
   */
  private getCacheKey(tipo: string, clave: string): string {
    return `${this.cachePrefix}:${tipo}:${clave}`;
  }

  /**
   * Retorna el tiempo de vida (TTL) adecuado para la caché según si el año es en curso o histórico.
   */
  private getCacheTtl(anio: number): number {
    return anio === new Date().getFullYear() ? this.currentYearCacheMs : this.historicalCacheMs;
  }

  /**
   * Recupera una entrada persistida en LocalStorage validando versión y expiración.
   */
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

  /**
   * Guarda una entrada versionada en LocalStorage.
   */
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

  /**
   * Hidrata los datos mensuales desde LocalStorage a memoria si aún no están cargados.
   */
  private hidratarMensualDesdeCache(anio: number, mes: string): boolean {
    const clave = `${anio}::${mes}`;
    if (this.mensualPorMes.has(clave)) return true;

    const cached = this.leerDesdeStorage<{ values: string[][] }>('mensual', clave, anio);
    if (!cached) return false;

    this.mensualPorMes.set(clave, signal(cached.payload));
    return true;
  }

  /**
   * Hidrata los estimativos diarios desde LocalStorage a memoria si aún no están cargados.
   */
  private hidratarEstimativoDesdeCache(anio: number, hoja: string): boolean {
    const clave = `${anio}::${hoja}`;
    if (this.estimativoPorMes.has(clave)) return true;

    const cached = this.leerDesdeStorage<EstimativoRow[]>('estimativo', clave, anio);
    if (!cached) return false;

    this.estimativoPorMes.set(clave, signal(cached.payload));
    return true;
  }

  /**
   * Aplica un payload de tabla anual en los signals y mapas reactivos del store.
   */
  private aplicarTablaAnual(anio: number, payload: AnualCachePayload, savedAt = Date.now()): void {
    this.valorOtorgado.set(payload.valorOtorgado);
    this.tablaAnual.set(payload.tablaAnual);
    this.tablaSecundaria.set(payload.tablaSecundaria);
    this.tablaAnualPorAnio.set(anio, signal(payload.tablaAnual));
    this.tablaSecundariaPorAnio.set(anio, signal(payload.tablaSecundaria));
    this.valorOtorgadoPorAnio.set(anio, signal(payload.valorOtorgado));
    if (payload.tablaGastosMensuales) {
      this.tablaGastosMensualesPorAnio.set(anio, signal(payload.tablaGastosMensuales));
    }
    if (payload.tablaGastosDiarioPromedio) {
      this.tablaGastosDiarioPromedioPorAnio.set(anio, signal(payload.tablaGastosDiarioPromedio));
    }
    this.setAnualCargado(anio, true);
    this.cargaTimestamp.set(`Anual ${anio}`, savedAt);
  }

  /**
   * Actualiza el estado reactivo de carga anual para un año específico.
   */
  private setAnualCargado(anio: number, cargado: boolean): void {
    const existente = this.anualCargadoPorAnio.get(anio);
    if (!existente) {
      this.anualCargadoPorAnio.set(anio, signal(cargado));
      return;
    }
    existente.set(cargado);
  }

  /**
   * Consulta si los datos anuales de un año ya se encuentran en memoria.
   */
  getAnualCargado(anio: number): boolean {
    if (!this.anualCargadoPorAnio.has(anio)) {
      this.anualCargadoPorAnio.set(anio, signal(false));
    }
    return this.anualCargadoPorAnio.get(anio)!();
  }

  /**
   * Retorna los datos crudos de una hoja mensual específica (`${anio}::${hoja}`).
   */
  getMensualPorMes(anio: number, hoja: string): { values: string[][] } | null {
    const clave = `${anio}::${hoja}`;
    const signalHoja = this.mensualPorMes.get(clave);
    return signalHoja ? signalHoja() : null;
  }

  /**
   * Devuelve la lista de meses aplicable para un año (incorporando extensiones configuradas).
   */
  getMesesParaResumen(anio: number): string[] {
    const base = this.base;
    try {
      return this.appConfig.getMesesForYear
        ? this.appConfig.getMesesForYear(anio, base)
        : [...base, ...(this.appConfig.raw?.mesesExtraPorAnio?.[String(anio)] ?? [])];
    } catch {
      return base;
    }
  }

  /**
   * Calcula el porcentaje pendiente de pago por categoría respecto a lo prestado/otorgado.
   */
  calcularPorcentajePendiente(): Record<string, number> {
    const totalOtorgado = this.tablaAnual()[0];
    if (!totalOtorgado?.valores) return {};
    const totalPendiente = this.calcularTotalesPendientes();

    const porcentajes: Record<string, number> = {};
    for (const cat of Object.keys(totalOtorgado.valores)) {
      const otorgado = totalOtorgado.valores[cat] ?? 0;
      const pendiente = totalPendiente[cat] ?? 0;
      const porcentaje = otorgado > 0 ? (pendiente / otorgado) * 100 : 0;
      porcentajes[cat] = Math.round(porcentaje * 100) / 100;
    }

    return porcentajes;
  }

  /**
   * Calcula los totales pendientes de pago en la tabla anual excluyendo los cancelados (marcados en azul).
   */
  calcularTotalesPendientes(): Record<string, number> {
    const filas = this.tablaAnual().slice(1);
    const totales: Record<string, number> = {};

    for (const fila of filas) {
      for (const cat of Object.keys(fila.valores)) {
        const color = fila.colores?.[cat] ?? '';
        const valor = fila.valores[cat] ?? 0;

        if (color.toLowerCase() !== '#0000ff') {
          totales[cat] = (totales[cat] ?? 0) + valor;
        }
      }
    }

    return totales;
  }

  /**
   * Carga y procesa los registros de tarjetas y entidades para un mes y año específicos.
   */
  async cargarEntidadesDeMesPorAnio(anio: number, hoja: string): Promise<void> {
    const clave = `${anio}::${hoja}`;
    const res = this.mensualPorMes.get(clave)?.() ?? null;
    if (!res?.values) return;

    const valores = res.values;
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

      let registros: Entidad[];
      let headersFiltrados: string[] = [];

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
          this.entidadVisaPorMes.set(clave, signal(registros));
          this.headerVisaPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'mastercard':
          this.entidadMasterGaliciaPorMes.set(clave, signal(registros));
          this.headerMasterGaliciaPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'naranja':
          this.entidadNaranjaPorMes.set(clave, signal(registros));
          this.headerNaranjaPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'bancor':
          this.entidadBancorPorMes.set(clave, signal(registros));
          this.headerBancorPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'ml':
          this.entidadMLPorMes.set(clave, signal(registros));
          this.headerMLPorMes.set(clave, signal(headersFiltrados));
          break;
        case 'otros':
          this.entidadOtrosPorMes.set(clave, signal(registros));
          break;
      }
    });
  }

  /**
   * Retorna los rangos de índices de filas para las entidades según el año.
   */
  ValidarRangoEntidades(
    anioValidar: number,
  ): Record<string, { inicio: number; fin: number; headerIndex: number }> {
    try {
      const cfg = this.appConfig?.getEntityRangesForYear?.(anioValidar);
      if (cfg && Object.keys(cfg).length > 0) return cfg as any;
    } catch {
      // Fallback a constantes locales
    }

    if (anioValidar === 2026) return RANGOS_ENTIDADES_2026;
    if (anioValidar === 2025) return RANGOS_ENTIDADES_2025;
    if (anioValidar === 2024) return RANGOS_ENTIDADES_2024;
    if (anioValidar === 2023) return RANGOS_ENTIDADES_2023;
    return RANGOS_ENTIDADES_2022;
  }

  /**
   * Asegura la carga por lotes de estimativos diarios para una lista de meses y un año determinado.
   */
  async asegurarEstimativoAnioRange(
    anio: number,
    hojasBase: string[],
    caller?: string,
    force = false,
  ): Promise<void> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      console.log(`ℹ️ [MovimientosStoreGoogle] Año ${anio} en modo BD: estimativos aún no migrados a la BD, sin información.`);
      for (const hoja of hojasBase) {
        this.estimativoPorMes.set(`${anio}::${hoja}`, signal([]));
      }
      return;
    }

    if (!force) {
      hojasBase.forEach((hoja) => {
        this.hidratarEstimativoDesdeCache(anio, hoja);
      });

      const todosDisponibles = hojasBase.every((hoja) =>
        this.estimativoPorMes.has(`${anio}::${hoja}`),
      );
      if (todosDisponibles) return;
    }

    const rangoHojas = this.resolverNombreHoja(anio, hojasBase.join(', '));
    const claveCarga = `${anio}::${rangoHojas}`;
    if (this.estimativoEnCarga.has(claveCarga)) {
      return await this.estimativoEnCarga.get(claveCarga);
    }

    const promesa = (async () => {
      try {
        console.log(
          `📦 asegurarEstimativoAnioRange() [${caller ?? 'desconocido'}] cargando desde API: ${rangoHojas} (${anio})`,
        );
        const res: any = await firstValueFrom(
          this.sheets.obtenerMensualBatch(anio, hojasBase, 'A1:F500'),
        );

        for (let i = 0; i < (res.valueRanges?.length ?? 0); i++) {
          const vr = res.valueRanges[i];
          const mes = hojasBase[i];
          const valores = vr.values ?? [];
          const claveClavel = `${anio}::${mes}`;

          const normalizados: EstimativoRow[] = valores
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

          await this.enriquecerSaldoUSD(normalizados);

          this.estimativoPorMes.set(claveClavel, signal<EstimativoRow[]>(normalizados));
          this.guardarEnStorage('estimativo', claveClavel, normalizados);
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

  /**
   * Carga una hoja mensual individual para un año dado garantizando deduplicación de llamadas en curso.
   */
  async asegurarMensualPorAnio(anio: number, hoja: string, caller?: string): Promise<void> {
    const hojaReal = this.resolverNombreHoja(anio, hoja);
    const clave = `${anio}::${hoja}`;

    if (!this.appConfig.isSheetsActivo(anio)) {
      this.mensualPorMes.set(clave, signal({ values: [] }));
      return;
    }

    if (this.mensualPorMes.has(clave)) return;

    if (this.mensualEnCargaResumenYGrafico.has(clave)) {
      return await this.mensualEnCargaResumenYGrafico.get(clave);
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

  /**
   * Carga en lote un rango de hojas mensuales para un año específico, con fallback individual ante fallos de hoja única.
   */
  async asegurarMensualPorAnioRange(
    anio: number,
    meses: string[],
    caller?: string,
    force = false,
  ): Promise<void> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      console.log(`ℹ️ [MovimientosStoreGoogle] Año ${anio} en modo BD: mensual aún no migrado a la BD, sin información.`);
      for (const mes of meses) {
        this.mensualPorMes.set(`${anio}::${mes}`, signal({ values: [] }));
      }
      return;
    }

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

        res.valueRanges?.forEach((vr: { values: string[][] }, i: number) => {
          const mes = meses[i];
          const valores = vr?.values ?? [];
          const clave = `${anio}::${mes}`;
          const payload = { values: valores };
          this.mensualPorMes.set(clave, signal(payload));
          this.guardarEnStorage('mensual', clave, payload);
        });
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

  /**
   * Normaliza el nombre de la hoja contemplando compatibilidad histórica con sufijos de año.
   */
  private resolverNombreHoja(anio: number, hoja: string): string {
    if (hoja.includes('_')) return hoja;
    return anio >= anio + 1 ? `${hoja}_${anio}` : hoja;
  }

  /**
   * Carga la totalidad de las tablas anuales (préstamos, secundaria y gastos mensuales) para el año solicitado.
   */
  async cargarTablaAnualAllXAnio(anio: number, force = false): Promise<void> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      console.log(`ℹ️ [MovimientosStoreGoogle] Año ${anio} en modo BD: tabla anual aún no migrada a la BD, sin información.`);
      this.tablaAnual.set([]);
      this.tablaSecundaria.set([]);
      this.valorOtorgado.set(0);
      this.tablaGastosMensualesPorAnio.set(anio, signal([]));
      this.tablaGastosDiarioPromedioPorAnio.set(anio, signal([]));
      return;
    }

    const clave = `Anual ${anio}`;
    const ahora = Date.now();
    const vencimientoMs = 10 * 60 * 1000;

    const ultimaCarga = this.cargaTimestamp.get(clave) ?? 0;
    const expirado = ahora - ultimaCarga > vencimientoMs;

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
      const raw: any = await firstValueFrom(
        this.sheets.obtenerMensualAnualAnio(anio, clave, 'N15:AA99'),
      );
      const datos = raw.sheets?.[0]?.data?.[0]?.rowData ?? [];
      const montoCrudo = datos?.[69]?.values?.[0]?.effectiveValue?.numberValue ?? 0;
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
      this.cargaTimestamp.set(clave, Date.now());
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

  /**
   * Obtiene los gastos mensuales consolidados para el año indicado.
   */
  getGastosMensualesAnio(anio: number): { mes: string; total: number }[] {
    return this.tablaGastosMensualesPorAnio.get(anio)?.() ?? [];
  }

  /**
   * Obtiene el promedio de gasto diario por mes para el año indicado.
   */
  getGastosDiarioPromedioAnio(anio: number): { mes: string; total: number }[] {
    return this.tablaGastosDiarioPromedioPorAnio.get(anio)?.() ?? [];
  }

  /**
   * Extrae la serie mensual de gastos desde las celdas de la hoja anual.
   */
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

  /**
   * Extrae la serie de gasto diario promedio mensual desde las celdas de la hoja anual.
   */
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

  /**
   * Parsea celdas con formato, valor efectivo y color de texto a objetos `Prestamo`.
   */
  private extraerTablaDesdeRangoAnual(
    datos: any[],
    filaInicio: number,
    filaFin: number,
    columnas: number,
    usarEncabezadoPorColumna = false,
    ultimaFilaMensaje = '',
  ): Prestamo[] {
    const prestamos: Prestamo[] = [];
    const colum = Array.from({ length: columnas }, (_, i) => i + 1);

    const encabezados = usarEncabezadoPorColumna
      ? colum.map((colIdx) => {
          const celda = datos[filaInicio - 1]?.values?.[colIdx];
          return celda?.effectiveValue?.stringValue?.toLowerCase() ?? `col_${colIdx}`;
        })
      : [];

    const encabezadoGlobal = !usarEncabezadoPorColumna
      ? (datos[filaInicio - 1]?.values
          ?.find((c: any) => c?.effectiveValue?.stringValue)
          ?.effectiveValue?.stringValue?.toLowerCase() ?? 'sin_encabezado')
      : null;

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
      });

      prestamos.push({ nombreFila, valores, valoresPrestamo: {}, colores });
    }

    return prestamos;
  }

  /**
   * Retorna el número de fila final de la tabla anual de préstamos según la configuración del año.
   */
  getFilasTablaAnual(anio: number): number {
    try {
      const cfg = this.appConfig.getFilasTablaAnualForYear
        ? this.appConfig.getFilasTablaAnualForYear(anio)
        : this.appConfig.raw?.filasTablaAnualPorAnio?.[String(anio)];
      if (typeof cfg === 'number') return cfg;
    } catch {
      // Fallback a constantes conocidas
    }

    if (anio === 2026) return 84;
    if (anio === 2025) return 84;
    if (anio === 2024) return 83;
    return 82;
  }

  /**
   * Convierte un objeto RGB (valores de 0 a 1) devuelto por Sheets API a un string hexadecimal '#rrggbb'.
   */
  private rgbToHex(rgb: { red?: number; green?: number; blue?: number }): string {
    const r = Math.round((rgb.red ?? 0) * 255);
    const g = Math.round((rgb.green ?? 0) * 255);
    const b = Math.round((rgb.blue ?? 0) * 255);
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Parsea cadenas o números a valor numérico puro desinfectando signos de moneda y separadores de miles.
   */
  private parseMoneda(valor: any): number {
    if (valor === undefined || valor === null) return 0;
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const convertido = Number(valor.replace(/\./g, '').replace(',', '.').replace('$', ''));
      return isNaN(convertido) ? 0 : convertido;
    }
    return 0;
  }

  /**
   * Extrae y normaliza una fecha en formato dd/mm/yyyy desde texto con saltos de línea o espacios.
   */
  private extraerFechaNormalizada(texto: string | undefined): string | null {
    if (!texto) return null;
    const t = texto.replace(/\r|\n/g, ' ').trim();
    const match = t.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (match) return match[1];

    const tokens = t.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (
        /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(tokens[i]) &&
        tokens[i + 1] &&
        /^\d{2}$/.test(tokens[i + 1])
      ) {
        return `${tokens[i]}${tokens[i + 1]}`;
      }
    }
    return null;
  }

  /**
   * Busca hacia atrás en el mapa de cotizaciones la cotización más cercana para una fecha dada.
   */
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

  /**
   * Enriquece las filas de estimativo diario calculando el contravalor en USD si la columna vino vacía.
   */
  private async enriquecerSaldoUSD(normalizados: EstimativoRow[]): Promise<void> {
    if (!normalizados || normalizados.length === 0) return;

    const pendientes = normalizados.filter(
      (r) => (r.saldoUSD === 0 || r.saldoUSD == null) && r.saldoPesos && r.saldoPesos !== 0,
    );
    if (pendientes.length === 0) return;

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
      console.warn('⚠️ CotizacionStore enrich falló, recurriendo al servicio por rango:', err);
    }

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
    } catch (err) {
      console.warn('❌ Error al solicitar rango de dólar:', err);
    }
  }

  /**
   * Actualiza el valor real de un día específico en la hoja estimativa mediante el proxy de Sheets.
   */
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

  /**
   * Obtiene la serie de totales de saldo por mes para el resumen de todo el año considerando entidades y presupuesto.
   */
  async obtenerTotalesGlobalesDesdeResumenSaldoAnio(
    anio: number,
    force = false,
  ): Promise<{ mes: string; total: number }[]> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      return [];
    }

    const objetoEntidades = this.ValidarRangoEntidades(anio);
    const entidades = Object.keys(objetoEntidades) as (keyof typeof objetoEntidades)[];
    const resultados: { mes: string; total: number }[] = [];
    const meses = this.base;

    await this.asegurarMensualPorAnioRange(
      anio,
      meses,
      '--> storeGoogle.obtenerTotalesGlobalesDesdeResumenSaldoAnio()',
      force,
    );

    for (const mes of meses) {
      let totalMes = 0;
      const mensl = this.getMensualPorMes(anio, mes);
      if (!mensl?.values) continue;

      const celdaPresupuesto = mensl.values[20]?.[10];
      const presupuesto = this.parseMoneda(celdaPresupuesto);

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

  /**
   * Proyecta el total de cuotas futuras restantes por tarjeta/entidad a lo largo de los meses del año.
   */
  async obtenerProyeccionTotalesFuturosAnio(
    anio: number,
    force = false,
  ): Promise<{ mes: string; subtotal: number; desglose: Record<string, number> }[]> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      return [];
    }

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

  /**
   * Separa el nombre del mes si contiene sufijo de año (ej. 'Enero_2026' -> 'Enero').
   */
  private extraerMes(mesCompleto: string): string {
    return mesCompleto.split('_')[0];
  }

  /**
   * Carga los movimientos detallados de un año desde la API o LocalStorage con deduplicación concurrente.
   */
  async cargarDesdeSheetsPorAnio(anio: number, force = false): Promise<void> {
    console.log(`Inicia cargarDesdeSheetsPorAnio(${anio})`);
    const ahora = Date.now();
    const vencimientoMs = this.getCacheTtl(anio);
    const ultimaCarga = this.movimientosTimestamp.get(anio) ?? 0;
    const expirado = ahora - ultimaCarga > vencimientoMs;

    // 1. Hidratación inmediata desde localStorage
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

    // 2. Si ya está cargado en memoria, no ha expirado y no se fuerza recarga, retornar
    if (this.movimientosPorAnio.has(anio) && !expirado && !force) return;

    if (this.movimientosEnCarga.has(anio) && !force) return await this.movimientosEnCarga.get(anio);

    console.log(`📦 [Movimientos] cargando para año ${anio} (force: ${force})`);

    const promesa = (async () => {
      try {
        let movimientos: Movimiento2[] = [];

        // 1. Intentar consultar primero la API REST (Backend unificado)
        try {
          const apiMovs = await firstValueFrom(
            this.movimientosService.listarMovimientos({ year: anio, force }),
          );

          if (apiMovs && apiMovs.length > 0) {
            movimientos = apiMovs.map((m) => {
              const d = new Date(m.fecha);
              // Si la fecha vino en UTC, normalizamos a fecha local plana
              const fechaLocal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
              const deudaVal = m.deudapesos !== undefined && m.deudapesos !== null
                ? Number(m.deudapesos)
                : (m.deuda !== undefined && m.deuda !== null ? Number(m.deuda) : null);
              return {
                fecha: fechaLocal,
                tipo: m.entidad || m.tipo,
                monto: Number(m.monto),
                deudapesos: deudaVal,
              };
            });
            console.log(`⚡ [MovimientosStore] ${movimientos.length} movimientos obtenidos desde la API para ${anio}`);
          }
        } catch (apiErr) {
          console.warn(`⚠️ [MovimientosStore] Falló consulta a la API para ${anio}, recurriendo a Sheets fallback:`, apiErr);
        }

        // 2. Fallback a Google Sheets si la API devolvió 0 movimientos o falló (solo si Google Sheets está activo)
        if (movimientos.length === 0 && this.appConfig.isSheetsActivo(anio)) {
          console.log(`🌐 [MovimientosStore] Consultando Google Sheets fallback para ${anio}...`);
          const clave = 'Movimientos';
          const res = (await firstValueFrom(
            this.sheets.obtenerMensualAnio(anio, clave, 'A1:F3000'),
          )) as { values: string[][] };
          const filas = res.values ?? [];

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
          console.log(`✅ [MovimientosStore] ${movimientos.length} movimientos cargados desde Sheets para ${anio}`);
        }

        this.movimientosPorAnio.set(Number(anio), signal(movimientos));
        this.movimientosTimestamp.set(anio, Date.now());
        this.guardarEnStorage('movimientos', String(anio), movimientos);
        this.cotizacionStore.limpiarCacheAnio(anio);
      } catch (err) {
        console.error(`❌ Error al cargar movimientos para año ${anio}`, err);
      }
    })();

    this.movimientosEnCarga.set(anio, promesa);
    await promesa;
    this.movimientosEnCarga.delete(anio);
    console.log(`Finaliza cargarDesdeSheetsPorAnio(${anio})`);
  }

  /**
   * Limpia toda la caché de LocalStorage y reinicia los mapas de memoria del store.
   */
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

  /**
   * Genera la lista de resumen diario calculando acumulados y diferencias día a día para un año.
   */
  getResumenPorDia(
    anio?: number,
  ): { fecha: string; total: number; diferencia: number; deudaPesos: number }[] {
    const movimientos = anio ? (this.movimientosPorAnio.get(anio)?.() ?? []) : [];
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

  /**
   * Devuelve los movimientos cargados en memoria para un año específico.
   */
  getMovimientosPorAnio(anio: number): Movimiento2[] {
    return this.movimientosPorAnio.get(anio)?.() ?? [];
  }

  /**
   * Normaliza textos a minúsculas sin acentos ni espacios para comparaciones tolerantes.
   */
  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace('$', '')
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }

  // Getters de entidades y encabezados indexados por `${anio}::${mes}`
  getEntidadVisa(anio: number, mes: string): Entidad[] {
    return this.entidadVisaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getHeaderVisa(anio: number, mes: string): string[] {
    return this.headerVisaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getEntidadMasterGalicia(anio: number, mes: string): Entidad[] {
    return this.entidadMasterGaliciaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getHeaderMasterGalicia(anio: number, mes: string): string[] {
    return this.headerMasterGaliciaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getEntidadNaranja(anio: number, mes: string): Entidad[] {
    return this.entidadNaranjaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getHeaderNaranja(anio: number, mes: string): string[] {
    return this.headerNaranjaPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getEntidadBancor(anio: number, mes: string): Entidad[] {
    return this.entidadBancorPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getHeaderBancor(anio: number, mes: string): string[] {
    return this.headerBancorPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getEntidadML(anio: number, mes: string): Entidad[] {
    return this.entidadMLPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getHeaderML(anio: number, mes: string): string[] {
    return this.headerMLPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  getEntidadOtros(anio: number, mes: string): Entidad[] {
    return this.entidadOtrosPorMes.get(`${anio}::${mes}`)?.() ?? [];
  }

  /**
   * Retorna las filas estimativas de un mes y año aguardando la promesa de carga si está en curso.
   */
  async getEstimados(anio: number, hoja: string): Promise<EstimativoRow[]> {
    const clave = `${anio}::${hoja}`;
    const promesa = this.estimativoEnCarga.get(clave);
    if (promesa) {
      await promesa;
    }
    return this.estimativoPorMes.get(clave)?.() ?? [];
  }

  /**
   * Retorna el conjunto concatenado de estimativos para un rango de meses de un año.
   */
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
}
