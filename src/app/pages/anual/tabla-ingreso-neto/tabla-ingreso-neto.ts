import { CurrencyPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IngresoNetoMes } from '../../../models/ingreso-neto';
import { Prestamo } from '../../../models/prestamo';

@Component({
  selector: 'app-tabla-ingreso-neto',
  imports: [
    NgIf,
    NgFor,
    NgClass,
    CurrencyPipe,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './tabla-ingreso-neto.html',
  styleUrl: './tabla-ingreso-neto.scss',
  standalone: true,
})
export class TablaIngresoNeto {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() datos: IngresoNetoMes[] = [];
  @Input() filas: Prestamo[] = [];
  @Input() categorias: string[] = [];

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }

  esFilaTotalmentePagada(fila: Prestamo): boolean {
    if (!fila || !fila.valores) return true;
    const catsConValor = this.categorias.filter((cat) => (fila.valores[cat] ?? 0) !== 0);
    if (catsConValor.length === 0) return true;

    return catsConValor.every((cat) => (fila.colores?.[cat] ?? '').toLowerCase() === '#0000ff');
  }

  obtenerNombrePrimerMesPendiente(): string | null {
    if (!this.filas || this.filas.length <= 2) return null;
    const filasMeses = this.filas.slice(1, -1);
    for (const fila of filasMeses) {
      if (!this.esFilaTotalmentePagada(fila)) {
        return fila.nombreFila;
      }
    }
    return null;
  }

  obtenerEstadoMes(nombreMes: string, index: number): string {
    const primerMesPendiente = this.obtenerNombrePrimerMesPendiente();

    if (primerMesPendiente && this.datos && this.datos.length > 0) {
      const idxPendiente = this.datos.findIndex(
        (d) => this.normalizar(d.mes) === this.normalizar(primerMesPendiente),
      );
      if (idxPendiente !== -1) {
        if (index < idxPendiente) return 'mes-pasado';
        if (index === idxPendiente) return 'mes-actual';
        return 'mes-futuro';
      }
    }

    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActualIdx = now.getMonth();

    if (this.anioSeleccionado < anioActual) {
      return 'mes-pasado';
    }
    if (this.anioSeleccionado > anioActual) {
      return 'mes-futuro';
    }

    if (index < mesActualIdx) {
      return 'mes-pasado';
    } else if (index === mesActualIdx) {
      return 'mes-actual';
    } else {
      return 'mes-futuro';
    }
  }

  formatearMes(nombreMes: string): string {
    if (!nombreMes) return '';
    return nombreMes.replace(/_/g, ' ');
  }

  totalIngresoNeto(): number {
    return (this.datos || []).reduce((acc, item) => acc + (item.ingresoNeto || 0), 0);
  }

  totalIngresoNetoUSD(): number {
    return (this.datos || []).reduce((acc, item) => acc + (item.ingresoNetoUSD || 0), 0);
  }
}
