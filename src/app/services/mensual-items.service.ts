import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
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

@Injectable({
  providedIn: 'root',
})
export class MensualItemsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/mensual`;

  /**
   * Obtiene las entidades financieras vigentes para un año y mes determinados.
   */
  getEntidadesVigentes(year: number, mes: number): Observable<FinancialEntityFront[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('mes', mes.toString());
    return this.http.get<FinancialEntityFront[]>(`${this.apiUrl}/entidades`, { params });
  }

  /**
   * Crea una nueva entidad financiera que rige a partir de un mes y año dados.
   */
  crearEntidad(payload: CreateFinancialEntityPayload): Observable<{ message: string; entidad: FinancialEntityFront; itemsCreadosCount: number }> {
    return this.http.post<{ message: string; entidad: FinancialEntityFront; itemsCreadosCount: number }>(`${this.apiUrl}/entidades`, payload);
  }

  /**
   * Da de baja una entidad financiera a partir de un mes y año específicos.
   * Regla de Oro: Se preserva intacta en los meses anteriores y se elimina hacia el futuro.
   */
  darDeBajaEntidad(id: string, year: number, mes: number): Observable<{ message: string; itemsBorradosCount: number }> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('mes', mes.toString());
    return this.http.delete<{ message: string; itemsBorradosCount: number }>(`${this.apiUrl}/entidades/${id}`, { params });
  }

  /**
   * Obtiene todos los ítems mensuales para un año y mes determinados.
   */
  getItems(year: number, mes?: number, entidad?: string): Observable<MonthlyItemsResponse> {
    let params = new HttpParams().set('year', year.toString());
    if (mes !== undefined && mes !== null) {
      params = params.set('mes', mes.toString());
    }
    if (entidad) {
      params = params.set('entidad', entidad);
    }
    return this.http.get<MonthlyItemsResponse>(`${this.apiUrl}/items`, { params });
  }

  /**
   * Registra un nuevo ítem o cuota con auto-propagación y soporte de fórmulas.
   */
  createItem(payload: CreateMonthlyItemPayload): Observable<{ message: string; items: MonthlyItemBackend[] }> {
    return this.http.post<{ message: string; items: MonthlyItemBackend[] }>(`${this.apiUrl}/items`, payload);
  }

  /**
   * Registra múltiples ítems en lote para una entidad mensual.
   */
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
  }): Observable<{ message: string; items: MonthlyItemBackend[] }> {
    return this.http.post<{ message: string; items: MonthlyItemBackend[] }>(`${this.apiUrl}/items/batch`, payload);
  }

  /**
   * Obtiene la vista previa de ítems sugeridos desde el mes anterior para una entidad específica,
   * indicando si el mes actual ya cuenta con registros cargados y descartando cuotas finalizadas.
   */
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
    const params = new HttpParams()
      .set('year', year.toString())
      .set('mes', mes.toString())
      .set('entidad', entidad);
    return this.http.get<any>(`${this.apiUrl}/items/preview-anterior`, { params });
  }

  /**
   * Actualiza un ítem existente.
   */
  updateItem(id: string, payload: UpdateMonthlyItemPayload): Observable<{ message: string; item: MonthlyItemBackend }> {
    return this.http.put<{ message: string; item: MonthlyItemBackend }>(`${this.apiUrl}/items/${id}`, payload);
  }

  /**
   * Elimina un ítem mensual o la serie completa de cuotas, con opción de dar de baja hacia el futuro.
   */
  deleteItem(id: string, borrarSerieCompleta = false, eliminarHaciaElFuturo = false): Observable<{ message: string; borradosCount: number }> {
    const params = new HttpParams()
      .set('borrarSerieCompleta', borrarSerieCompleta.toString())
      .set('eliminarHaciaElFuturo', eliminarHaciaElFuturo.toString());
    return this.http.delete<{ message: string; borradosCount: number }>(`${this.apiUrl}/items/${id}`, { params });
  }

  /**
   * Evalúa de forma interactiva una fórmula en cliente para feedback en vivo.
   */
  evaluarFormulaLocal(input: string | number): ResultadoFormula {
    return evaluarFormula(input);
  }

  /**
   * Verifica la conectividad y disponibilidad de la base de datos PostgreSQL.
   * Detecta si la instancia en Google Cloud SQL está en modo pausa para ahorro de costos.
   */
  checkDbHealth(): Observable<{ status: string; db: string; message: string }> {
    return this.http.get<{ status: string; db: string; message: string }>(`${environment.apiUrl}/health/db`);
  }

  /**
   * Importa movimientos de un resumen bancario por lotes a la base de datos con:
   * 1. Aislamiento automático de pagos previos (guardados en statement_payment_reports)
   * 2. Validación antiduplicados frente a ítems ya existentes en el mes/año/entidad
   * 3. Creación limpia de compras y cuotas nuevas
   */
  importarResumenBatch(payload: {
    year: number;
    mes: number;
    entidad: string;
    movements: Array<{
      fecha?: string;
      referencia: string;
      cuotas?: string;
      pesos?: number | null;
      dolares?: number | null;
    }>;
  }): Observable<{
    success: boolean;
    message: string;
    agregados: number;
    informativosGuardados: number;
    omitidosPorDuplicado: number;
    itemsAgregados: MonthlyItemBackend[];
    itemsOmitidos: Array<{ concepto: string; fecha?: string; monto: any; motivo: string }>;
    pagosInformativos: any[];
  }> {
    return this.http.post<any>(`${this.apiUrl}/items/importar-resumen`, payload);
  }

  /**
   * Consulta el último pago de resumen reportado para la entidad en ese período (dato puramente informativo).
   */
  getStatementPayment(
    year: number,
    mes: number,
    entidad: string
  ): Observable<{
    success: boolean;
    payment: {
      id: string;
      year: number;
      mes: number;
      entidad: string;
      fecha?: string;
      concepto: string;
      monto: number | string;
      createdAt?: string;
    } | null;
  }> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('mes', mes.toString())
      .set('entidad', entidad);
    return this.http.get<any>(`${this.apiUrl}/statement-payment`, { params });
  }
}

