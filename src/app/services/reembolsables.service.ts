import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, firstValueFrom } from 'rxjs';
import { GoogleSheetsService } from './google.sheets.service';
import { MovimientosService, MovementBackendItem } from './movimientos.service';
import { AppConfigService } from './app-config.service';
import { MensualItemsService, MonthlyItemBackend } from './mensual-items.service';

export interface GastoReembolsableItem {
  id?: string;
  concepto: string;
  monto: number;
  formula?: string;
  tipo: 'SERVICIO' | 'APORTE';
}

export interface ReembolsablesMesData {
  mes: string;
  year: number;
  existeEnPlanilla: boolean;
  items: GastoReembolsableItem[];
  totalServicios: number;
  totalConAlarma: number;
  nombreAporteTercero: string;
  montoAporteTercero: number;
  saldoNetoDevolver: number;
  totalReintegrado: number;
  saldoPendienteReintegro: number;
  estadoReintegro: 'PENDIENTE' | 'REINTEGRADO_PARCIAL' | 'REINTEGRADO_TOTAL';
  reintegrosRegistrados: MovementBackendItem[];
  itemAporte?: GastoReembolsableItem;
}

export interface RegistrarReintegroPayload {
  year: number;
  mes: string;
  monto: number;
  cuentaDestino: string;
  fecha: string;
  concepto: string;
  descripcion?: string;
}

export interface ModalItemReembolsableInfo {
  modo: 'CREAR' | 'EDITAR';
  year: number;
  mesNumero: number;
  mesNombre: string;
  item?: GastoReembolsableItem;
  tipoPorDefecto?: 'SERVICIO' | 'APORTE';
  todosLosItemsActuales: GastoReembolsableItem[];
}

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parseMonto(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val)
    .replace('$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

@Injectable({ providedIn: 'root' })
export class ReembolsablesService {
  private sheetsService = inject(GoogleSheetsService);
  private movimientosService = inject(MovimientosService);
  private configService = inject(AppConfigService);
  private mensualItemsService = inject(MensualItemsService);

  // Control reactivo de modales a nivel raíz
  modalReintegroData = signal<ReembolsablesMesData | null>(null);
  modalItemData = signal<ModalItemReembolsableInfo | null>(null);

  abrirModalReintegro(data: ReembolsablesMesData): void {
    this.modalReintegroData.set(data);
  }

  cerrarModalReintegro(): void {
    this.modalReintegroData.set(null);
  }

  abrirModalItem(info: ModalItemReembolsableInfo): void {
    this.modalItemData.set(info);
  }

  cerrarModalItem(): void {
    this.modalItemData.set(null);
  }

  /**
   * Obtiene la matriz de gastos reembolsables para un mes y año determinado.
   * Prioriza la base de datos (MonthlyItem entidad 'Reembolsables').
   * Si no hay ítems en BD, lee de Google Sheets Saldo!S45:W58 si está activo.
   */
  getReembolsablesMes(year: number, mes: string): Observable<ReembolsablesMesData> {
    const mesIdx = MESES_NOMBRES.findIndex(
      (m) => m.toLowerCase() === mes.toLowerCase().trim()
    );
    const mesNumero = mesIdx !== -1 ? mesIdx + 1 : 10;

    return from(this.cargarReembolsables(year, mes, mesNumero));
  }

  private async cargarReembolsables(
    year: number,
    mes: string,
    mesNumero: number
  ): Promise<ReembolsablesMesData> {
    // 1. Primero consultar en base de datos si ya existen registros personalizados
    try {
      const dbRes = await firstValueFrom(
        this.mensualItemsService.getItems(year, mesNumero, 'Reembolsables')
      );
      if (dbRes && dbRes.items && dbRes.items.length > 0) {
        return await this.buildFromDbItems(dbRes.items, year, mes, mesNumero);
      }
    } catch {
      // Si la API falla, continuar al fallback
    }

    // 2. Si no hay ítems en BD y Google Sheets está activo, consultar planilla
    if (this.configService.isSheetsActivo(year)) {
      return await this.fetchFromSheets(year, mes, mesNumero);
    }

    // 3. Fallback vacío para año en BD sin ítems cargados
    return await this.fetchEmptyFallback(year, mes, mesNumero);
  }

  private async buildFromDbItems(
    dbItems: MonthlyItemBackend[],
    year: number,
    mes: string,
    mesNumero: number
  ): Promise<ReembolsablesMesData> {
    const items: GastoReembolsableItem[] = [];
    let itemAporte: GastoReembolsableItem | undefined;

    for (const it of dbItems) {
      const isAporte = it.notas === 'APORTE';
      const itemParsed: GastoReembolsableItem = {
        id: it.id,
        concepto: it.concepto,
        monto: Number(it.monto) || 0,
        formula: it.formula || undefined,
        tipo: isAporte ? 'APORTE' : 'SERVICIO',
      };

      if (isAporte) {
        itemAporte = itemParsed;
      } else {
        items.push(itemParsed);
      }
    }

    const totalServicios = items.reduce((acc, it) => acc + it.monto, 0);
    const montoAporteTercero = itemAporte ? itemAporte.monto : 0;
    const nombreAporteTercero = itemAporte ? itemAporte.concepto : 'Mamá';
    const saldoNetoDevolver = Math.max(0, totalServicios - montoAporteTercero);

    const baseData: ReembolsablesMesData = {
      mes,
      year,
      existeEnPlanilla: true,
      items,
      totalServicios,
      totalConAlarma: totalServicios,
      nombreAporteTercero,
      montoAporteTercero,
      saldoNetoDevolver,
      totalReintegrado: 0,
      saldoPendienteReintegro: montoAporteTercero,
      estadoReintegro: 'PENDIENTE',
      reintegrosRegistrados: [],
      itemAporte,
    };

    return await this.completarConReintegros(baseData, year, mesNumero);
  }

  private async fetchFromSheets(
    year: number,
    mes: string,
    mesNumero: number
  ): Promise<ReembolsablesMesData> {
    let rows: (string | number)[][] = [];

    try {
      const res = await firstValueFrom(
        this.sheetsService.obtenerMensualAnio(year, 'Saldo', 'S45:Z58')
      );
      if (res && res.values) {
        rows = res.values;
      }
    } catch (err) {
      console.warn(`[ReembolsablesService] No se pudo leer Saldo!S45:Z58 para ${year}:`, err);
    }

    const dataParsed = this.parseReembolsablesMatrix(rows, mes, year);
    return await this.completarConReintegros(dataParsed, year, mesNumero);
  }

  private async fetchEmptyFallback(
    year: number,
    mes: string,
    mesNumero: number
  ): Promise<ReembolsablesMesData> {
    const baseData: ReembolsablesMesData = {
      mes,
      year,
      existeEnPlanilla: false,
      items: [
        { concepto: 'afip', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'GMS', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'luz', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'agua', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'internet', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'claro', monto: 0, tipo: 'SERVICIO' },
        { concepto: 'inst alarma', monto: 0, tipo: 'SERVICIO' },
      ],
      totalServicios: 0,
      totalConAlarma: 0,
      nombreAporteTercero: 'Mamá',
      montoAporteTercero: 0,
      saldoNetoDevolver: 0,
      totalReintegrado: 0,
      saldoPendienteReintegro: 0,
      estadoReintegro: 'PENDIENTE',
      reintegrosRegistrados: [],
    };
    return await this.completarConReintegros(baseData, year, mesNumero);
  }

  private async completarConReintegros(
    data: ReembolsablesMesData,
    year: number,
    mesNumero: number
  ): Promise<ReembolsablesMesData> {
    try {
      const movs = await firstValueFrom(
        this.movimientosService.listarMovimientos({
          year,
          mes: mesNumero,
          tipo: 'INGRESO',
          categoria: 'Reintegro',
        })
      );

      const reintegros = (movs || []).filter(
        (m) =>
          m.categoria?.toLowerCase() === 'reintegro' ||
          m.subcategoria?.toLowerCase().includes('devolver') ||
          m.descripcion?.toLowerCase().includes('reintegro') ||
          m.descripcion?.toLowerCase().includes('mamá') ||
          m.descripcion?.toLowerCase().includes('mama')
      );

      const totalReintegrado = reintegros.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
      const saldoPendiente = Math.max(0, data.montoAporteTercero - totalReintegrado);

      let estado: 'PENDIENTE' | 'REINTEGRADO_PARCIAL' | 'REINTEGRADO_TOTAL' = 'PENDIENTE';
      if (data.montoAporteTercero > 0) {
        if (totalReintegrado >= data.montoAporteTercero - 1) {
          estado = 'REINTEGRADO_TOTAL';
        } else if (totalReintegrado > 0) {
          estado = 'REINTEGRADO_PARCIAL';
        }
      }

      data.totalReintegrado = totalReintegrado;
      data.saldoPendienteReintegro = saldoPendiente;
      data.estadoReintegro = estado;
      data.reintegrosRegistrados = reintegros;
    } catch {}

    return data;
  }

  /**
   * Parsea la matriz de filas S45:Z58 para el mes indicado
   */
  private parseReembolsablesMatrix(
    rows: (string | number)[][],
    mesObjetivo: string,
    year: number
  ): ReembolsablesMesData {
    if (!rows || rows.length === 0) {
      return {
        mes: mesObjetivo,
        year,
        existeEnPlanilla: false,
        items: [],
        totalServicios: 0,
        totalConAlarma: 0,
        nombreAporteTercero: 'Mamá',
        montoAporteTercero: 0,
        saldoNetoDevolver: 0,
        totalReintegrado: 0,
        saldoPendienteReintegro: 0,
        estadoReintegro: 'PENDIENTE',
        reintegrosRegistrados: [],
      };
    }

    const headerRow = rows[0] || [];
    let colIndex = -1;
    const mesLimpio = mesObjetivo.toLowerCase().trim();

    for (let c = 1; c < headerRow.length; c++) {
      const headerVal = String(headerRow[c] || '').toLowerCase().trim();
      if (
        headerVal === mesLimpio ||
        headerVal.startsWith(mesLimpio) ||
        mesLimpio.startsWith(headerVal)
      ) {
        colIndex = c;
        break;
      }
    }

    const items: GastoReembolsableItem[] = [];
    let totalServicios = 0;
    let totalConAlarma = 0;
    let montoAporteTercero = 0;
    let nombreAporteTercero = 'Mamá';
    let saldoNetoDevolver = 0;
    let itemAporte: GastoReembolsableItem | undefined;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const concepto = String(row[0] || '').trim();
      const valCelda = colIndex !== -1 ? row[colIndex] : null;
      const monto = parseMonto(valCelda);

      if (r === 8 || (r >= 7 && r <= 9 && concepto === '')) {
        totalServicios = monto;
      } else if (r === 10 || (r >= 9 && r <= 11 && concepto === '')) {
        totalConAlarma = monto;
      } else if (
        concepto.toLowerCase().includes('mamá') ||
        concepto.toLowerCase().includes('mama') ||
        r === 11
      ) {
        if (concepto) nombreAporteTercero = concepto;
        montoAporteTercero = monto;
        itemAporte = {
          concepto: nombreAporteTercero,
          monto: montoAporteTercero,
          tipo: 'APORTE',
        };
      } else if (r === 12 || (r >= 11 && concepto === '')) {
        saldoNetoDevolver = monto;
      } else if (concepto) {
        items.push({ concepto, monto, tipo: 'SERVICIO' });
      }
    }

    if (!totalServicios && items.length > 0) {
      totalServicios = items.reduce((acc, it) => acc + it.monto, 0);
    }
    if (!totalConAlarma) {
      totalConAlarma = totalServicios;
    }
    if (!saldoNetoDevolver && montoAporteTercero > 0) {
      saldoNetoDevolver = Math.max(0, totalConAlarma - montoAporteTercero);
    }

    return {
      mes: mesObjetivo,
      year,
      existeEnPlanilla: colIndex !== -1,
      items,
      totalServicios,
      totalConAlarma,
      nombreAporteTercero,
      montoAporteTercero,
      saldoNetoDevolver,
      totalReintegrado: 0,
      saldoPendienteReintegro: montoAporteTercero,
      estadoReintegro: 'PENDIENTE',
      reintegrosRegistrados: [],
      itemAporte,
    };
  }

  /**
   * Guarda o actualiza un ítem reembolsable (Servicio o Aporte) en la base de datos.
   * Si los ítems existentes provenían de Google Sheets sin ID, asegura su persistencia inicial.
   */
  async guardarItem(
    info: ModalItemReembolsableInfo,
    concepto: string,
    montoOFormula: string | number,
    tipo: 'SERVICIO' | 'APORTE'
  ): Promise<void> {
    const { year, mesNumero, item, modo, todosLosItemsActuales } = info;

    // Caso 1: Editando un ítem que ya tiene ID en BD
    if (modo === 'EDITAR' && item && item.id) {
      await firstValueFrom(
        this.mensualItemsService.updateItem(item.id, {
          concepto,
          montoOFormula,
          notas: tipo,
        })
      );
      return;
    }

    // Caso 2: Editando o Creando cuando los ítems aún no estaban persistidos en BD (vienen de Sheets)
    const itemsSinId = todosLosItemsActuales.filter((it) => !it.id);
    if (itemsSinId.length > 0) {
      // Migrar los ítems existentes a la base de datos
      for (const it of todosLosItemsActuales) {
        if (modo === 'EDITAR' && item && it.concepto === item.concepto && it.tipo === item.tipo) {
          // Guardar con los valores nuevos editados
          await firstValueFrom(
            this.mensualItemsService.createItem({
              year,
              mes: mesNumero,
              entidad: 'Reembolsables',
              concepto,
              montoOFormula,
              notas: tipo,
            })
          );
        } else {
          // Guardar con su valor actual
          await firstValueFrom(
            this.mensualItemsService.createItem({
              year,
              mes: mesNumero,
              entidad: 'Reembolsables',
              concepto: it.concepto,
              montoOFormula: it.formula || it.monto,
              notas: it.tipo,
            })
          );
        }
      }

      // Si estábamos creando uno nuevo, agregarlo ahora
      if (modo === 'CREAR') {
        await firstValueFrom(
          this.mensualItemsService.createItem({
            year,
            mes: mesNumero,
            entidad: 'Reembolsables',
            concepto,
            montoOFormula,
            notas: tipo,
          })
        );
      }
      return;
    }

    // Caso 3: Creación estándar en BD
    await firstValueFrom(
      this.mensualItemsService.createItem({
        year,
        mes: mesNumero,
        entidad: 'Reembolsables',
        concepto,
        montoOFormula,
        notas: tipo,
      })
    );
  }

  /**
   * Elimina un ítem reembolsable de la base de datos.
   */
  async eliminarItem(
    item: GastoReembolsableItem,
    year: number,
    mesNumero: number,
    todosLosItems: GastoReembolsableItem[]
  ): Promise<void> {
    if (item.id) {
      await firstValueFrom(this.mensualItemsService.deleteItem(item.id));
      return;
    }

    // Si no tenía ID en BD (provenía de Sheets), persistir los restantes omitiendo este
    const restantes = todosLosItems.filter(
      (it) => !(it.concepto === item.concepto && it.tipo === item.tipo)
    );
    for (const it of restantes) {
      await firstValueFrom(
        this.mensualItemsService.createItem({
          year,
          mes: mesNumero,
          entidad: 'Reembolsables',
          concepto: it.concepto,
          montoOFormula: it.formula || it.monto,
          notas: it.tipo,
        })
      );
    }
  }

  /**
   * Registra un movimiento contable de devolución / reintegro (tipo: INGRESO)
   */
  registrarReintegro(payload: RegistrarReintegroPayload): Observable<any> {
    const dateObj = new Date(payload.fecha);
    const fechaIso = !isNaN(dateObj.getTime())
      ? payload.fecha
      : new Date().toISOString().split('T')[0];

    const body = {
      fecha: fechaIso,
      monto: Number(payload.monto),
      tipo: 'INGRESO',
      categoria: 'Reintegro',
      subcategoria: 'Gastos a Devolver',
      entidad: payload.cuentaDestino,
      moneda: 'ARS',
      descripcion:
        payload.descripcion ||
        `Reintegro ${payload.concepto} (${payload.mes} ${payload.year})`,
    };

    return this.movimientosService.crearMovimiento(body);
  }
}
