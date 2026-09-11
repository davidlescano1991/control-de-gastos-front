import { DecimalPipe, NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Prestamo } from '../../../models/prestamo';

@Component({
  selector: 'app-rendimientos-positivos-mensuales',
  imports: [NgIf, NgFor, NgClass, NgStyle, DecimalPipe, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './rendimientos-positivos-mensuales.html',
  styleUrl: './rendimientos-positivos-mensuales.scss',
  standalone: true,
})
export class RendimientosPositivosMensuales {
  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() isCargando = false;

  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() filas: Prestamo[] = [];
  @Input() categorias: string[] = [];

  porcentajeRestanteFinal(numero: number): number {
    if (numero == null) return 0;
    return Math.round(numero * 10000) / 100;
  }

  obtenerStyleRendimiento(valor: number): Record<string, string> {
    const pct = this.porcentajeRestanteFinal(valor);
    const ratio = Math.min(1, Math.max(0, pct / 100));
    // Invertido: 0% = Rojo (hue 0), 100% = Verde (hue 140)
    const hue = Math.round(ratio * 140);

    return {
      background: `linear-gradient(135deg, hsl(${hue}, 80%, 45%), hsl(${hue}, 85%, 36%))`,
      color: '#ffffff',
      'font-weight': '800',
      'font-size': '12px',
      padding: '4px 10px',
      'border-radius': '6px',
      display: 'inline-block',
      'min-width': '65px',
      'text-align': 'center',
      'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.12)',
    };
  }

  obtenerEstadoMes(nombreFila: string, index: number): string {
    const now = new Date();
    const anioActual = now.getFullYear();
    const mesActualIdx = now.getMonth(); // 0-based: 6 = Julio en julio

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
