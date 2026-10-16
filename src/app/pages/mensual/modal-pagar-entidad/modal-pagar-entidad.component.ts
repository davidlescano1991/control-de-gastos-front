import { Component, EventEmitter, Input, Output, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EntityPaymentService, EntityPayment } from '../../../services/entity-payment.service';

export interface EntidadAPagarInfo {
  year: number;
  mes: number;
  mesNombre: string;
  entidad: string;
  itemId?: string;
  concepto?: string;
  totalOriginal: number;
  pagoExistente?: EntityPayment;
}

@Component({
  selector: 'app-modal-pagar-entidad',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-pagar-entidad.component.html',
  styleUrls: ['./modal-pagar-entidad.component.scss'],
})
export class ModalPagarEntidadComponent implements OnInit {
  private paymentService = inject(EntityPaymentService);

  @Input({ required: true }) entidadInfo!: EntidadAPagarInfo;
  @Output() cerrar = new EventEmitter<void>();
  @Output() pagoConfirmado = new EventEmitter<EntityPayment>();

  tipoPago = signal<'TOTAL' | 'PARCIAL'>('TOTAL');
  montoParcial = signal<number>(0);
  fechaPago = signal<string>('');
  cuentaOrigen = signal<string>('Galicia');
  registrarMovimiento = signal<boolean>(true);

  cuentasDisponibles = ['Galicia', 'Santander', 'Mercado Pago', 'Bancor', 'Naranja X', 'Efectivo'];

  isGuardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  montoAPagar = computed(() => {
    return this.tipoPago() === 'TOTAL'
      ? this.entidadInfo.totalOriginal
      : Number(this.montoParcial() || 0);
  });

  montoRestante = computed(() => {
    const total = this.entidadInfo.totalOriginal;
    const pagado = this.montoAPagar();
    return Math.max(0, total - pagado);
  });

  ngOnInit(): void {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    this.fechaPago.set(`${yyyy}-${mm}-${dd}`);

    // Si ya tenía un pago parcial previo, precargarlo
    if (this.entidadInfo.pagoExistente && this.entidadInfo.pagoExistente.estado === 'PARCIAL') {
      this.tipoPago.set('PARCIAL');
      this.montoParcial.set(this.entidadInfo.pagoExistente.montoPagado);
      if (this.entidadInfo.pagoExistente.cuentaOrigen) {
        this.cuentaOrigen.set(this.entidadInfo.pagoExistente.cuentaOrigen);
      }
    } else {
      // Por defecto pago total
      this.tipoPago.set('TOTAL');
      this.montoParcial.set(Math.round(this.entidadInfo.totalOriginal / 2));
    }
  }

  setTipoPago(tipo: 'TOTAL' | 'PARCIAL'): void {
    this.tipoPago.set(tipo);
    if (tipo === 'TOTAL') {
      this.errorMensaje.set(null);
    }
  }

  onMontoParcialChange(valorStr: string): void {
    const limpio = valorStr.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(limpio);
    this.montoParcial.set(isNaN(num) ? 0 : num);
  }

  confirmarPago(): void {
    const total = this.entidadInfo.totalOriginal;
    const esTotal = this.tipoPago() === 'TOTAL';
    const monto = esTotal ? total : this.montoParcial();

    if (!esTotal && (monto <= 0 || isNaN(monto))) {
      this.errorMensaje.set('Ingresa un monto válido mayor a $0.');
      return;
    }

    if (!esTotal && monto >= total) {
      this.tipoPago.set('TOTAL');
    }

    if (!this.fechaPago()) {
      this.errorMensaje.set('Debes seleccionar la fecha del pago.');
      return;
    }

    this.isGuardando.set(true);
    this.errorMensaje.set(null);

    this.paymentService
      .registerPayment({
        year: this.entidadInfo.year,
        mes: this.entidadInfo.mes,
        entidad: this.entidadInfo.entidad,
        itemId: this.entidadInfo.itemId || '',
        esTotal: this.tipoPago() === 'TOTAL',
        totalOriginal: total,
        montoPagado: this.montoAPagar(),
        fechaPago: this.fechaPago(),
        cuentaOrigen: this.cuentaOrigen(),
        registrarMovimiento: this.registrarMovimiento(),
      })
      .subscribe({
        next: (res) => {
          this.isGuardando.set(false);
          this.pagoConfirmado.emit(res.data);
          this.cerrar.emit();
        },
        error: (err) => {
          this.isGuardando.set(false);
          this.errorMensaje.set(err?.error?.message || 'Error al registrar el pago. Inténtalo nuevamente.');
        },
      });
  }
}
