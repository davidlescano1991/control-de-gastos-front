import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface MovementFilterParams {
  year?: number;
  mes?: number;
  entidad?: string;
  tipo?: string;
  categoria?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  detallado?: boolean;
  force?: boolean;
}

export interface MovementBackendItem {
  id: string;
  fecha: string | Date;
  mes: number;
  year: number;
  tipo: string;
  categoria: string;
  subcategoria?: string | null;
  entidad?: string | null;
  monto: number;
  moneda: string;
  descripcion?: string | null;
  metodoPago?: string | null;
  comprobante?: string | null;
  deuda?: number | null;
  deudapesos?: number | null;
  createdAt?: string | Date;
}

export interface MovementDetailedResponse {
  status: string;
  data: MovementBackendItem[];
  resumen: {
    totalGastos: number;
    totalIngresos: number;
    balance: number;
    totalRegistros: number;
  };
}

export interface BatchMovementPayload {
  fecha: string;
  deuda?: number;
  movimientos: {
    entidad: string;
    monto: number;
    tipo?: string;
    categoria?: string;
    descripcion?: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/movimientos`;

  /**
   * Registra un movimiento individual.
   */
  crearMovimiento(mov: any): Observable<any> {
    return this.http.post(this.apiUrl, mov);
  }

  /**
   * Registra un lote de movimientos diarios con sincronización opcional de deuda.
   */
  crearLoteMovimientos(payload: BatchMovementPayload | any[]): Observable<any> {
    return this.http.post(this.apiUrl, payload);
  }

  /**
   * Consulta los movimientos en la base de datos con filtros por fecha, entidad, tipo o búsqueda.
   */
  listarMovimientos(filtros?: MovementFilterParams): Observable<MovementBackendItem[]> {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.year) params = params.set('year', filtros.year.toString());
      if (filtros.mes) params = params.set('mes', filtros.mes.toString());
      if (filtros.entidad) params = params.set('entidad', filtros.entidad);
      if (filtros.tipo && filtros.tipo !== 'TODOS') params = params.set('tipo', filtros.tipo);
      if (filtros.categoria) params = params.set('categoria', filtros.categoria);
      if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
      if (filtros.search) params = params.set('search', filtros.search);
      if (filtros.detallado) params = params.set('detallado', 'true');
      if (filtros.force) params = params.set('force', 'true');
    }

    return this.http.get<MovementBackendItem[]>(this.apiUrl, { params });
  }

  /**
   * Consulta los movimientos con métricas agregadas de resumen (totalGastos, totalIngresos, balance).
   */
  listarMovimientosDetallado(filtros?: MovementFilterParams): Observable<MovementDetailedResponse> {
    let params = new HttpParams().set('detallado', 'true');
    if (filtros) {
      if (filtros.year) params = params.set('year', filtros.year.toString());
      if (filtros.mes) params = params.set('mes', filtros.mes.toString());
      if (filtros.entidad) params = params.set('entidad', filtros.entidad);
      if (filtros.tipo && filtros.tipo !== 'TODOS') params = params.set('tipo', filtros.tipo);
      if (filtros.categoria) params = params.set('categoria', filtros.categoria);
      if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
      if (filtros.search) params = params.set('search', filtros.search);
    }

    return this.http.get<MovementDetailedResponse>(this.apiUrl, { params });
  }

  /**
   * Elimina un movimiento por ID.
   */
  eliminarMovimiento(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene la última deuda registrada en el sistema para inicializar por defecto.
   */
  obtenerUltimaDeuda(): Observable<{ ultimaDeuda: number | null; fecha: string | null }> {
    return this.http.get<{ ultimaDeuda: number | null; fecha: string | null }>(`${this.apiUrl}/ultima-deuda`);
  }

  /**
   * Obtiene los últimos saldos registrados por cuenta y la última deuda para precargar el formulario completo.
   */
  obtenerUltimosSaldos(): Observable<{
    deuda: number | null;
    deudaFormula: string | null;
    fecha: string | null;
    cuentas: { entidad: string; monto: number; formula: string | null; descripcion: string | null }[];
  }> {
    return this.http.get<{
      deuda: number | null;
      deudaFormula: string | null;
      fecha: string | null;
      cuentas: { entidad: string; monto: number; formula: string | null; descripcion: string | null }[];
    }>(`${this.apiUrl}/ultimos-saldos`);
  }
}
