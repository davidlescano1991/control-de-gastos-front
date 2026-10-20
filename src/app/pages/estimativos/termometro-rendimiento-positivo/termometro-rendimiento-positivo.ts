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
import { MatTooltipModule } from '@angular/material/tooltip';

export interface EstimativoFilaItem {
  fecha?: string;
  saldoPesos?: number;
  real?: number | null;
  [key: string]: any;
}

@Component({
  selector: 'app-termometro-rendimiento-positivo',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './termometro-rendimiento-positivo.html',
  styleUrl: './termometro-rendimiento-positivo.scss',
})
export class TermometroRendimientoPositivoComponent implements OnInit, OnChanges, OnDestroy {
  isCollapsed = signal(false);
  private cdr = inject(ChangeDetectorRef);

  @Input() anioSeleccionado: number = new Date().getFullYear();
  @Input() mesSeleccionado: string = '';
  @Input() estimativoFilas: EstimativoFilaItem[] = [];
  @Input() porcentajeExcel: number | null = null;

  porcentajeAnimado = 0;
  porcentajeContador = 0;
  isAnimating = false;
  animationDurationMs = 1300;
  private lastAnimationTime = 0;
  private animFrameId: any = null;

  get totalDias(): number {
    return this.getTotalDias();
  }

  get ticks(): number[] {
    const total = this.totalDias;
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

  toggleCollapse(): void {
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
      changes['porcentajeExcel']
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
    const mesLimpio = (this.mesSeleccionado || '').split('_')[0];
    return mesLimpio ? `Rendimiento de ${mesLimpio}` : 'Rendimiento del mes';
  }

  getColorPorcentaje(val?: number): string {
    const p = val !== undefined ? val : this.porcentajeContador;
    const porcentaje = Math.min(100, Math.max(0, p));
    // Gradiente dinámico: 0% -> Rojo (Hue 0), 50% -> Amarillo/Ámbar (Hue 48), 100% -> Verde Esmeralda (Hue 142)
    const hue = (porcentaje / 100) * 142;
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
    return isDark ? `hsl(${hue}, 95%, 52%)` : `hsl(${hue}, 88%, 38%)`;
  }

  getTotalDias(): number {
    if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 30;
    return this.estimativoFilas.length;
  }

  getDiasCargados(): number {
    if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 0;
    return this.estimativoFilas.filter(
      (f) => f.real !== null && f.real !== undefined,
    ).length;
  }

  getDiasPositivos(): number {
    if (this.porcentajeExcel !== null && this.porcentajeExcel !== undefined && this.porcentajeExcel > 0) {
      const total = this.getTotalDias();
      return Math.round((this.porcentajeExcel / 100) * total);
    }
    if (!this.estimativoFilas || this.estimativoFilas.length === 0) return 0;
    return this.estimativoFilas.filter(
      (f) =>
        f.real !== null &&
        f.real !== undefined &&
        Number(f.real) - Number(f.saldoPesos || 0) > 0,
    ).length;
  }

  getPorcentaje(): number {
    if (this.porcentajeExcel !== null && this.porcentajeExcel !== undefined && this.porcentajeExcel > 0) {
      return this.porcentajeExcel;
    }
    const total = this.getTotalDias();
    if (total === 0) return 0;
    return Math.round((this.getDiasPositivos() / total) * 10000) / 100;
  }

  getPorcentajeDiasCargados(): number {
    const cargados = this.getDiasCargados();
    if (cargados === 0) return 0;
    return Math.round((this.getDiasPositivos() / cargados) * 10000) / 100;
  }

  getDetalleTooltip(): string {
    const pos = this.getDiasPositivos();
    const cargados = this.getDiasCargados();
    const total = this.getTotalDias();
    const pctTotal = this.getPorcentaje().toFixed(2);
    const pctCargados = this.getPorcentajeDiasCargados().toFixed(2);
    return `${pos} días con rendimiento positivo sobre ${total} días del ciclo (${pctTotal}% del mes). ` +
      `Representa el ${pctCargados}% de los ${cargados} días registrados hasta el momento.`;
  }
}
