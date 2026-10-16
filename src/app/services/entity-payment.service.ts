import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';

export interface EntityPayment {
  id?: string;
  year: number;
  mes: number;
  entidad: string;
  itemId?: string;
  estado: 'COMPLETO' | 'PARCIAL' | 'PENDIENTE';
  totalOriginal: number;
  montoPagado: number;
  montoRestante: number;
  fechaPago?: string | null;
  cuentaOrigen?: string | null;
  movimientoId?: string | null;
  notas?: string | null;
  esSintetico?: boolean;
}

export interface RegisterPaymentDTO {
  year: number;
  mes: number;
  entidad: string;
  itemId?: string;
  esTotal: boolean;
  totalOriginal: number;
  montoPagado: number;
  fechaPago: string;
  cuentaOrigen?: string;
  registrarMovimiento?: boolean;
  notas?: string;
}

export interface EntidadAPagarInfo {
  year: number;
  mes: number;
  mesNombre: string;
  entidad: string;
  itemId?: string;
  concepto?: string;
  totalOriginal: number;
  pagoExistente?: EntityPayment;
}

@Injectable({
  providedIn: 'root',
})
export class EntityPaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pagos-entidades`;

  // Estado reactivo en memoria: Map(`${year}::${mes}`, EntityPayment[])
  pagosMesSignal = signal<Map<string, EntityPayment[]>>(new Map());

  // Manejo global del modal de pago (evita problemas de stacking context / overflow)
  entidadAPagarSeleccionada = signal<EntidadAPagarInfo | null>(null);

  abrirModalPago(info: EntidadAPagarInfo): void {
    this.entidadAPagarSeleccionada.set(info);
  }

  cerrarModalPago(): void {
    this.entidadAPagarSeleccionada.set(null);
  }

  getPayments(year: number, mes: number): Observable<{ success: boolean; data: EntityPayment[] }> {
    return this.http.get<{ success: boolean; data: EntityPayment[] }>(`${this.apiUrl}?year=${year}&mes=${mes}`).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const key = `${year}::${mes}`;
          const currentMap = new Map(this.pagosMesSignal());
          currentMap.set(key, res.data);
          this.pagosMesSignal.set(currentMap);
        }
      })
    );
  }

  registerPayment(dto: RegisterPaymentDTO): Observable<{ success: boolean; data: EntityPayment }> {
    return this.http.post<{ success: boolean; data: EntityPayment }>(this.apiUrl, dto).pipe(
      tap((res) => {
        if (res.success && res.data) {
          const key = `${dto.year}::${dto.mes}`;
          const currentMap = new Map(this.pagosMesSignal());
          const listaActual = currentMap.get(key) || [];
          const idx = listaActual.findIndex(
            (p) => p.entidad === dto.entidad && (p.itemId || '') === (dto.itemId || '')
          );
          if (idx >= 0) {
            listaActual[idx] = res.data;
          } else {
            listaActual.push(res.data);
          }
          currentMap.set(key, [...listaActual]);
          this.pagosMesSignal.set(currentMap);
        }
      })
    );
  }

  getUnpaid(year: number, mes?: number): Observable<{ success: boolean; year: number; mes?: number; unpaid: number | Record<number, number> }> {
    const url = mes !== undefined ? `${this.apiUrl}/impagas?year=${year}&mes=${mes}` : `${this.apiUrl}/impagas?year=${year}`;
    return this.http.get<{ success: boolean; year: number; mes?: number; unpaid: number | Record<number, number> }>(url);
  }
}
