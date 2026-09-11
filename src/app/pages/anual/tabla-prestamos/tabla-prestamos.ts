import { CurrencyPipe, DecimalPipe, NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ChangeDetectorRef, Component, inject, Input, signal } from '@angular/core';
import { MatCardContent, MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Prestamo } from '../../../models/prestamo';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { WakeLockService } from '../../../services/wake-lock.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-tabla-prestamos',
  imports: [
    NgIf,
    NgFor,
    NgClass,
    MatCardContent,
    MatCardModule,
    CurrencyPipe,
    NgStyle,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    DecimalPipe,
    MatProgressSpinnerModule,
  ],
  templateUrl: './tabla-prestamos.html',
  styleUrl: './tabla-prestamos.scss',
})
export class TablaPrestamos {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  filasx = signal<Prestamo[]>([]);

  categoriasx = signal<string[]>([]);
  readonly Math = Math;

  @Input() totalesPendientes: Record<string, number> = {};
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() filas: Prestamo[] = [];
  @Input() categorias: string[] = [];
  @Input() resultado: Record<string, number> = {};
  @Input() isCargando = false;

  private storeGoogle = inject(MovimientosStoreGoogle);
  private wakeLockService = inject(WakeLockService);
  private cdr = inject(ChangeDetectorRef);

  reemplazarPrestado(valor: number): string {
    const otorgado = this.valorOtorgado;
    return Math.abs(valor - otorgado) < 1
      ? 'Prestado'
      : new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 2,
        }).format(valor);
  }

  totalGlobalPendiente(): number {
    return this.calcularTotalGlobalPendiente();
  }

  get valorOtorgado() {
    return this.storeGoogle.valorOtorgado();
  }

  calcularTotalGlobalPendiente(): number {
    const totales =
      this.totalesPendientes && Object.keys(this.totalesPendientes).length > 0
        ? this.totalesPendientes
        : this.calcularTotalesPendientes();

    const total = Object.values(totales).reduce((acc, val) => acc + (val ?? 0), 0);
    return Math.round(total * 100) / 100;
  }

  calcularTotalesPendientes(): Record<string, number> {
    const filas = this.filas.slice(1, -1);
    const totales: Record<string, number> = {};

    for (const fila of filas) {
      for (const cat of Object.keys(fila.valores)) {
        const color = fila.colores?.[cat] ?? '';
        const valor = fila.valores[cat] ?? 0;

        if (color.toLowerCase() !== '#0000ff') {
          totales[cat] = (totales[cat] ?? 0) + valor;
        }
      }
    }

    return totales;
  }

  totalMes(fila: Prestamo): number {
    if (!fila || !fila.valores) return 0;
    return this.categorias.reduce((acc, cat) => acc + (fila.valores[cat] ?? 0), 0);
  }

  cantPrestamos(fila: Prestamo): number {
    if (!fila || !fila.valores) return 0;
    return this.categorias.filter((cat) => (fila.valores[cat] ?? 0) !== 0).length;
  }

  esFilaTotalmentePagada(fila: Prestamo): boolean {
    if (!fila || !fila.valores) return true;
    const catsConValor = this.categorias.filter((cat) => (fila.valores[cat] ?? 0) !== 0);
    if (catsConValor.length === 0) return true;

    return catsConValor.every((cat) => (fila.colores?.[cat] ?? '').toLowerCase() === '#0000ff');
  }

  indexPrimerMesPendiente(): number {
    for (let i = 1; i < this.filas.length - 1; i++) {
      const fila = this.filas[i];
      if (!this.esFilaTotalmentePagada(fila)) {
        return i;
      }
    }
    return -1;
  }

  obtenerEstadoMes(nombreFila: string, index: number): string {
    if (index === 0) return 'row-prestado';
    if (
      index === this.filas.length - 1 ||
      (nombreFila && nombreFila.toLowerCase().includes('total a devolver'))
    ) {
      return 'row-total-devolver';
    }

    const primerPendienteIdx = this.indexPrimerMesPendiente();

    if (primerPendienteIdx === -1) {
      return 'mes-pasado';
    }

    if (index < primerPendienteIdx) {
      return 'mes-pasado';
    } else if (index === primerPendienteIdx) {
      return 'mes-actual';
    } else {
      return 'mes-futuro';
    }
  }

  porcentajeGlobalPendiente(): number {
    const categorias = this.categorias.length > 0 ? this.categorias : Object.keys(this.resultado);
    if (categorias.length === 0) return 0;

    let res = this.resultado;
    if (!res || Object.keys(res).length === 0) {
      res = this.calcularResultadoPorcentajes();
    }

    let suma = 0;
    let contador = 0;

    for (const cat of categorias) {
      const pct = res[cat] ?? 0;
      if (pct > 0) {
        suma += pct;
        contador++;
      }
    }

    if (contador === 0) return 0;
    return Math.round((suma / contador) * 100) / 100;
  }

  private calcularResultadoPorcentajes(): Record<string, number> {
    const ultimaFila = this.filas.at(-1);
    const otorgado = ultimaFila?.valores ?? {};
    const pendientes =
      this.totalesPendientes && Object.keys(this.totalesPendientes).length > 0
        ? this.totalesPendientes
        : this.calcularTotalesPendientes();

    const resultado: Record<string, number> = {};
    for (const cat of Object.keys(otorgado)) {
      const total = otorgado[cat] ?? 0;
      const resto = pendientes[cat] ?? 0;
      const porcentaje = total > 0 ? (resto / total) * 100 : 0;
      resultado[cat] = Math.round(porcentaje * 100) / 100;
    }
    return resultado;
  }

  totalDevolverGlobal(): number {
    const ultimaFila = this.filas.at(-1);
    if (!ultimaFila || !ultimaFila.valores) return 0;
    return Object.values(ultimaFila.valores).reduce((acc, val) => acc + (val ?? 0), 0);
  }

  obtenerColorGradual(ratio: number): string {
    const rNorm = Math.min(1, Math.max(0, ratio || 0));

    // Paradas de color: ratio = 1.0 (Carmesí/Bordó) -> 0.75 (Rojo) -> 0.50 (Naranja) -> 0.25 (Amarillo) -> 0.0 (Verde)
    const stops = [
      { r: 16, g: 185, b: 129, t: 0.0 }, // Verde (#10b981)
      { r: 250, g: 204, b: 21, t: 0.25 }, // Amarillo (#facc15)
      { r: 249, g: 115, b: 22, t: 0.5 }, // Naranja (#f97316)
      { r: 239, g: 68, b: 68, t: 0.75 }, // Rojo (#ef4444)
      { r: 190, g: 18, b: 60, t: 1.0 }, // Carmesí/Bordó brillante (#be123c)
    ];

    if (rNorm >= 1) return `rgb(${stops[4].r}, ${stops[4].g}, ${stops[4].b})`;
    if (rNorm <= 0) return `rgb(${stops[0].r}, ${stops[0].g}, ${stops[0].b})`;

    for (let i = 0; i < stops.length - 1; i++) {
      const start = stops[i];
      const end = stops[i + 1];
      if (rNorm >= start.t && rNorm <= end.t) {
        const segRatio = (rNorm - start.t) / (end.t - start.t);
        const r = Math.round(start.r + segRatio * (end.r - start.r));
        const g = Math.round(start.g + segRatio * (end.g - start.g));
        const b = Math.round(start.b + segRatio * (end.b - start.b));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    return '#10b981';
  }

  obtenerColorPorcentaje(porcentaje: number): string {
    return this.obtenerColorGradual((porcentaje || 0) / 100);
  }

  obtenerColorRestaPorPagar(): string {
    const max = this.totalDevolverGlobal();
    const actual = this.totalGlobalPendiente();
    if (!max || max <= 0) return '#10b981';
    return this.obtenerColorGradual(actual / max);
  }

  obtenerStyleKpiRestaPorPagar(): Record<string, string> {
    const color = this.obtenerColorRestaPorPagar();
    return {
      'border-left-color': color,
    };
  }

  obtenerStyleTotalPendienteGlobal(): Record<string, string> {
    const color = this.obtenerColorRestaPorPagar();
    return {
      '--dynamic-color': color,
      background: color,
      color: '#ffffff',
      'font-weight': '800',
      'font-size': '13px',
      padding: '8px 10px',
      'text-align': 'right',
    };
  }

  obtenerStyleKpiPorcentaje(): Record<string, string> {
    const pct = this.porcentajeGlobalPendiente();
    const color = this.obtenerColorPorcentaje(pct);
    return {
      'border-left-color': color,
    };
  }

  obtenerStylePorcentajeGlobal(): Record<string, string> {
    const pct = this.porcentajeGlobalPendiente();
    const color = this.obtenerColorPorcentaje(pct);

    return {
      '--dynamic-color': color,
      background: color,
      color: '#ffffff',
      'font-weight': '800',
      'font-size': '13px',
      padding: '8px 10px',
      'text-align': 'right',
    };
  }
}
