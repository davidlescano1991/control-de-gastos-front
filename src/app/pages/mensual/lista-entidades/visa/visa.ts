import { AuthService } from '../../../../services/auth.service';
import { Component, Input, signal, inject , EventEmitter, Output } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';
import { computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EntidadAPagarInfo } from '../../modal-pagar-entidad/modal-pagar-entidad.component';
import { EntityPaymentService, EntityPayment } from '../../../../services/entity-payment.service';

@Component({
  selector: 'app-visa',
  templateUrl: './visa.html',
  styleUrls: ['./visa.scss'],
  providers: [CurrencyPipe],
  standalone: true,
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule, MatIconModule],
})
export class VisaComponent {
  private paymentService = inject(EntityPaymentService);
  modalPagoAbierto = signal(false);

  private MESES_MAP: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
  };

  getMesNumero(): number {
    const normal = (this.mes || '').toLowerCase().trim();
    return this.MESES_MAP[normal] || (new Date().getMonth() + 1);
  }

  pagoInfo = computed(() => {
    const mesNum = this.getMesNumero();
    const key = `${this.anio}::${mesNum}`;
    const pagos = this.paymentService.pagosMesSignal().get(key) || [];
    return pagos.find(p => p.entidad.toLowerCase().includes('visa') && (!p.itemId || p.itemId === '')) || null;
  });

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
      return `Pago parcial: Abonado $ ${p.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Resta $ ${p.montoRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`;
    }
    return 'No pagado (Pendiente de pago)';
  });

  entidadAPagarInfo = computed<EntidadAPagarInfo>(() => {
    return {
      year: this.anio,
      mes: this.getMesNumero(),
      mesNombre: this.mes,
      entidad: this.entidad || 'Visa Galicia',
      totalOriginal: this.totalMes(),
      pagoExistente: this.pagoInfo() || undefined,
    };
  });

  abrirModalPago(): void {
    this.paymentService.abrirModalPago(this.entidadAPagarInfo());
  }

  onPagoConfirmado(pago: EntityPayment): void {
    this.modalPagoAbierto.set(false);
  }

  public authService = inject(AuthService);
  @Output() editarFila = new EventEmitter<any>();

  onEditarFila(fila: any, event: MouseEvent): void {
    event.stopPropagation();
    this.editarFila.emit(fila);
  }

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
      'visa',
      this.entidad || 'Visa Galicia',
      this.anio,
      this.mes,
      fila,
      'assets/logos/visa.png',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'visa',
      this.entidad || 'Visa Galicia',
      this.anio,
      this.mes,
      'assets/logos/visa.png',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'visa',
      this.entidad || 'Visa Galicia',
      this.anio,
      this.mes,
      'assets/logos/visa.png',
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

