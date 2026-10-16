import { Component, EventEmitter, Input, Output, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoansService } from '../../../../services/loans.service';

export interface CuotaAPagarInfo {
  loanId: string;
  nombrePrestamo: string;
  entidad: string;
  mesNombre: string;
  mesNumero: number;
  anio: number;
  numeroCuota: number;
  totalCuotas?: number;
  monto: number;
}

@Component({
  selector: 'app-modal-pagar-cuota-prestamo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-pagar-cuota-prestamo.component.html',
  styleUrls: ['./modal-pagar-cuota-prestamo.component.scss'],
})
export class ModalPagarCuotaPrestamoComponent implements OnInit {
  private loansService = inject(LoansService);

  @Input({ required: true }) cuotaInfo!: CuotaAPagarInfo;
  @Output() cerrar = new EventEmitter<void>();
  @Output() cuotaPagada = new EventEmitter<{
    loanId: string;
    numeroCuota: number;
    fechaPago: string;
  }>();

  fechaPago = signal<string>('');
  registrarMovimiento = signal<boolean>(true);
  actualizarEstimativos = signal<boolean>(true);

  isGuardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);
  exitoMensaje = signal<string | null>(null);

  ngOnInit(): void {
    const hoy = new Date();
    // Fecha por defecto: hoy
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    this.fechaPago.set(`${yyyy}-${mm}-${dd}`);
  }

  confirmarPago(): void {
    if (!this.fechaPago() || this.isGuardando()) return;

    this.isGuardando.set(true);
    this.errorMensaje.set(null);
    this.exitoMensaje.set(null);

    const fPago = this.fechaPago();

    this.loansService
      .setInstallmentPaid(this.cuotaInfo.loanId, this.cuotaInfo.numeroCuota, true, {
        fechaPago: fPago,
        registrarMovimiento: this.registrarMovimiento(),
      })
      .subscribe({
        next: () => {
          this.isGuardando.set(false);
          this.exitoMensaje.set('¡Cuota registrada como pagada con éxito! Se actualizó la Deuda Real y Movimientos.');
          setTimeout(() => {
            this.cuotaPagada.emit({
              loanId: this.cuotaInfo.loanId,
              numeroCuota: this.cuotaInfo.numeroCuota,
              fechaPago: fPago,
            });
            this.cerrar.emit();
          }, 1000);
        },
        error: (err) => {
          this.isGuardando.set(false);
          const msg = err?.error?.message || err?.message || 'Error al asentar el pago de la cuota.';
          this.errorMensaje.set(msg);
        },
      });
  }

  onCerrar(): void {
    if (!this.isGuardando()) {
      this.cerrar.emit();
    }
  }
}
