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
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ReembolsablesService,
  ModalItemReembolsableInfo,
} from '../../../../services/reembolsables.service';
import { evaluarFormula, ResultadoFormula } from '../../../../utils/formula.util';

@Component({
  selector: 'app-modal-item-reembolsable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-item-reembolsable.component.html',
  styleUrls: ['./modal-item-reembolsable.component.scss'],
})
export class ModalItemReembolsableComponent implements OnInit {
  private reembolsablesService = inject(ReembolsablesService);

  @Input({ required: true }) info!: ModalItemReembolsableInfo;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  concepto = signal<string>('');
  montoOFormula = signal<string>('');
  tipo = signal<'SERVICIO' | 'APORTE'>('SERVICIO');

  isGuardando = signal(false);
  errorMensaje = signal<string | null>(null);

  resultadoFormula = computed<ResultadoFormula>(() => {
    return evaluarFormula(this.montoOFormula());
  });

  montoFinal = computed<number>(() => {
    const res = this.resultadoFormula();
    return res.monto ?? 0;
  });

  ngOnInit(): void {
    if (this.info.modo === 'EDITAR' && this.info.item) {
      this.concepto.set(this.info.item.concepto);
      this.montoOFormula.set(
        this.info.item.formula ||
          (this.info.item.monto > 0 ? this.info.item.monto.toString() : '')
      );
      this.tipo.set(this.info.item.tipo || 'SERVICIO');
    } else {
      this.tipo.set(this.info.tipoPorDefecto || 'SERVICIO');
      if (this.tipo() === 'APORTE') {
        this.concepto.set('Mamá');
      }
    }
  }

  onMontoChange(val: string): void {
    this.montoOFormula.set(val);
    this.errorMensaje.set(null);
  }

  async confirmar(): Promise<void> {
    const conc = this.concepto().trim();
    if (!conc) {
      this.errorMensaje.set('Debes ingresar un nombre para el concepto o servicio.');
      return;
    }

    const resFormula = this.resultadoFormula();
    if (resFormula.error) {
      this.errorMensaje.set(`Fórmula inválida: ${resFormula.error}`);
      return;
    }

    this.isGuardando.set(true);
    this.errorMensaje.set(null);

    try {
      await this.reembolsablesService.guardarItem(
        this.info,
        conc,
        this.montoOFormula().trim() || '0',
        this.tipo()
      );
      this.isGuardando.set(false);
      this.guardado.emit();
    } catch (err: any) {
      this.isGuardando.set(false);
      this.errorMensaje.set(
        err?.error?.message || err?.message || 'Error al guardar el ítem.'
      );
    }
  }
}
