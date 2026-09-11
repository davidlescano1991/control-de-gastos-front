import { CurrencyPipe, NgFor, NgIf, NgClass } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-tabla-gastos-mensuales',
  imports: [NgIf, NgFor, NgClass, CurrencyPipe, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './tabla-gastos-mensuales.html',
  styleUrl: './tabla-gastos-mensuales.scss',
  standalone: true,
})
export class TablaGastosMensuales {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;

  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() datos: { mes: string; total: number }[] = [];

  obtenerEstadoMes(index: number): string {
    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActualIdx = now.getMonth(); // 0-indexed (0 = Enero, 11 = Diciembre)

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
}
