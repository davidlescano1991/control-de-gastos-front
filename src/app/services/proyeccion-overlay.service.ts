import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ProyeccionOverlayService {
  visible = signal<boolean>(false);
  esModalCompleto = signal<boolean>(false);
  modo = signal<'fila' | 'completo'>('completo');

  anio = signal<number>(2026);
  mes = signal<string>('Octubre');
  entidadKey = signal<string>('');
  nombreEntidad = signal<string>('');
  logoUrl = signal<string>('');
  filaData = signal<{ descripcion: string; monto: unknown } | undefined>(undefined);

  posX = signal<number>(0);
  posY = signal<number>(0);

  private timerMostrar: any = null;
  private timerOcultar: any = null;

  mostrarTooltipFila(
    event: MouseEvent,
    entidadKey: string,
    nombreEntidad: string,
    anio: number,
    mes: string,
    fila: { descripcion: string; monto: unknown },
    logoUrl: string = '',
  ): void {
    if (this.esModalCompleto()) return;
    this.cancelarTimers();

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const x = rect ? rect.right + 12 : event.clientX + 16;
    const y = rect ? rect.top : event.clientY;

    this.timerMostrar = setTimeout(() => {
      this.modo.set('fila');
      this.entidadKey.set(entidadKey);
      this.nombreEntidad.set(nombreEntidad);
      this.anio.set(anio);
      this.mes.set(mes);
      this.filaData.set(fila);
      this.logoUrl.set(logoUrl);

      // Limitar coordenadas a los márgenes de la ventana
      const finalX = Math.min(x, window.innerWidth - 450);
      const finalY = Math.max(10, Math.min(y, window.innerHeight - 300));
      this.posX.set(finalX);
      this.posY.set(finalY);

      this.esModalCompleto.set(false);
      this.visible.set(true);
    }, 120);
  }

  mostrarTooltipTotal(
    event: MouseEvent,
    entidadKey: string,
    nombreEntidad: string,
    anio: number,
    mes: string,
    logoUrl: string = '',
  ): void {
    if (this.esModalCompleto()) return;
    this.cancelarTimers();

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const x = rect ? rect.right + 12 : event.clientX + 16;
    const y = rect ? rect.top - 40 : event.clientY;

    this.timerMostrar = setTimeout(() => {
      this.modo.set('completo');
      this.entidadKey.set(entidadKey);
      this.nombreEntidad.set(nombreEntidad);
      this.anio.set(anio);
      this.mes.set(mes);
      this.filaData.set(undefined);
      this.logoUrl.set(logoUrl);

      const finalX = Math.min(x, window.innerWidth - 820);
      const finalY = Math.max(20, Math.min(y, window.innerHeight - 450));
      this.posX.set(finalX);
      this.posY.set(finalY);

      this.esModalCompleto.set(false);
      this.visible.set(true);
    }, 140);
  }

  abrirModalCompleto(
    entidadKey: string,
    nombreEntidad: string,
    anio: number,
    mes: string,
    logoUrl: string = '',
  ): void {
    this.cancelarTimers();
    this.modo.set('completo');
    this.entidadKey.set(entidadKey);
    this.nombreEntidad.set(nombreEntidad);
    this.anio.set(anio);
    this.mes.set(mes);
    this.filaData.set(undefined);
    this.logoUrl.set(logoUrl);

    this.esModalCompleto.set(true);
    this.visible.set(true);
  }

  ocultarTooltip(): void {
    if (this.esModalCompleto()) return;
    this.cancelarTimers();

    this.timerOcultar = setTimeout(() => {
      if (!this.esModalCompleto()) {
        this.visible.set(false);
      }
    }, 220);
  }

  cancelarOcultar(): void {
    if (this.timerOcultar) {
      clearTimeout(this.timerOcultar);
      this.timerOcultar = null;
    }
  }

  cerrarTodo(): void {
    this.cancelarTimers();
    this.visible.set(false);
    this.esModalCompleto.set(false);
  }

  private cancelarTimers(): void {
    if (this.timerMostrar) {
      clearTimeout(this.timerMostrar);
      this.timerMostrar = null;
    }
    if (this.timerOcultar) {
      clearTimeout(this.timerOcultar);
      this.timerOcultar = null;
    }
  }
}
