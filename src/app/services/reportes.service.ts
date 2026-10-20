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

export interface MesSaldoItem {
  mes: string;
  numeroMes: number;
  saldo: number;
}

export interface MesGastoItem {
  mes: string;
  numeroMes: number;
  total: number;
  totalAnterior: number;
  variacion: number;
  porcentajeVariacion: number;
  aumento: boolean;
}

export interface MesPrestamoItem {
  mes: string;
  numeroMes: number;
  totalCuotas: number;
  cantidadCuotas: number;
  cuotasDetalle: Array<{
    prestamoNombre: string;
    entidad: string;
    monto: number;
    pagada: boolean;
  }>;
}

export interface ReporteAnalisisAnualResponse {
  year: number;
  origen: 'SHEETS' | 'DATABASE';
  hoja: string;
  saldos: MesSaldoItem[];
  gastos: MesGastoItem[];
  prestamos: MesPrestamoItem[];
  nafta?: number[];
  metrics: {
    saldoPromedio: number;
    totalGastosAnual: number;
    promedioGastoMensual: number;
    mesMayorGasto: { mes: string; total: number } | null;
    mesMenorGasto: { mes: string; total: number } | null;
    mesesConAumento: number;
    mesesConReduccion: number;
    totalPrestamosAnual: number;
  };
}

export interface FiltrosExplorador {
  tabla?: 'movimientos' | 'pagos_entidades' | 'items_mensuales' | 'prestamos' | 'estimativos';
  year?: number;
  desde?: string;
  hasta?: string;
  entidades?: string[];
  tipo?: string;
  estados?: string[];
  concepto?: string;
  montoMin?: number;
  montoMax?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExploradorRegistro {
  id: string;
  fecha: string;
  fechaISO: string;
  entidad: string;
  concepto: string;
  monto: number;
  tipo?: string;
  estado?: string;
  categoria?: string;
  detalle?: string;
}

export interface ExploradorResumen {
  totalMonto: number;
  cantidad: number;
  promedio: number;
  totalGastos?: number;
  totalIngresos?: number;
  balanceNeto?: number;
  saldoInicial?: number;
  saldoFinal?: number;
  variacionNeta?: number;
  variacionPromedioDiaria?: number;
  sumaVariacionesPositivas?: number;
  sumaVariacionesNegativas?: number;
  totalDiasConSaldo?: number;
}

export interface ExploradorDistribucion {
  distribucionPorEntidad: Array<{ entidad: string; monto: number; cantidad: number }>;
  distribucionTemporal: Array<{ periodo: string; monto: number }>;
  distribucionEstados?: Array<{ estado: string; cantidad: number; monto: number }>;
}

export interface ExploradorResponse {
  tabla: string;
  resumen: ExploradorResumen;
  distribuciones: ExploradorDistribucion;
  items: ExploradorRegistro[];
  totalRegistros: number;
  totalPaginas: number;
  paginaActual: number;
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

  /**
   * Obtiene el análisis anual reorganizado (saldos, gastos condicionales rojo/azul y préstamos).
   */
  getAnalisisAnual(year: number, force = false): Observable<ReporteAnalisisAnualResponse | null> {
    const url = `${this.apiUrl}/reportes/analisis-anual?year=${year}&force=${force}`;
    return this.http.get<{ status: string; data: ReporteAnalisisAnualResponse }>(url).pipe(
      map((res) => res.data),
      catchError((err) => {
        console.warn(`[ReportesService] Error al obtener análisis anual de la API para ${year}:`, err);
        return of(null);
      })
    );
  }

  /**
   * Ejecuta consultas dinámicas multicriterio en el Explorador Analítico de Base de Datos (Exclusivo Administradores).
   */
  getExplorador(filtros: FiltrosExplorador): Observable<ExploradorResponse | null> {
    let params: string[] = [];
    if (filtros.tabla) params.push(`tabla=${encodeURIComponent(filtros.tabla)}`);
    if (filtros.year) params.push(`year=${encodeURIComponent(filtros.year)}`);
    if (filtros.desde) params.push(`desde=${encodeURIComponent(filtros.desde)}`);
    if (filtros.hasta) params.push(`hasta=${encodeURIComponent(filtros.hasta)}`);
    if (filtros.entidades && filtros.entidades.length > 0) {
      params.push(`entidades=${encodeURIComponent(filtros.entidades.join(','))}`);
    }
    if (filtros.tipo && filtros.tipo !== 'TODOS') params.push(`tipo=${encodeURIComponent(filtros.tipo)}`);
    if (filtros.estados && filtros.estados.length > 0) {
      params.push(`estados=${encodeURIComponent(filtros.estados.join(','))}`);
    }
    if (filtros.concepto && filtros.concepto.trim()) {
      params.push(`concepto=${encodeURIComponent(filtros.concepto.trim())}`);
    }
    if (filtros.montoMin !== undefined && filtros.montoMin !== null) {
      params.push(`montoMin=${encodeURIComponent(filtros.montoMin)}`);
    }
    if (filtros.montoMax !== undefined && filtros.montoMax !== null) {
      params.push(`montoMax=${encodeURIComponent(filtros.montoMax)}`);
    }
    if (filtros.page) params.push(`page=${encodeURIComponent(filtros.page)}`);
    if (filtros.limit) params.push(`limit=${encodeURIComponent(filtros.limit)}`);
    if (filtros.sortBy) params.push(`sortBy=${encodeURIComponent(filtros.sortBy)}`);
    if (filtros.sortOrder) params.push(`sortOrder=${encodeURIComponent(filtros.sortOrder)}`);

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `${this.apiUrl}/reportes/explorador${queryString}`;

    return this.http.get<{ status: string; data: ExploradorResponse }>(url).pipe(
      map((res) => res.data),
      catchError((err) => {
        console.warn('[ReportesService] Error al consultar explorador dinámico:', err);
        return of(null);
      })
    );
  }
}



