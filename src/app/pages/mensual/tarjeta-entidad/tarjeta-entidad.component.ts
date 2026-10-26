import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { ProyeccionOverlayService } from '../../../services/proyeccion-overlay.service';
import { EntityPaymentService } from '../../../services/entity-payment.service';
import { EntidadAPagarInfo } from '../modal-pagar-entidad/modal-pagar-entidad.component';

export interface TarjetaEntidadItem {
  id?: string;
  nombre: string;
  key?: string;
  colorVar?: string;
  logoUrl?: string;
  datos: any[];
}

@Component({
  selector: 'app-tarjeta-entidad',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  providers: [CurrencyPipe],
  templateUrl: './tarjeta-entidad.component.html',
  styleUrls: ['./tarjeta-entidad.component.scss'],
})
export class TarjetaEntidadComponent {
  public authService = inject(AuthService);
  private paymentService = inject(EntityPaymentService);
  private overlayService = inject(ProyeccionOverlayService);

  @Input() anio!: number;
  @Input() mes!: string;
  @Input() entidad: string = '';
  @Input() key?: string;
  @Input() logoUrl?: string;
  @Input() colorHeader?: string;
  @Input() isCargando: boolean = false;
  @Input() pagoInformativo: any = null;
  @Input() mostrarOrigen: boolean = true;
  @Input() esOrigenBD: boolean = false;
  @Input() leyendaOrigen: string = '';

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  @Input() set datos(value: any[]) {
    const claveActual = JSON.stringify(value);
    if (claveActual === this.ultimaClave) return;
    this.ultimaClave = claveActual;
    this.datosMes.set(value ?? []);
    this.totalMes.set(this.calcularTotal(value ?? []));
  }

  @Output() eliminarEntidad = new EventEmitter<string>();
  @Output() editarFila = new EventEmitter<any>();
  @Output() eliminarFila = new EventEmitter<any>();

  isCollapsed = signal<boolean>(false);
  datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);
  private ultimaClave = '';

  private MESES_MAP: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };

  getMesNumero(): number {
    const normal = (this.mes || '').toLowerCase().trim();
    return this.MESES_MAP[normal] || (new Date().getMonth() + 1);
  }

  get entidadKey(): string {
    if (this.key) return this.key;
    const norm = (this.entidad || '').toLowerCase().trim();
    if (norm.includes('visa')) return 'visa';
    if (norm.includes('master')) return 'mastercard';
    if (norm.includes('naranja')) return 'naranja';
    if (norm.includes('bancor')) return 'bancor';
    if (norm.includes('mercado') || norm.includes('ml')) return 'ml';
    if (norm.includes('otros')) return 'otros';
    return norm.replace(/\s+/g, '_');
  }

  logoError = signal<boolean>(false);

  onLogoError(): void {
    this.logoError.set(true);
  }

  getLogoUrl(): string {
    if (this.logoUrl !== undefined && this.logoUrl !== null) return this.logoUrl;
    const k = this.entidadKey;
    if (k === 'visa') return 'assets/logos/visa.png';
    if (k === 'mastercard') return 'assets/logos/mastercard.svg';
    if (k === 'naranja') return 'assets/logos/naranja.png';
    if (k === 'bancor') return 'assets/logos/bancor.png';
    if (k === 'ml') return 'assets/logos/mercadopago.png';
    if (k === 'otros') return '';
    return '';
  }

  getHeaderColor(): string {
    if (this.colorHeader) return this.colorHeader;
    const k = this.entidadKey;
    if (k === 'visa') return 'var(--color-entidad-visa, #768699)';
    if (k === 'mastercard') return 'var(--color-entidad-mastercard, #768699)';
    if (k === 'naranja') return 'var(--color-entidad-naranja, #ff8104)';
    if (k === 'bancor') return 'var(--color-entidad-bancor, #005f5a)';
    if (k === 'ml') return 'var(--color-entidad-ml, #f8cb01)';
    if (k === 'otros') return 'var(--color-entidad-otros, #c10090)';
    return '#4b5896';
  }

  esHeaderClaro = computed<boolean>(() => {
    const k = this.entidadKey;
    const norm = (this.entidad || '').toLowerCase();
    return k === 'ml' || norm.includes('mercado') || norm.includes('ml');
  });

  pagoInfo = computed(() => {
    const mesNum = this.getMesNumero();
    const key = `${this.anio}::${mesNum}`;
    const pagos = this.paymentService.pagosMesSignal().get(key) || [];
    const entNorm = (this.entidad || '').toLowerCase().trim();
    const kNorm = (this.entidadKey || '').toLowerCase().trim();
    return (
      pagos.find(
        (p) =>
          (p.entidad.toLowerCase().includes(entNorm) ||
            entNorm.includes(p.entidad.toLowerCase()) ||
            (kNorm && p.entidad.toLowerCase().includes(kNorm))) &&
          (!p.itemId || p.itemId === '')
      ) || null
    );
  });

  mostrarIntencionPago = computed(() => {
    const p = this.pagoInfo();
    if (!p) return false;
    if (p.estado === 'COMPLETO' || (p.montoRestante !== undefined && p.montoRestante <= 0)) {
      return false;
    }
    const total = this.totalMes();
    if (total <= 0) return false;
    const centavosPagados = Math.round(Number(p.montoPagado) * 100);
    const centavosTotal = Math.round(Number(total) * 100);
    return centavosPagados < centavosTotal;
  });

  esMesFuturo(): boolean {
    const hoy = new Date();
    const hoyYear = hoy.getFullYear();
    const hoyMes = hoy.getMonth() + 1;
    const mesNum = this.getMesNumero();
    return this.anio > hoyYear || (this.anio === hoyYear && mesNum > hoyMes);
  }

  esIntencionPago(): boolean {
    if (!this.esMesFuturo()) return false;
    const p = this.pagoInfo();
    return !p?.movimientoId;
  }

  estadoPago = computed<'COMPLETO' | 'PARCIAL' | 'NO_PAGADO'>(() => {
    const p = this.pagoInfo();
    if (p) {
      if (p.estado === 'COMPLETO') return 'COMPLETO';
      if (p.estado === 'PARCIAL') return 'PARCIAL';
      return 'NO_PAGADO';
    }
    const esHistorico = this.anio < 2026 || (this.anio === 2026 && this.getMesNumero() < 10);
    if (esHistorico) return 'COMPLETO';
    if (this.totalMes() === 0) return 'COMPLETO';
    return 'NO_PAGADO';
  });

  iconoEstadoPago = computed(() => {
    const estado = this.estadoPago();
    if (estado === 'COMPLETO') return 'check_circle';
    if (estado === 'PARCIAL') return 'pending';
    return 'cancel';
  });

  tooltipEstadoPago = computed(() => {
    const estado = this.estadoPago();
    const p = this.pagoInfo();
    if (estado === 'COMPLETO') {
      if (p?.fechaPago) {
        return `Pagado en su totalidad el ${new Date(p.fechaPago).toLocaleDateString('es-AR')}`;
      }
      return 'Pagado en su totalidad';
    }
    if (estado === 'PARCIAL' && p) {
      return `Pago parcial: Abonado $ ${Number(p.montoPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Resta $ ${Number(p.montoRestante).toLocaleString('es-AR', { minimumFractionDigits: 2 })})`;
    }
    return 'No pagado (Pendiente de pago)';
  });

  entidadAPagarInfo = computed<EntidadAPagarInfo>(() => {
    return {
      year: this.anio,
      mes: this.getMesNumero(),
      mesNombre: this.mes,
      entidad: this.entidad || 'Entidad',
      totalOriginal: this.totalMes(),
      pagoExistente: this.pagoInfo() || undefined,
    };
  });

  abrirModalPago(): void {
    this.paymentService.abrirModalPago(this.entidadAPagarInfo());
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }

  onEditarFila(fila: any, event: MouseEvent): void {
    event.stopPropagation();
    this.editarFila.emit(fila);
  }

  onEliminarFila(fila: any, event: MouseEvent): void {
    event.stopPropagation();
    this.eliminarFila.emit(fila);
  }

  solicitarBajaEntidad(event: MouseEvent): void {
    event.stopPropagation();
    this.eliminarEntidad.emit(this.entidad);
  }

  onHoverFila(event: MouseEvent, fila: any): void {
    this.overlayService.mostrarTooltipFila(
      event,
      this.entidadKey,
      this.entidad,
      this.anio,
      this.mes,
      fila,
      this.getLogoUrl()
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      this.entidadKey,
      this.entidad,
      this.anio,
      this.mes,
      this.getLogoUrl()
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      this.entidadKey,
      this.entidad,
      this.anio,
      this.mes,
      this.getLogoUrl()
    );
  }

  private calcularTotal(registros: any[]): number {
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
