import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface MonthlyEstimateConfig {
  id?: string;
  year: number;
  mes: number;
  nombreMes: string;
  saldoInicial: number;
  gastoFijoDiario: number;
  ingresoInteresDiario: number;
  deudaInicial: number;
  presupuestoTotal?: number | null;
  fechaInicio?: string;
  fechaFin?: string;
  totalDias?: number;
  diasTranscurridos?: number;
  diasRestantes?: number;
  porcentajeProgreso?: number;
}

export interface DailyEstimateRow {
  id?: string;
  configId?: string;
  fecha: string;
  fechaISO?: string;
  dia: number;
  saldoPesos: number;
  cotizacionUSD?: number | null;
  saldoUSD?: number | null;
  deuda: number;
  deudaUSD?: number | null;
  real: number | null;
  realUSD?: number | null;
  deudaReal: number;
  diferenciaSaldo: number | null;
  diferenciaDeuda: number | null;
  nombreDia?: string;
  diaSemana?: number;
  esFinDeSemana?: boolean;
  esFeriado?: boolean;
  esNoLaborable?: boolean;
  motivoFeriado?: string | null;
  claseFila?: string;
  tooltipFecha?: string;
}

export interface MonthlyEstimateResponse {
  config: MonthlyEstimateConfig;
  filas: DailyEstimateRow[];
}

export interface PreviewExpensesResponse {
  year: number;
  mes: number;
  totalGastosMes: number;
  totalGastosOriginalBruto?: number;
  totalTarjetas?: number;
  totalTarjetasEfectivoAPagar?: number;
  totalCompensaciones?: number;
  totalPrestamos?: number;
  totalServicios?: number;
  desgloseTarjetas?: Array<{
    entidad: string;
    totalOriginal: number;
    intencionAPagar: number;
    compensacion: number;
    estado: string;
  }>;
  deudaTotalAnual?: number;
  deudaSugerida?: number;
  remanenteSaldoAnterior: number;
  deudaMesAnterior: number;
  itemsCount: number;
  cuotasPrestamosCount?: number;
}

export interface UpsertEstimateConfigDTO {
  year: number;
  mes: number;
  nombreMes: string;
  fechaInicio: string;
  fechaFin: string;
  saldoInicial: number;
  gastoFijoDiario: number;
  ingresoInteresDiario?: number;
  deudaInicial?: number;
  presupuestoTotal?: number;
}

@Injectable({
  providedIn: 'root',
})
export class EstimatesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/estimaciones`;

  /**
   * Obtiene la configuración y filas diarias del estimativo de un año y mes
   */
  getMonthly(year: number, mes: number): Observable<MonthlyEstimateResponse> {
    return this.http.get<MonthlyEstimateResponse>(this.apiUrl, {
      params: { year: year.toString(), mes: mes.toString() },
    });
  }

  /**
   * Obtiene la sumatoria preliminar de gastos del mes presupuestados en monthly_items
   * y los remanentes de saldo y deuda del mes anterior.
   */
  getPreviewGastos(year: number, mes: number): Observable<PreviewExpensesResponse> {
    return this.http.get<PreviewExpensesResponse>(`${this.apiUrl}/preview-gastos`, {
      params: { year: year.toString(), mes: mes.toString() },
    });
  }

  /**
   * Guarda o actualiza la configuración de un ciclo de estimativo mensual
   */
  upsertConfig(dto: UpsertEstimateConfigDTO): Observable<{ message: string; data: MonthlyEstimateResponse }> {
    return this.http.post<{ message: string; data: MonthlyEstimateResponse }>(`${this.apiUrl}/config`, dto);
  }

  /**
   * Elimina la configuración de un ciclo de estimativo mensual
   */
  deleteConfig(year: number, mes: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/config`, {
      params: { year: year.toString(), mes: mes.toString() },
    });
  }

  /**
   * Actualiza el valor real, deudaReal, saldoPesos o deuda de un día específico
   */
  updateDaily(
    id: string,
    payload: {
      real?: number | null;
      deudaReal?: number | null;
      saldoPesos?: number;
      deuda?: number;
      propagarDeuda?: boolean;
    }
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/daily/${id}`, payload);
  }

  /**
   * Lista los períodos disponibles con configuración de estimativos
   */
  listPeriods(): Observable<{ year: number; mes: number; nombreMes: string }[]> {
    return this.http.get<{ year: number; mes: number; nombreMes: string }[]>(`${this.apiUrl}/periods`);
  }
}
