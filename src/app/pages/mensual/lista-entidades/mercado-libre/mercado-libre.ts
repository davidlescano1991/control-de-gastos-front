import { AuthService } from '../../../../services/auth.service';
import { NgFor, NgIf, CurrencyPipe } from '@angular/common';
import { Component, Input, signal, inject , EventEmitter, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';
import { computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EntidadAPagarInfo } from '../../modal-pagar-entidad/modal-pagar-entidad.component';
import { EntityPaymentService, EntityPayment } from '../../../../services/entity-payment.service';

interface MercadoLibreFila {
  descripcion?: string;
  monto?: string | number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-mercado-libre',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule, MatIconModule],
  templateUrl: './mercado-libre.html',
  styleUrl: './mercado-libre.scss',
})
export class MercadoLibre {
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
    return pagos.find(p => p.entidad.toLowerCase().includes('mercado') && (!p.itemId || p.itemId === '')) || null;
  });

  estadoPago = computed(() => {
    return this.pagoInfo()?.estado || null;
  });

  tooltipEstadoPago = computed(() => {
    const p = this.pagoInfo();
    if (!p) return '';
    if (p.estado === 'COMPLETO') {
      return `Pagado en su totalidad${p.fechaPago ? ' el ' + new Date(p.fechaPago).toLocaleDateString('es-AR') : ''}`;
    }
    return `Pago parcial: Abonado $ ${p.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Resta $ ${p.montoRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`;
  });

  entidadAPagarInfo = computed<EntidadAPagarInfo>(() => {
    return {
      year: this.anio,
      mes: this.getMesNumero(),
      mesNombre: this.mes,
      entidad: this.entidad || 'Mercado Libre',
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
