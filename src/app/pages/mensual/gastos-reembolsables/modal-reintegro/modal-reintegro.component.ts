import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReembolsablesService } from '../../../../services/reembolsables.service';
import { evaluarFormula, ResultadoFormula } from '../../../../utils/formula.util';

@Component({
  selector: 'app-modal-reintegro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-reintegro.component.html',
  styleUrls: ['./modal-reintegro.component.scss'],
})
export class ModalReintegroComponent implements OnInit {
  private reembolsablesService = inject(ReembolsablesService);

  @Input({ required: true }) concepto!: string;
  @Input({ required: true }) montoSugerido!: number;
  @Input({ required: true }) mes!: string;
  @Input({ required: true }) year!: number;
  @Input() saldoPendiente: number = 0;

  @Output() cerrar = new EventEmitter<void>();
  @Output() confirmado = new EventEmitter<void>();

  montoInput = signal<string>('');
  cuentaDestino = signal<string>('Galicia');
  fecha = signal<string>('');
  descripcion = signal<string>('');

  cuentasDisponibles = [
    'Galicia',
    'Santander',
    'Mercado Pago',
    'Bancor',
    'Naranja X',
    'Efectivo',
  ];

  isGuardando = signal(false);
  errorMensaje = signal<string | null>(null);

  resultadoFormula = computed<ResultadoFormula>(() => {
    return evaluarFormula(this.montoInput());
  });

  montoFinal = computed<number>(() => {
    const res = this.resultadoFormula();
    return res.monto ?? 0;
  });

  ngOnInit(): void {
    const hoy = new Date().toISOString().split('T')[0];
    this.fecha.set(hoy);

    const sugerido = this.saldoPendiente > 0 ? this.saldoPendiente : this.montoSugerido;
    this.montoInput.set(sugerido > 0 ? sugerido.toFixed(2) : '');
    this.descripcion.set(`Reintegro ${this.concepto || 'Gastos Compartidos'} (${this.mes} ${this.year})`);
  }

  onMontoChange(val: string): void {
    this.montoInput.set(val);
    this.errorMensaje.set(null);
  }

  confirmar(): void {
    const monto = this.montoFinal();
    if (monto <= 0) {
      this.errorMensaje.set('Ingresa un monto válido mayor a $0.');
      return;
    }

    if (!this.fecha()) {
      this.errorMensaje.set('Debes seleccionar la fecha del reintegro.');
      return;
    }

    this.isGuardando.set(true);
    this.errorMensaje.set(null);

    this.reembolsablesService
      .registrarReintegro({
        year: this.year,
        mes: this.mes,
        monto,
        cuentaDestino: this.cuentaDestino(),
        fecha: this.fecha(),
        concepto: this.concepto,
        descripcion: this.descripcion(),
      })
      .subscribe({
        next: () => {
          this.isGuardando.set(false);
          this.confirmado.emit();
        },
        error: (err) => {
          this.isGuardando.set(false);
          this.errorMensaje.set(
            err?.error?.message || 'Error al registrar el movimiento de reintegro.'
          );
        },
      });
  }
}
