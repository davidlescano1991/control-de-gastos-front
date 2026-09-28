import { Component, computed, input, output, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-selector-anio-delorean',
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: './selector-anio-delorean.html',
  styleUrl: './selector-anio-delorean.scss',
})
export class SelectorAnioDelorean {
  anios = input<number[]>([]);
  anioSeleccionado = input<number>(new Date().getFullYear());

  anioCambiado = output<number>();
  indiceCambiado = output<number>();

  readonly anioActual = new Date().getFullYear();

  isTimeTraveling = signal(false);
  travelDirection = signal<'left' | 'right'>('right');
  fireTrailLeft = signal<string>('0%');
  fireTrailWidth = signal<string>('0%');

  deloreanPosition = computed(() => {
    const list = this.anios();
    if (list.length <= 1) return '50%';
    const idx = list.indexOf(this.anioSeleccionado());
    if (idx === -1) return '0%';
    const pct = (idx / (list.length - 1)) * 100;
    return `${pct}%`;
  });

  seleccionar(index: number) {
    const list = this.anios();
    const anio = list[index];
    if (anio === this.anioSeleccionado()) return;

    const prevIndex = list.indexOf(this.anioSeleccionado());
    const total = list.length;

    if (prevIndex !== -1 && total > 1) {
      const isRight = index > prevIndex;
      // Mientras viaja, mira hacia el sentido del movimiento
      this.travelDirection.set(isRight ? 'right' : 'left');

      const minIdx = Math.min(prevIndex, index);
      const maxIdx = Math.max(prevIndex, index);
      const startPct = (minIdx / (total - 1)) * 100;
      const widthPct = ((maxIdx - minIdx) / (total - 1)) * 100;

      this.fireTrailLeft.set(`${startPct}%`);
      this.fireTrailWidth.set(`${widthPct}%`);
      this.isTimeTraveling.set(true);

      setTimeout(() => {
        this.isTimeTraveling.set(false);
        // Al llegar a los extremos se orienta hacia el interior de la pista
        if (index === 0) {
          this.travelDirection.set('right'); // Extremo izquierdo -> mirando hacia la derecha
        } else if (index === total - 1) {
          this.travelDirection.set('left'); // Extremo derecho -> mirando hacia la izquierda
        }
      }, 700);
    }

    this.indiceCambiado.emit(index);
    this.anioCambiado.emit(anio);
  }
}
