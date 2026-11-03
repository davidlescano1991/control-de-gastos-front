import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { SheetConfigItem, SheetConfigPayload, RuntimeConfigData } from '../models/sheet-config.models';

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
  total?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SheetConfigService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/sheets-config`;

  /**
   * Obtiene la configuración en tiempo de ejecución (años y rangos dinámicos)
   */
  getRuntimeConfig(): Observable<ApiResponse<RuntimeConfigData>> {
    return this.http.get<ApiResponse<RuntimeConfigData>>(`${this.apiUrl}/runtime-config`);
  }

  /**
   * Lista todas las hojas configuradas (Admin)
   */
  getConfigs(): Observable<ApiResponse<SheetConfigItem[]>> {
    return this.http.get<ApiResponse<SheetConfigItem[]>>(this.apiUrl);
  }

  /**
   * Crea o actualiza la configuración de una hoja para un año específico (Admin)
   */
  upsertConfig(payload: SheetConfigPayload): Observable<ApiResponse<SheetConfigItem>> {
    return this.http.post<ApiResponse<SheetConfigItem>>(this.apiUrl, payload);
  }

  /**
   * Elimina la configuración de una hoja para un año (Admin)
   */
  deleteConfig(year: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${year}`);
  }

  /**
   * Dispara la sincronización inmediata de movimientos para un año
   */
  syncSheet(year: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sync/sheets`, { anio: year });
  }

  /**
   * Notifica a la API qué año y hoja está viendo activamente el usuario en el Frontend.
   * Permite que el poller de la API enfoque su monitoreo exclusivamente en esa hoja,
   * ahorrando cuota y emitiendo eventos SSE en tiempo real cuando detecta celdas modificadas.
   */
  notificarContextoActivo(year: number, sheet?: string, view?: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sync/context`, { year, sheet, view });
  }

  /**
   * Extrae el ID limpio de una URL de Google Sheets o del texto ingresado
   */
  cleanSheetId(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }
}
