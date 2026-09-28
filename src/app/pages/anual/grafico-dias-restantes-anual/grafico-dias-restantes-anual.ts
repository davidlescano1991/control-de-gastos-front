import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface EstimativoFilaItem {
  fecha?: string;
  real?: number | null;
  [key: string]: any;
}

@Component({
  selector: 'app-grafico-dias-restantes-anual',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './grafico-dias-restantes-anual.html',
  styleUrl: './grafico-dias-restantes-anual.scss',
})
export class GraficoDiasRestantesAnual implements OnInit, OnChanges, OnDestroy {
  isCollapsed = signal(false);
  private cdr = inject(ChangeDetectorRef);

  @Input() modo: 'anual' | 'estimativo' = 'anual';
  @Input() anioSeleccionado: number = new Date().getFullYear();
  @Input() mesSeleccionado: string = '';
  @Input() estimativoFilas: EstimativoFilaItem[] = [];

  porcentajeAnimado = 0;
  porcentajeContador = 0;
  isAnimating = false;
  animationDurationMs = 3000;
  private lastAnimationTime = 0;
  private animFrameId: any = null;

  get totalDias(): number {
    return this.getTotalDias();
  }

  get ticks(): number[] {
    const total = this.totalDias;
    if (this.modo === 'estimativo') {
      const step = 5;
      const t: number[] = [];
      for (let i = 0; i < total; i += step) {
        t.push(i);
      }
      if (t.length === 0 || t[t.length - 1] !== total) {
        t.push(total);
      }
      return t;
    }
    return [0, 50, 100, 150, 200, 250, 300, 350, total];
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  ngOnInit(): void {
    this.iniciarAnimacion();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['anioSeleccionado'] ||
      changes['mesSeleccionado'] ||
      changes['estimativoFilas'] ||
      changes['modo']
    ) {
      this.iniciarAnimacion();
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  get porcentajeMostrar(): number {
    if (this.isAnimating && this.porcentajeContador !== undefined) {
      return this.porcentajeContador;
    }
    return this.getPorcentaje();
  }

  iniciarAnimacion(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const targetPorcentaje = this.getPorcentaje();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isRapidSwitch = now - this.lastAnimationTime < 2000 && this.lastAnimationTime > 0;
    this.lastAnimationTime = now;

    const durationMs = isRapidSwitch ? 400 : 1300;
    this.animationDurationMs = durationMs;

    this.isAnimating = true;
    this.porcentajeAnimado = targetPorcentaje;
    this.porcentajeContador = 0;
    this.cdr.detectChanges();

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const animar = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const ease = 1 - Math.pow(1 - progress, 3);
      this.porcentajeContador = Number((targetPorcentaje * ease).toFixed(2));
      this.cdr.detectChanges();

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(animar);
      } else {
        this.isAnimating = false;
        this.porcentajeContador = targetPorcentaje;
        this.cdr.detectChanges();
      }
    };

    this.animFrameId = requestAnimationFrame(animar);
  }

  getLabel(): string {
    if (this.modo === 'estimativo') {
      return this.mesSeleccionado ? `Progreso de ${this.mesSeleccionado}` : 'Progreso del mes';
    }
    return 'Progreso del año';
  }

  getColorPorcentaje(val?: number): string {
    const p = val !== undefined ? val : this.porcentajeContador;
    const porcentaje = Math.min(100, Math.max(0, p));
    // 0% -> Hue 0 (Rojo), 50% -> Hue 67 (Ámbar/Amarillo), 100% -> Hue 135 (Verde brillante)
    const hue = (porcentaje / 100) * 135;
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
    return isDark ? `hsl(${hue}, 95%, 55%)` : `hsl(${hue}, 90%, 38%)`;
  }

  getDiasTranscurridos(): number {
    if (this.modo === 'estimativo') {
      if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 0;
      return this.estimativoFilas.filter(
        (f) => f.real !== null && f.real !== undefined,
      ).length;
    }

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const anio = this.anioSeleccionado ? Number(this.anioSeleccionado) : anioActual;

    if (anio < anioActual) {
      return this.getTotalDias(); // Año pasado: 100% transcurrido
    }
    if (anio > anioActual) {
      return 0; // Año futuro: 0% transcurrido
    }

    const inicio = new Date(anioActual, 0, 0);
    const diff = hoy.getTime() - inicio.getTime();
    const unDia = 1000 * 60 * 60 * 24;
    return Math.floor(diff / unDia);
  }

  getTotalDias(): number {
    if (this.modo === 'estimativo') {
      if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 30;
      return this.estimativoFilas.length;
    }
    const anio = this.anioSeleccionado ? Number(this.anioSeleccionado) : new Date().getFullYear();
    return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0 ? 366 : 365;
  }

  getPorcentaje(): number {
    const total = this.getTotalDias();
    if (total === 0) return 0;
    return Math.round((this.getDiasTranscurridos() / total) * 10000) / 100;
  }
}
