import { Component, effect, Inject, inject, Input, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { CurrencyPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';

@Component({
  selector: 'app-master-galicia',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './master-galicia.html',
  providers: [CurrencyPipe],
  styleUrl: './master-galicia.scss'
})
export class MasterGalicia {
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
       this.isCargando.set(true);
      console.log('Esta cargando MasterCard Galicia ⏳');

      const datos = this.storeGoogle.entidadMasterGalicia(); // ya filtrado por mes
      const headers = this.storeGoogle.headerMasterGalicia(); // solo descripción + monto
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
      this.isCargando.set(false);
      console.log('Fin de la carga MasterCard Galicia ⏳');
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
 /*  datosMes = signal<any[]>([]);
  headers = signal<string[]>([]);
  totalMes = signal<number>(0);
  isCargando = signal(true);
  isBrowser = false;

  @Input() anio: number = 2025;
  @Input() mesSeleccionado: string = '';
  @Input() datosListos: boolean = false;
  private _anio = signal<number>(2025);
  private intentos = 0;
  private readonly maxIntentos = 10;
  constructor(
    private storeGoogle: MovimientosStoreGoogle,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  cargarDatos() {
    console.log('🔑 Clave usada en MasterGaliciaComponent:', `${this._anio()}_${this.mesSeleccionado}`);
    const clave = `${this._anio()}_${this.mesSeleccionado}`;
    console.log('📦 📦 📦 📦 📦 📦 📦 ENTRA A CARGAR DATOS Master Galicia');
    const registros = this.storeGoogle.getEntidadMasterGalicia(this._anio(), this.mesSeleccionado);
    const headers = this.storeGoogle.getHeaderMasterGalicia(this._anio(), this.mesSeleccionado);

    if ((!registros || registros.length === 0) && this.intentos < this.maxIntentos) {
      console.warn(`⚠️ No hay registros aún para clave ${clave}, intento ${this.intentos + 1}/${this.maxIntentos}`);
      this.intentos++;
      setTimeout(() => this.cargarDatos(), 50);
      return;
    }

    console.log('📦 MasterGalicia registros:', registros.length);
    console.log('📦 MasterGalicia cargando con clave:', clave);
    this.intentos = 0; // ✅ reset al éxito
    this.isCargando.set(true);
    this.datosMes.set(registros);
    this.headers.set(headers);

    const total = registros.reduce((acc, fila) => {
      const montoCrudo = fila['monto'];
      const monto = typeof montoCrudo === 'string'
        ? parseFloat(
          montoCrudo
            .replace(/\$/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
        )
        : typeof montoCrudo === 'number'
          ? montoCrudo
          : 0;

      return acc + (isNaN(monto) ? 0 : monto);
    }, 0);

    this.totalMes.set(total);
    this.isCargando.set(false);
  } */
  private overlayService = inject(ProyeccionOverlayService);
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
      'mastercard',
      this.entidad || 'Master Card Galicia',
      this.anio,
      this.mes,
      fila,
      'assets/logos/mastercard.svg',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'mastercard',
      this.entidad || 'Master Card Galicia',
      this.anio,
      this.mes,
      'assets/logos/mastercard.svg',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'mastercard',
      this.entidad || 'Master Card Galicia',
      this.anio,
      this.mes,
      'assets/logos/mastercard.svg',
    );
  }

  private calcularTotal(registros: any[]): number {
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
