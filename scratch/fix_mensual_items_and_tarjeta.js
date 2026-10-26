const fs = require('fs');
const path = require('path');

const targetBase = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\1.0\\Front_Control_Gastos\\control-gastos-front';

// 1. mensual-items.service.ts
const mensualItemsServiceContent = `import { Injectable, signal, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { evaluarFormula, ResultadoFormula } from '../utils/formula.util';

export type { ResultadoFormula };

export interface MonthlyItemBackend {
  id: string;
  year: number;
  mes: number;
  entidad: string;
  concepto: string;
  monto: string | number;
  formula?: string | null;
  esCuota: boolean;
  cuotaActual?: number | null;
  totalCuotas?: number | null;
  grupoCuotaId?: string | null;
  orden?: number;
  notas?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthlyItemsResponse {
  year: number;
  mes: number;
  items: MonthlyItemBackend[];
  porEntidad: Record<string, { items: MonthlyItemBackend[]; subtotal: number }>;
  resumen: {
    totalGeneral: number;
    totalNuevasCuotas: number;
    totalUltimasCuotas: number;
    totalRegistros: number;
  };
}

export interface CreateMonthlyItemPayload {
  year: number;
  mes: number;
  entidad: string;
  concepto: string;
  monto?: number;
  montoOFormula: string | number;
  notas?: string;
  autoPropagarCuotas?: boolean;
}

export interface FinancialEntityFront {
  id: string;
  nombre: string;
  tipo: string;
  color: string;
  logoUrl?: string;
  orden: number;
  activo: boolean;
  vigenteDesdeAnio: number;
  vigenteDesdeMes: number;
  vigenteHastaAnio?: number | null;
  vigenteHastaMes?: number | null;
}

export interface CreateFinancialEntityPayload {
  nombre: string;
  tipo?: string;
  color?: string;
  logoUrl?: string;
  vigenteDesdeAnio: number;
  vigenteDesdeMes: number;
  itemsIniciales?: Array<{
    concepto: string;
    montoOFormula: string | number;
    notas?: string;
    autoPropagarCuotas?: boolean;
  }>;
}

export interface UpdateMonthlyItemPayload {
  concepto?: string;
  montoOFormula?: string | number;
  entidad?: string;
  notas?: string;
  actualizarSerieCompleta?: boolean;
}

const STORAGE_ITEMS_KEY = 'control_gastos_mensual_items_1_0';
const STORAGE_ENTITIES_KEY = 'control_gastos_entities_1_0';

const DEFAULT_ENTITIES: FinancialEntityFront[] = [
  { id: 'visa', nombre: 'Visa', tipo: 'CREDIT', color: '#1a1f71', logoUrl: 'assets/logos/visa.svg', orden: 1, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'master', nombre: 'Master Galicia', tipo: 'CREDIT', color: '#ff5f00', logoUrl: 'assets/logos/mastercard.svg', orden: 2, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'bancor', nombre: 'Bancor', tipo: 'CREDIT', color: '#005596', logoUrl: 'assets/logos/bancor.png', orden: 3, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'naranja', nombre: 'Naranja', tipo: 'CREDIT', color: '#ff6600', logoUrl: 'assets/logos/naranja.png', orden: 4, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'del_sol', nombre: 'Banco del Sol', tipo: 'BANK', color: '#ff9900', logoUrl: 'assets/logos/bancodelsol.png', orden: 5, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'efectivo', nombre: 'Efectivo', tipo: 'CASH', color: '#10b981', orden: 6, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'mercadopago', nombre: 'Mercado Pago', tipo: 'FINTECH', color: '#009ee3', logoUrl: 'assets/logos/mercadopago.svg', orden: 7, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
  { id: 'otros', nombre: 'Otros', tipo: 'OTHER', color: '#64748b', orden: 8, activo: true, vigenteDesdeAnio: 2020, vigenteDesdeMes: 1 },
];

@Injectable({
  providedIn: 'root',
})
export class MensualItemsService {
  private itemsSignal = signal<MonthlyItemBackend[]>([]);
  private entitiesSignal = signal<FinancialEntityFront[]>(DEFAULT_ENTITIES);

  constructor() {
    this.cargarStorage();
  }

  private cargarStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const rawItems = localStorage.getItem(STORAGE_ITEMS_KEY);
      if (rawItems) {
        this.itemsSignal.set(JSON.parse(rawItems));
      }
      const rawEntities = localStorage.getItem(STORAGE_ENTITIES_KEY);
      if (rawEntities) {
        this.entitiesSignal.set(JSON.parse(rawEntities));
      }
    } catch (e) {
      console.warn('Error al cargar items de mensual desde localStorage', e);
    }
  }

  private guardarStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(this.itemsSignal()));
      localStorage.setItem(STORAGE_ENTITIES_KEY, JSON.stringify(this.entitiesSignal()));
    } catch (e) {
      console.warn('Error al guardar items de mensual en localStorage', e);
    }
  }

  getEntidadesVigentes(year: number, mes: number): Observable<FinancialEntityFront[]> {
    const list = this.entitiesSignal().filter((e) => {
      const desde = e.vigenteDesdeAnio * 100 + e.vigenteDesdeMes;
      const actual = year * 100 + mes;
      if (actual < desde) return false;
      if (e.vigenteHastaAnio && e.vigenteHastaMes) {
        const hasta = e.vigenteHastaAnio * 100 + e.vigenteHastaMes;
        if (actual > hasta) return false;
      }
      return e.activo;
    });
    return of(list);
  }

  crearEntidad(payload: CreateFinancialEntityPayload): Observable<{ message: string; entidad: FinancialEntityFront; itemsCreadosCount: number }> {
    const nueva: FinancialEntityFront = {
      id: 'ent_' + Date.now(),
      nombre: payload.nombre,
      tipo: payload.tipo || 'OTHER',
      color: payload.color || '#4b5896',
      logoUrl: payload.logoUrl,
      orden: this.entitiesSignal().length + 1,
      activo: true,
      vigenteDesdeAnio: payload.vigenteDesdeAnio,
      vigenteDesdeMes: payload.vigenteDesdeMes,
    };
    this.entitiesSignal.update((ents) => [...ents, nueva]);
    this.guardarStorage();
    return of({ message: 'Entidad creada exitosamente', entidad: nueva, itemsCreadosCount: 0 });
  }

  darDeBajaEntidad(id: string, year: number, mes: number): Observable<{ message: string; itemsBorradosCount: number }> {
    this.entitiesSignal.update((ents) =>
      ents.map((e) => {
        if (e.id === id || e.nombre.toLowerCase() === id.toLowerCase()) {
          return { ...e, vigenteHastaAnio: year, vigenteHastaMes: mes, activo: false };
        }
        return e;
      })
    );
    this.guardarStorage();
    return of({ message: 'Entidad dada de baja correctamente', itemsBorradosCount: 0 });
  }

  getItems(year: number, mes?: number, entidad?: string): Observable<MonthlyItemsResponse> {
    const all = this.itemsSignal().filter((it) => {
      if (it.year !== year) return false;
      if (mes !== undefined && mes !== null && it.mes !== mes) return false;
      if (entidad && it.entidad.toLowerCase() !== entidad.toLowerCase()) return false;
      return true;
    });

    const porEntidad: Record<string, { items: MonthlyItemBackend[]; subtotal: number }> = {};
    let totalGeneral = 0;
    let totalNuevas = 0;
    let totalUltimas = 0;

    for (const it of all) {
      const ent = it.entidad || 'Otros';
      if (!porEntidad[ent]) {
        porEntidad[ent] = { items: [], subtotal: 0 };
      }
      porEntidad[ent].items.push(it);
      const m = Number(it.monto) || 0;
      porEntidad[ent].subtotal += m;
      totalGeneral += m;

      if (it.esCuota && it.cuotaActual === 1) totalNuevas += m;
      if (it.esCuota && it.totalCuotas && it.cuotaActual === it.totalCuotas) totalUltimas += m;
    }

    return of({
      year,
      mes: mes ?? 0,
      items: all,
      porEntidad,
      resumen: {
        totalGeneral,
        totalNuevasCuotas: totalNuevas,
        totalUltimasCuotas: totalUltimas,
        totalRegistros: all.length,
      },
    });
  }

  createItem(payload: CreateMonthlyItemPayload): Observable<{ message: string; items: MonthlyItemBackend[]; data: MonthlyItemBackend; success: boolean }> {
    const evaluated = this.evaluarFormulaLocal(payload.montoOFormula);
    const montoFinal = evaluated.valido ? evaluated.valor : Number(payload.monto) || 0;

    const cuotaMatch = payload.concepto.match(/\\((\\d+)\\/(\\d+)\\)/);
    const cuotaActual = cuotaMatch ? parseInt(cuotaMatch[1], 10) : null;
    const totalCuotas = cuotaMatch ? parseInt(cuotaMatch[2], 10) : null;
    const esCuota = !!(cuotaActual && totalCuotas);

    const nuevo: MonthlyItemBackend = {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      year: payload.year,
      mes: payload.mes,
      entidad: payload.entidad,
      concepto: payload.concepto,
      monto: montoFinal,
      formula: evaluated.valido && payload.montoOFormula ? String(payload.montoOFormula) : null,
      esCuota,
      cuotaActual,
      totalCuotas,
      notas: payload.notas || null,
      createdAt: new Date().toISOString(),
    };

    const nuevos: MonthlyItemBackend[] = [nuevo];

    // Auto-propagación de cuotas futuras si aplica
    if (payload.autoPropagarCuotas && esCuota && cuotaActual! < totalCuotas!) {
      let curYear = payload.year;
      let curMes = payload.mes;
      const baseConcepto = payload.concepto.replace(/\\(\\d+\\/\\d+\\)/, '').trim();

      for (let c = cuotaActual! + 1; c <= totalCuotas!; c++) {
        curMes++;
        if (curMes > 12) {
          curMes = 1;
          curYear++;
        }
        nuevos.push({
          id: 'item_' + Date.now() + '_' + c + '_' + Math.random().toString(36).substring(2, 6),
          year: curYear,
          mes: curMes,
          entidad: payload.entidad,
          concepto: \`\${baseConcepto} (\${c}/\${totalCuotas})\`,
          monto: montoFinal,
          formula: nuevo.formula,
          esCuota: true,
          cuotaActual: c,
          totalCuotas,
          notas: payload.notas || null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    this.itemsSignal.update((items) => [...items, ...nuevos]);
    this.guardarStorage();

    return of({
      message: 'Ítem guardado exitosamente',
      items: nuevos,
      data: nuevo,
      success: true,
    });
  }

  createItemsBatch(payload: {
    year: number;
    mes: number;
    entidad: string;
    items: Array<{
      concepto: string;
      montoOFormula: string | number;
      notas?: string;
      autoPropagarCuotas?: boolean;
    }>;
  }): Observable<{ message: string; items: MonthlyItemBackend[]; success: boolean; data: MonthlyItemBackend[] }> {
    const creados: MonthlyItemBackend[] = [];
    for (const it of payload.items) {
      const evaluated = this.evaluarFormulaLocal(it.montoOFormula);
      const montoFinal = evaluated.valido ? evaluated.valor : 0;
      const cuotaMatch = it.concepto.match(/\\((\\d+)\\/(\\d+)\\)/);
      const cuotaActual = cuotaMatch ? parseInt(cuotaMatch[1], 10) : null;
      const totalCuotas = cuotaMatch ? parseInt(cuotaMatch[2], 10) : null;

      creados.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        year: payload.year,
        mes: payload.mes,
        entidad: payload.entidad,
        concepto: it.concepto,
        monto: montoFinal,
        formula: evaluated.valido ? String(it.montoOFormula) : null,
        esCuota: !!(cuotaActual && totalCuotas),
        cuotaActual,
        totalCuotas,
        notas: it.notas || null,
        createdAt: new Date().toISOString(),
      });
    }

    this.itemsSignal.update((items) => [...items, ...creados]);
    this.guardarStorage();

    return of({
      message: \`Se crearon \${creados.length} ítems exitosamente\`,
      items: creados,
      data: creados,
      success: true,
    });
  }

  getPreviewAnterior(year: number, mes: number, entidad: string): Observable<{
    tieneItemsActuales: boolean;
    sourceYear?: number;
    sourceMes?: number;
    items: Array<{
      concepto: string;
      montoOFormula: string;
      montoCalculado: number;
      esCuota?: boolean;
      cuotaActual?: number;
      totalCuotas?: number;
      notas?: string;
    }>;
  }> {
    const actuales = this.itemsSignal().filter((it) => it.year === year && it.mes === mes && it.entidad.toLowerCase() === entidad.toLowerCase());
    let sourceYear = year;
    let sourceMes = mes - 1;
    if (sourceMes < 1) {
      sourceMes = 12;
      sourceYear--;
    }

    const anteriores = this.itemsSignal().filter((it) => it.year === sourceYear && it.mes === sourceMes && it.entidad.toLowerCase() === entidad.toLowerCase());
    const sugeridos = anteriores
      .filter((it) => {
        if (!it.esCuota) return true;
        return (it.cuotaActual || 0) < (it.totalCuotas || 0);
      })
      .map((it) => {
        let concepto = it.concepto;
        let cActual = it.cuotaActual;
        if (it.esCuota && it.cuotaActual && it.totalCuotas) {
          cActual = it.cuotaActual + 1;
          concepto = it.concepto.replace(/\\(\\d+\\/\\d+\\)/, \`(\${cActual}/\${it.totalCuotas})\`);
        }
        return {
          concepto,
          montoOFormula: it.formula || String(it.monto),
          montoCalculado: Number(it.monto) || 0,
          esCuota: it.esCuota,
          cuotaActual: cActual || undefined,
          totalCuotas: it.totalCuotas || undefined,
          notas: it.notas || undefined,
        };
      });

    return of({
      tieneItemsActuales: actuales.length > 0,
      sourceYear,
      sourceMes,
      items: sugeridos,
    });
  }

  updateItem(id: string, payload: UpdateMonthlyItemPayload): Observable<{ message: string; item: MonthlyItemBackend; success: boolean; data: MonthlyItemBackend }> {
    let actualizado: MonthlyItemBackend | null = null;
    this.itemsSignal.update((items) =>
      items.map((it) => {
        if (it.id === id) {
          const evalRes = payload.montoOFormula !== undefined ? this.evaluarFormulaLocal(payload.montoOFormula) : null;
          actualizado = {
            ...it,
            concepto: payload.concepto ?? it.concepto,
            entidad: payload.entidad ?? it.entidad,
            notas: payload.notas !== undefined ? payload.notas : it.notas,
            monto: evalRes && evalRes.valido ? evalRes.valor : it.monto,
            formula: evalRes && evalRes.valido && payload.montoOFormula ? String(payload.montoOFormula) : it.formula,
            updatedAt: new Date().toISOString(),
          };
          return actualizado;
        }
        return it;
      })
    );
    this.guardarStorage();
    return of({
      message: 'Ítem actualizado exitosamente',
      item: actualizado!,
      data: actualizado!,
      success: true,
    });
  }

  deleteItem(id: string, borrarSerieCompleta = false, eliminarHaciaElFuturo = false): Observable<{ message: string; borradosCount: number }> {
    let borrados = 0;
    this.itemsSignal.update((items) => {
      const itemToDelete = items.find((i) => i.id === id);
      if (!itemToDelete) return items;

      if (!borrarSerieCompleta && !eliminarHaciaElFuturo) {
        borrados = 1;
        return items.filter((i) => i.id !== id);
      }

      const filtered = items.filter((i) => {
        if (i.id === id) return false;
        if (borrarSerieCompleta && itemToDelete.esCuota && i.esCuota) {
          const base1 = itemToDelete.concepto.replace(/\\(\\d+\\/\\d+\\)/, '').trim();
          const base2 = i.concepto.replace(/\\(\\d+\\/\\d+\\)/, '').trim();
          if (base1 === base2 && i.entidad === itemToDelete.entidad) return false;
        }
        if (eliminarHaciaElFuturo && itemToDelete.esCuota && i.esCuota) {
          const base1 = itemToDelete.concepto.replace(/\\(\\d+\\/\\d+\\)/, '').trim();
          const base2 = i.concepto.replace(/\\(\\d+\\/\\d+\\)/, '').trim();
          const p1 = itemToDelete.year * 100 + itemToDelete.mes;
          const p2 = i.year * 100 + i.mes;
          if (base1 === base2 && i.entidad === itemToDelete.entidad && p2 >= p1) return false;
        }
        return true;
      });

      borrados = items.length - filtered.length;
      return filtered;
    });

    this.guardarStorage();
    return of({ message: \`Se eliminaron \${borrados} registros\`, borradosCount: borrados });
  }

  evaluarFormulaLocal(input: string | number): ResultadoFormula {
    return evaluarFormula(input);
  }

  checkDbHealth(): Observable<{ status: string; db: string; message: string }> {
    return of({ status: 'ok', db: 'google-sheets-local', message: 'Modo Frontend Google Sheets activo' });
  }

  importarResumenBatch(payload: any): Observable<any> {
    return of({
      success: true,
      message: 'Resumen importado localmente',
      agregados: payload.movements ? payload.movements.length : 0,
      informativosGuardados: 0,
      omitidosPorDuplicado: 0,
      itemsAgregados: [],
      itemsOmitidos: [],
      pagosInformativos: [],
    });
  }

  getStatementPayment(year: number, mes: number, entidad: string): Observable<any> {
    return of({ success: true, payment: null });
  }
}
`;

fs.writeFileSync(
  path.join(targetBase, 'src', 'app', 'services', 'mensual-items.service.ts'),
  mensualItemsServiceContent,
  'utf8'
);

// 2. tarjeta-entidad.component.ts: Fix authService to inject AuthService
const tarjetaEntidadPath = path.join(
  targetBase,
  'src',
  'app',
  'pages',
  'mensual',
  'tarjeta-entidad',
  'tarjeta-entidad.component.ts'
);
let tarjetaContent = fs.readFileSync(tarjetaEntidadPath, 'utf8');

// Replace "// AuthService removed" with import { AuthService } from '../../../services/auth.service';
if (!tarjetaContent.includes("import { AuthService }")) {
  tarjetaContent = tarjetaContent.replace(
    "// AuthService removed",
    "import { AuthService } from '../../../services/auth.service';"
  );
}
// Replace "public authService = { isLector: () => false };" with "public authService = inject(AuthService);"
tarjetaContent = tarjetaContent.replace(
  "public authService = { isLector: () => false };",
  "public authService = inject(AuthService);"
);

fs.writeFileSync(tarjetaEntidadPath, tarjetaContent, 'utf8');

console.log('fix_mensual_items_and_tarjeta completed successfully.');
