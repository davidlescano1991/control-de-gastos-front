import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface LoanInstallment {
  id?: string;
  loanId?: string;
  numeroCuota: number;
  year: number;
  mes: number;
  monto: number;
  pagada: boolean;
  fechaPago?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Loan {
  id: string;
  year: number;
  entidad: string;
  nombre: string;
  capitalTomado: number;
  fechaToma: string;
  fechaPrimeraCuota: string;
  totalCuotas: number;
  montoCuotaDefault?: number | null;
  deudaTotal: number;
  cuotasPagadas: number;
  totalPagado: number;
  saldoPendiente: number;
  porcentajePagado?: number;
  notas?: string | null;
  estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';
  installments: LoanInstallment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanDTO {
  year: number;
  entidad: string;
  nombre: string;
  capitalTomado: number;
  fechaToma: string;
  fechaPrimeraCuota: string;
  totalCuotas: number;
  montoCuotaDefault?: number;
  cuotas?: Array<{
    numeroCuota: number;
    year: number;
    mes: number;
    monto: number;
  }>;
  notas?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoansService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/prestamos`;

  /**
   * Obtiene la lista de préstamos, opcionalmente filtrada por año
   */
  getLoans(year?: number): Observable<{ success: boolean; count: number; data: Loan[] }> {
    const params = year ? `?year=${year}` : '';
    return this.http.get<{ success: boolean; count: number; data: Loan[] }>(`${this.apiUrl}${params}`);
  }

  /**
   * Obtiene un préstamo por su ID
   */
  getLoanById(id: string): Observable<{ success: boolean; data: Loan }> {
    return this.http.get<{ success: boolean; data: Loan }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea un nuevo préstamo con su cronograma de cuotas
   */
  createLoan(dto: CreateLoanDTO): Observable<{ success: boolean; data: Loan }> {
    return this.http.post<{ success: boolean; data: Loan }>(this.apiUrl, dto);
  }

  /**
   * Actualiza un préstamo existente
   */
  updateLoan(id: string, dto: Partial<CreateLoanDTO>): Observable<{ success: boolean; data: Loan }> {
    return this.http.put<{ success: boolean; data: Loan }>(`${this.apiUrl}/${id}`, dto);
  }

  /**
   * Elimina un préstamo
   */
  deleteLoan(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Marca una cuota como pagada o impaga, con fecha de pago y registro de movimiento opcional
   */
  setInstallmentPaid(
    loanId: string,
    numeroCuota: number,
    pagada: boolean,
    options?: { fechaPago?: string; registrarMovimiento?: boolean }
  ): Observable<{ success: boolean; data: any }> {
    const body = {
      pagada,
      fechaPago: options?.fechaPago,
      registrarMovimiento: options?.registrarMovimiento,
    };
    return this.http.patch<{ success: boolean; data: any }>(
      `${this.apiUrl}/${loanId}/cuotas/${numeroCuota}/pago`,
      body
    );
  }

  /**
   * Sincroniza y desacumula las cuotas de préstamos desde Google Sheets hacia PostgreSQL
   */
  syncLoansFromSheet(year?: number): Observable<{ success: boolean; message: string; data?: any }> {
    const body = year ? { year } : {};
    return this.http.post<{ success: boolean; message: string; data?: any }>(`${this.apiUrl}/sync-sheets`, body);
  }
}
