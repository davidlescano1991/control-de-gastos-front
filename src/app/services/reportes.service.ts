import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../config/environment';

export interface SaldoPunto {
  fecha: string;        // DD/MM/AAAA
  fechaISO: string;     // YYYY-MM-DD
  mes: string;          // Nombre del mes (ej. "Octubre", "Enero")
  saldoPesos: number;   // Monto en ARS
  saldoUSD: number;     // Monto en USD
  deuda: number;        // Monto en ARS
}

export interface ReporteSaldoAnualResponse {
  year: number;
  origen: 'SHEETS' | 'DATABASE';
  hoja: string;
  mesesDisponibles: string[];
  puntos: SaldoPunto[];
  metrics: {
    ultimoSaldoPesos: number;
    ultimoSaldoUSD: number;
    ultimaDeuda: number;
    saldoMaxPesos: number;
    saldoMinPesos: number;
    saldoMaxUSD: number;
    saldoMinUSD: number;
    totalPuntos: number;
  };
}

export interface CorteBimonetario {
  fecha: string;         // "10/10/2025"
  fechaISO: string;      // "2025-10-10"
  mes: string;           // "Octubre 2025"
  saldoPesos: number;    // Saldo $
  saldoUSD: number;      // Saldo U$
  deuda: number;         // Deuda/bitcoin
  saldoPesosUSD: number; // Saldo $ a U$
  totalSaldoUSD: number; // Total Saldo U$
  variacionPesos: number;// $ (Variación en pesos)
  variacionUSD: number;  // U$ (Variación en USD)
}

export interface ReporteCortesBimonetariosResponse {
  year: number;
  origen: 'SHEETS' | 'DATABASE';
  hoja: string;
  cortes: CorteBimonetario[];
  metrics: {
    ultimoCorte: CorteBimonetario | null;
    totalSaldoUSDMax: number;
    totalSaldoUSDMin: number;
    saldoPesosMax: number;
    saldoPesosMin: number;
    deudaActual: number;
    variacionAcumuladaPesos: number;
    variacionAcumuladaUSD: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Obtiene la evolución de saldo del año (Saldo [Año]) con soporte dual (Sheets / PostgreSQL).
   */
  getSaldoAnual(year: number, force = false): Observable<ReporteSaldoAnualResponse | null> {
    const url = `${this.apiUrl}/reportes/saldo-anual?year=${year}&force=${force}`;
    return this.http.get<{ status: string; data: ReporteSaldoAnualResponse }>(url).pipe(
      map((res) => res.data),
      catchError((err) => {
        console.warn(`[ReportesService] Error al obtener saldo anual de la API para ${year}:`, err);
        return of(null);
      })
    );
  }

  /**
   * Obtiene la tabla y serie de cortes bimonetarios (Saldo!K47:R60).
   */
  getCortesBimonetarios(year: number, force = false): Observable<ReporteCortesBimonetariosResponse | null> {
    const url = `${this.apiUrl}/reportes/cortes-bimonetarios?year=${year}&force=${force}`;
    return this.http.get<{ status: string; data: ReporteCortesBimonetariosResponse }>(url).pipe(
      map((res) => res.data),
      catchError((err) => {
        console.warn(`[ReportesService] Error al obtener cortes bimonetarios de la API para ${year}:`, err);
        return of(null);
      })
    );
  }
}

