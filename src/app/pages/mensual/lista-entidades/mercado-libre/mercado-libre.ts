import { NgFor, NgIf, CurrencyPipe } from '@angular/common';
import { Component, Input, signal, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';

interface MercadoLibreFila {
  descripcion?: string;
  monto?: string | number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-mercado-libre',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './mercado-libre.html',
  styleUrl: './mercado-libre.scss',
})
export class MercadoLibre {
  private overlayService = inject(ProyeccionOverlayService);
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() anio!: number;

  @Input() mes!: string;
  @Input() entidad = '';
  @Input() isCargando = false;

  @Input() set datos(value: MercadoLibreFila[] | null | undefined) {
    const claveActual = JSON.stringify(value);
    if (claveActual === this.ultimaClave) return;

    this.ultimaClave = claveActual;
    this.datosMes.set(value ?? []);
    this.totalMes.set(this.calcularTotal(value ?? []));
  }
  private ultimaClave = '';

  datosMes = signal<MercadoLibreFila[]>([]);
  totalMes = signal<number>(0);

  onHoverFila(event: MouseEvent, fila: any): void {
    this.overlayService.mostrarTooltipFila(
      event,
      'ml',
      this.entidad || 'Mercado Libre',
      this.anio,
      this.mes,
      fila,
      'assets/logos/mercadopago.png',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'ml',
      this.entidad || 'Mercado Libre',
      this.anio,
      this.mes,
      'assets/logos/mercadopago.png',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'ml',
      this.entidad || 'Mercado Libre',
      this.anio,
      this.mes,
      'assets/logos/mercadopago.png',
    );
  }

  private calcularTotal(registros: MercadoLibreFila[]): number {
    console.log(
      `calcularTotal() de MercadoLibreComponent --> registros:  `,
      JSON.stringify(registros),
    );
    return registros.reduce((acc, fila) => {
      const montoCrudo = fila['monto'];
      const monto =
        typeof montoCrudo === 'string'
          ? parseFloat(montoCrudo.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'))
          : typeof montoCrudo === 'number'
            ? montoCrudo
            : 0;
      return acc + (isNaN(monto) ? 0 : monto);
    }, 0);
  }

  esNuevo(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }

  esUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    return !!match;
  }
}
