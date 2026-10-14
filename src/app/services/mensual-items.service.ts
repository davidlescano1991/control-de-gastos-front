import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

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
   * Actualiza un ítem existente.
   */
  updateItem(id: string, payload: UpdateMonthlyItemPayload): Observable<{ message: string; item: MonthlyItemBackend }> {
    return this.http.put<{ message: string; item: MonthlyItemBackend }>(`${this.apiUrl}/items/${id}`, payload);
  }

  /**
   * Elimina un ítem mensual o la serie completa de cuotas si se desea.
   */
  deleteItem(id: string, borrarSerieCompleta = false): Observable<{ message: string; borradosCount: number }> {
    const params = new HttpParams().set('borrarSerieCompleta', borrarSerieCompleta.toString());
    return this.http.delete<{ message: string; borradosCount: number }>(`${this.apiUrl}/items/${id}`, { params });
  }

  /**
   * Evalúa de forma interactiva una fórmula en cliente para feedback en vivo.
   */
  evaluarFormulaLocal(input: string | number): { esFormula: boolean; monto: number; error?: string } {
    if (input === null || input === undefined || input === '') {
      return { esFormula: false, monto: 0 };
    }
    if (typeof input === 'number') {
      return { esFormula: false, monto: isNaN(input) ? 0 : input };
    }

    const str = input.trim();
    const esFormula = str.startsWith('=');
    let exp = esFormula ? str.substring(1).trim() : str;

    // Si es un número directo
    if (!esFormula && !/[+\-*/()]/.test(exp)) {
      const limpio = exp.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(limpio);
      return { esFormula: false, monto: isNaN(num) ? 0 : num };
    }

    // Normalizar comas decimales
    exp = exp.replace(/(\d+),(\d+)/g, '$1.$2');

    // Validar caracteres seguros
    if (!/^[\d\s+\-*/().]+$/.test(exp)) {
      return { esFormula, monto: 0, error: 'Caracteres no permitidos (solo números y +, -, *, /)' };
    }

    try {
      // Parser aritmético seguro
      const resultado = this.evaluarExpresionSegura(exp);
      const redondeado = Math.round((resultado + Number.EPSILON) * 100) / 100;
      return { esFormula: true, monto: isNaN(redondeado) ? 0 : redondeado };
    } catch (e: any) {
      return { esFormula: true, monto: 0, error: e?.message || 'Expresión aritmética incompleta' };
    }
  }

  private evaluarExpresionSegura(expr: string): number {
    let pos = 0;
    const peek = () => expr[pos] || '';
    const consume = () => expr[pos++];
    const skipWs = () => {
      while (pos < expr.length && /\s/.test(expr[pos])) pos++;
    };

    const parseNum = (): number => {
      skipWs();
      let s = '';
      while (pos < expr.length && /[\d.]/.test(expr[pos])) s += consume();
      if (!s) throw new Error('Número esperado');
      return parseFloat(s);
    };

    const parseFactor = (): number => {
      skipWs();
      if (peek() === '+') {
        consume();
        return parseFactor();
      }
      if (peek() === '-') {
        consume();
        return -parseFactor();
      }
      if (peek() === '(') {
        consume();
        const r = parseExp();
        skipWs();
        if (peek() !== ')') throw new Error('Falta paréntesis ")"');
        consume();
        return r;
      }
      return parseNum();
    };

    const parseTerm = (): number => {
      let r = parseFactor();
      skipWs();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const next = parseFactor();
        if (op === '*') r *= next;
        else {
          if (next === 0) throw new Error('División por cero');
          r /= next;
        }
        skipWs();
      }
      return r;
    };

    const parseExp = (): number => {
      let r = parseTerm();
      skipWs();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const next = parseTerm();
        if (op === '+') r += next;
        else r -= next;
        skipWs();
      }
      return r;
    };

    const res = parseExp();
    skipWs();
    if (pos < expr.length) throw new Error('Expresión incompleta');
    return res;
  }
}
