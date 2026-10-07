import { Component, effect, Inject, inject, Input, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { CurrencyPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';

@Component({
  selector: 'app-bancor',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './bancor.html',
  styleUrl: './bancor.scss',
  providers: [CurrencyPipe]
})
export class Bancor {
  private overlayService = inject(ProyeccionOverlayService);
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  /* datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);
  headers = signal<string[]>([]);
  mesSeleccionado = ''; // si querés mostrar el mes
  isCargando = signal(false);
  
  constructor(private storeGoogle: MovimientosStoreGoogle) {
    effect(() => {
      this.isCargando.set(true); // ⏳ empieza la carga
      console.log('Esta cargando Bancor ⏳');
      const datos = this.storeGoogle.entidadBancor(); // ✅ esto es reactivo
      const headers = this.storeGoogle.headerBancor(); // ✅ también reactivo

      this.datosMes.set(datos);
      this.headers.set(headers);

      const total = datos.reduce((acc, fila) => {
        const valores = Object.values(fila);
        const montoCrudo = valores[1];
        const monto = typeof montoCrudo === 'string'
          ? parseFloat(montoCrudo.replace(/\./g, '').replace(',', '.').replace('$', ''))
          : typeof montoCrudo === 'number'
            ? montoCrudo
            : 0;
        return acc + monto;
      }, 0);

      this.totalMes.set(total);
      this.isCargando.set(false); // ✅ termina la carga
      console.log('Fin de la carga Bancor⏳');
    });
  }

  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, c =>
        ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c)
      );
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
    if (match) {
      const cuota = match[0]; // por ejemplo "6/6", mas adelanto seriviria para tomar el valor
    }
    return !!match;
  } */
  @Input() anio!: number;
  @Input() mes!: string;
  @Input() entidad: string = '';
  @Input() isCargando: boolean = false;

  @Input() set datos(value: any[]) {
    const claveActual = JSON.stringify(value);
    if (claveActual === this.ultimaClave) return;

    this.ultimaClave = claveActual;
    this.datosMes.set(value ?? []);
    this.totalMes.set(this.calcularTotal(value ?? []));
  }
  private ultimaClave = '';

  datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);

  onHoverFila(event: MouseEvent, fila: any): void {
    this.overlayService.mostrarTooltipFila(
      event,
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      fila,
      'assets/logos/bancor.png',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      'assets/logos/bancor.png',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      'assets/logos/bancor.png',
    );
  }

  private calcularTotal(registros: any[]): number {
    console.log(`calcularTotal() de BancorComponet --> registros:  `, JSON.stringify(registros));
    return registros.reduce((acc, fila) => {
      const montoCrudo = fila['monto'];
      const monto = typeof montoCrudo === 'string'
        ? parseFloat(montoCrudo.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'))
        : typeof montoCrudo === 'number' ? montoCrudo : 0;
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
