import { Component, EventEmitter, Input, Output, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EntityPaymentService,
  EntityPayment,
  EntityPaymentRecord,
  EntidadAPagarInfo,
} from '../../../services/entity-payment.service';
import { evaluarFormula, ResultadoFormula } from '../../../utils/formula.util';

export type { EntidadAPagarInfo, EntityPayment, EntityPaymentRecord };

@Component({
  selector: 'app-modal-pagar-entidad',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './modal-pagar-entidad.component.html',
  styleUrls: ['./modal-pagar-entidad.component.scss'],
})
export class ModalPagarEntidadComponent implements OnInit {
  private paymentService = inject(EntityPaymentService);

  @Input({ required: true }) entidadInfo!: EntidadAPagarInfo;
  @Output() cerrar = new EventEmitter<void>();
  @Output() pagoConfirmado = new EventEmitter<EntityPayment | void>();
  @Output() abonoEliminado = new EventEmitter<void>();

  // Historial de abonos
  records = signal<EntityPaymentRecord[]>([]);
  isEliminandoRegistro = signal<string | null>(null);

  // Formulario nuevo abono
  tipoPago = signal<'TOTAL' | 'PARCIAL'>('TOTAL');
  montoInput = signal<string>('');
  fechaPago = signal<string>('');
  cuentaOrigen = signal<string>('Galicia');
  registrarMovimiento = signal<boolean>(true);
  modoOperacionFutura = signal<'ADELANTAR' | 'INTENCION'>('ADELANTAR');

  cuentasDisponibles = ['Galicia', 'Santander', 'Mercado Pago', 'Bancor', 'Naranja X', 'Efectivo'];

  isGuardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  // Computados principales
  totalOriginal = computed(() => {
    return Math.round(Number(this.entidadInfo.totalOriginal || 0) * 100) / 100;
  });

  totalYaAbonado = computed(() => {
    const recs = this.records();
    if (recs.length > 0) {
      const sum = recs.reduce((acc, r) => acc + Number(r.monto), 0);
      return Math.round(sum * 100) / 100;
    }
    return Math.round(Number(this.entidadInfo.pagoExistente?.montoPagado || 0) * 100) / 100;
  });

  saldoPendiente = computed(() => {
    const rem = this.totalOriginal() - this.totalYaAbonado();
    return Math.max(0, Math.round(rem * 100) / 100);
  });

  pagoYaCompleto = computed(() => {
    return this.saldoPendiente() === 0 && this.totalYaAbonado() > 0;
  });

  esMesFuturo = computed(() => {
    const hoy = new Date();
    const hoyYear = hoy.getFullYear();
    const hoyMes = hoy.getMonth() + 1;
    return (
      this.entidadInfo.year > hoyYear ||
      (this.entidadInfo.year === hoyYear && this.entidadInfo.mes > hoyMes)
    );
  });

  isPagoReal = computed(() => {
    return !this.esMesFuturo() || this.modoOperacionFutura() === 'ADELANTAR';
  });

  // Evaluación en vivo de la fórmula o monto ingresado
  resultadoFormula = computed<ResultadoFormula>(() => {
    return evaluarFormula(this.montoInput());
  });

  // Cálculo del abono que se realizará en esta operación
  montoAbonoActual = computed(() => {
    if (this.tipoPago() === 'TOTAL') {
      return this.saldoPendiente();
    }
    const evalRes = this.resultadoFormula();
    const parcial = evalRes.monto;
    return Math.min(parcial, this.saldoPendiente());
  });

  nuevoTotalAcumulado = computed(() => {
    return Math.round((this.totalYaAbonado() + this.montoAbonoActual()) * 100) / 100;
  });

  nuevoSaldoRestante = computed(() => {
    const rem = this.totalOriginal() - this.nuevoTotalAcumulado();
    return Math.max(0, Math.round(rem * 100) / 100);
  });

  ngOnInit(): void {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    this.fechaPago.set(`${yyyy}-${mm}-${dd}`);

    // 1. Cargar historial de abonos previos desde el input
    if (this.entidadInfo.pagoExistente?.records && this.entidadInfo.pagoExistente.records.length > 0) {
      this.records.set(this.entidadInfo.pagoExistente.records);
    } else if (this.entidadInfo.pagoExistente && Number(this.entidadInfo.pagoExistente.montoPagado) > 0) {
      this.records.set([
        {
          id: this.entidadInfo.pagoExistente.id || 'rec-legacy',
          paymentId: this.entidadInfo.pagoExistente.id,
          year: this.entidadInfo.year,
          mes: this.entidadInfo.mes,
          entidad: this.entidadInfo.entidad,
          itemId: this.entidadInfo.itemId,
          monto: Number(this.entidadInfo.pagoExistente.montoPagado),
          fechaPago: this.entidadInfo.pagoExistente.fechaPago || `${yyyy}-${mm}-${dd}`,
          cuentaOrigen: this.entidadInfo.pagoExistente.cuentaOrigen || 'Galicia',
          movimientoId: this.entidadInfo.pagoExistente.movimientoId,
          notas: this.entidadInfo.pagoExistente.notas,
        },
      ]);
    }

    // 2. Consulta fresca a la API para asegurar sincronización de registros
    this.paymentService.getPayments(this.entidadInfo.year, this.entidadInfo.mes).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const match = res.data.find(
            (p) =>
              p.entidad.toLowerCase() === this.entidadInfo.entidad.toLowerCase() &&
              (p.itemId || '') === (this.entidadInfo.itemId || '')
          );
          if (match) {
            if (match.records && match.records.length > 0) {
              this.records.set(match.records);
            }
            if (this.esMesFuturo()) {
              const fueAdelantoReal =
                !!match.movimientoId ||
                (match.records && match.records.some((r) => !!r.movimientoId));
              if (fueAdelantoReal) {
                this.modoOperacionFutura.set('ADELANTAR');
                this.registrarMovimiento.set(true);
              } else {
                this.modoOperacionFutura.set('INTENCION');
                this.registrarMovimiento.set(false);
              }
            }
          }
        }
      },
    });

    // 3. Inicializar valores de formulario
    const saldo = this.saldoPendiente();
    if (saldo > 0) {
      this.tipoPago.set('TOTAL');
      this.montoInput.set(saldo.toString());
    }

    if (this.entidadInfo.pagoExistente?.cuentaOrigen) {
      this.cuentaOrigen.set(this.entidadInfo.pagoExistente.cuentaOrigen);
    }

    // 4. En meses futuros por defecto es intención de pago (salvo que ya existiera movimiento bancario real)
    if (this.esMesFuturo()) {
      const fueAdelantoReal = !!this.entidadInfo.pagoExistente?.movimientoId;
      if (fueAdelantoReal) {
        this.modoOperacionFutura.set('ADELANTAR');
        this.registrarMovimiento.set(true);
      } else {
        this.modoOperacionFutura.set('INTENCION');
        this.registrarMovimiento.set(false);
      }
    } else {
      this.modoOperacionFutura.set('ADELANTAR');
      this.registrarMovimiento.set(true);
    }
  }

  setModoOperacionFutura(modo: 'ADELANTAR' | 'INTENCION'): void {
    this.modoOperacionFutura.set(modo);
    this.registrarMovimiento.set(modo === 'ADELANTAR');
  }

  setTipoPago(tipo: 'TOTAL' | 'PARCIAL'): void {
    this.tipoPago.set(tipo);
    this.errorMensaje.set(null);
    if (tipo === 'TOTAL') {
      this.montoInput.set(this.saldoPendiente().toString());
    } else {
      // Si cambia a parcial y aún tiene el saldo total o vacío, proponer la mitad o dejar editable
      if (this.montoAbonoActual() >= this.saldoPendiente() || !this.montoInput()) {
        this.montoInput.set(Math.round(this.saldoPendiente() / 2).toString());
      }
    }
  }

  onMontoInputChange(valorStr: string): void {
    this.montoInput.set(valorStr);
    this.errorMensaje.set(null);
  }

  eliminarAbono(rec: EntityPaymentRecord): void {
    if (!rec.id || rec.id.startsWith('rec-legacy')) {
      this.errorMensaje.set('No se puede eliminar un registro heredado no sincronizado.');
      return;
    }

    const confirmacion = confirm(
      `¿Deseas eliminar el abono de $ ${Number(rec.monto).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
      })} del ${new Date(rec.fechaPago).toLocaleDateString('es-AR')}? Se recalculará la deuda y el saldo compensatorio.`
    );
    if (!confirmacion) return;

    this.isEliminandoRegistro.set(rec.id);
    this.errorMensaje.set(null);

    this.paymentService.deletePaymentRecord(rec.id).subscribe({
      next: () => {
        this.isEliminandoRegistro.set(null);
        // Actualizar lista local de registros
        const actualizados = this.records().filter((r) => r.id !== rec.id);
        this.records.set(actualizados);
        // Ajustar monto sugerido si cambió el saldo pendiente
        this.montoInput.set(this.saldoPendiente().toString());
        // Notificar a la vista mensual para que refresque datos en segundo plano
        this.abonoEliminado.emit();
      },
      error: (err) => {
        this.isEliminandoRegistro.set(null);
        this.errorMensaje.set(err?.error?.message || 'Error al eliminar el abono.');
      },
    });
  }

  confirmarPago(): void {
    if (this.pagoYaCompleto()) {
      this.cerrar.emit();
      return;
    }

    const saldoPendiente = this.saldoPendiente();
    if (saldoPendiente <= 0) {
      this.cerrar.emit();
      return;
    }

    const esTotal = this.tipoPago() === 'TOTAL';
    if (!esTotal) {
      const resFormula = this.resultadoFormula();
      if (resFormula.error) {
        this.errorMensaje.set(`Fórmula inválida: ${resFormula.error}`);
        return;
      }
    }

    const monto = esTotal ? saldoPendiente : this.montoAbonoActual();

    if (monto <= 0 || isNaN(monto)) {
      this.errorMensaje.set('Ingresa un monto o fórmula válida mayor a $0.');
      return;
    }

    if (monto > saldoPendiente) {
      this.errorMensaje.set(
        `El monto a abonar ($ ${monto.toLocaleString('es-AR')}) no puede superar el saldo pendiente de $ ${saldoPendiente.toLocaleString('es-AR')}.`
      );
      return;
    }

    if (!this.fechaPago()) {
      this.errorMensaje.set('Debes seleccionar la fecha del pago.');
      return;
    }

    this.isGuardando.set(true);
    this.errorMensaje.set(null);

    const debeRegistrarMov = this.isPagoReal() ? this.registrarMovimiento() : false;
    const nuevoRestante = Math.max(0, Math.round((saldoPendiente - monto) * 100) / 100);
    const esTotalDefinitivo = esTotal || nuevoRestante === 0;

    this.paymentService
      .registerPayment({
        year: this.entidadInfo.year,
        mes: this.entidadInfo.mes,
        entidad: this.entidadInfo.entidad,
        itemId: this.entidadInfo.itemId || '',
        esTotal: esTotalDefinitivo,
        totalOriginal: this.totalOriginal(),
        montoPagado: monto,
        fechaPago: this.fechaPago(),
        cuentaOrigen: this.cuentaOrigen(),
        registrarMovimiento: debeRegistrarMov,
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
