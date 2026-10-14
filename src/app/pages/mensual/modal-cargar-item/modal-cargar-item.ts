import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MensualItemsService, UpdateMonthlyItemPayload } from '../../../services/mensual-items.service';
import { ThemeService } from '../../../services/theme.service';

export interface EntidadOption {
  id: string;
  nombre: string;
  logoUrl?: string;
  color: string;
}

@Component({
  selector: 'app-modal-cargar-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  templateUrl: './modal-cargar-item.html',
  styleUrls: ['./modal-cargar-item.scss'],
})
export class ModalCargarItemComponent {
  private mensualService = inject(MensualItemsService);
  public themeService = inject(ThemeService);

  @Input() visible = false;
  @Input() set anioSeleccionado(val: number) {
    if (val) this.anio.set(val);
  }
  @Input() set mesSeleccionado(val: string) {
    if (val) this.mes.set(val);
  }
  @Input() set entidadPreseleccionada(val: string) {
    if (val) this.entidad.set(val);
  }

  @Input() set itemAEditar(val: any) {
    if (val && val.id) {
      this.esModoEdicion.set(true);
      this.itemId.set(val.id);
      this.concepto.set(val.descripcion || val.concepto || '');

      // Formula o monto
      if (val.formula) {
        this.montoOFormula.set(val.formula);
      } else if (val.montoCrudo !== undefined && val.montoCrudo !== null) {
        this.montoOFormula.set(String(val.montoCrudo));
      } else if (val.monto) {
        const clean = String(val.monto).replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim();
        this.montoOFormula.set(clean);
      } else {
        this.montoOFormula.set('');
      }

      if (val.entidad) {
        this.entidad.set(val.entidad);
      }
      this.notas.set(val.notas || '');

      if (val.anio) {
        this.anio.set(val.anio);
      }
      if (val.mes) {
        const nombreMes = typeof val.mes === 'number' ? this.mesesLista[val.mes - 1] : val.mes;
        if (nombreMes) this.mes.set(nombreMes);
      }

      this.esCuotaItem.set(!!val.esCuota);
      this.cuotaActualItem.set(val.cuotaActual || null);
      this.totalCuotasItem.set(val.totalCuotas || null);
      this.grupoCuotaIdItem.set(val.grupoCuotaId || null);
      this.actualizarSerieCompleta.set(false);
      this.borrarSerieCompleta.set(false);
      this.confirmandoEliminar.set(false);
    } else {
      this.esModoEdicion.set(false);
      this.itemId.set(null);
      this.esCuotaItem.set(false);
      this.cuotaActualItem.set(null);
      this.totalCuotasItem.set(null);
      this.grupoCuotaIdItem.set(null);
      this.actualizarSerieCompleta.set(false);
      this.borrarSerieCompleta.set(false);
      this.confirmandoEliminar.set(false);
      this.limpiarFormulario();
    }
  }

  @Output() cerrado = new EventEmitter<void>();
  @Output() itemCreado = new EventEmitter<any>();

  // Modo edición vs creación
  esModoEdicion = signal<boolean>(false);
  itemId = signal<string | null>(null);
  esCuotaItem = signal<boolean>(false);
  cuotaActualItem = signal<number | null>(null);
  totalCuotasItem = signal<number | null>(null);
  grupoCuotaIdItem = signal<string | null>(null);

  actualizarSerieCompleta = signal<boolean>(false);
  confirmandoEliminar = signal<boolean>(false);
  borrarSerieCompleta = signal<boolean>(false);

  // Estados del formulario
  entidad = signal<string>('Visa Galicia');
  concepto = signal<string>('');
  montoOFormula = signal<string>('');
  notas = signal<string>('');
  autoPropagarCuotas = signal<boolean>(true);
  anio = signal<number>(2026);
  mes = signal<string>('Octubre');

  // Estados de control
  isGuardando = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  readonly mesesLista: string[] = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  readonly entidades: EntidadOption[] = [
    { id: 'Visa Galicia', nombre: 'Visa Galicia', logoUrl: 'assets/logos/visa.png', color: '#1A1F71' },
    { id: 'Master Card Galicia', nombre: 'Master Card Galicia', logoUrl: 'assets/logos/mastercard.svg', color: '#EB001B' },
    { id: 'Naranja', nombre: 'Naranja X', logoUrl: 'assets/logos/naranja.png', color: '#FF6600' },
    { id: 'Bancor', nombre: 'Bancor', logoUrl: 'assets/logos/bancor.png', color: '#005CA9' },
    { id: 'Mercado Libre', nombre: 'Mercado Libre / Pago', logoUrl: 'assets/logos/mercadopago.png', color: '#009EE3' },
    { id: 'Otros', nombre: 'Otros (Servicios / Gastos)', color: '#10B981' },
  ];

  // Detección reactiva de compras en cuotas (ej. "MPago 1/3")
  infoCuota = computed(() => {
    const raw = this.concepto().trim();
    if (!raw) return null;

    const match = raw.match(/^(.*?)\s*(\d+)\s*\/\s*(\d+)(.*)$/);
    if (!match) return null;

    const cuotaActual = parseInt(match[2], 10);
    const totalCuotas = parseInt(match[3], 10);
    const esUnPago = raw.toLowerCase().includes('un pago') || totalCuotas <= 1;

    if (esUnPago || isNaN(cuotaActual) || isNaN(totalCuotas) || cuotaActual < 1 || cuotaActual > totalCuotas) {
      return null;
    }

    const conceptoBase = [match[1].trim(), match[4].trim()].filter(Boolean).join(' ').trim() || 'Cuota';

    return {
      esCuota: true,
      esPrimerCuota: cuotaActual === 1,
      cuotaActual,
      totalCuotas,
      conceptoBase,
      cuotasRestantes: totalCuotas - cuotaActual,
    };
  });

  // Evaluación en tiempo real del monto o fórmula
  calculoEnVivo = computed(() => {
    const raw = this.montoOFormula().trim();
    if (!raw) return null;

    return this.mensualService.evaluarFormulaLocal(raw);
  });

  // Mapeo numérico del mes actual (1 a 12)
  mesNumero = computed(() => {
    const idx = this.mesesLista.indexOf(this.mes());
    return idx >= 0 ? idx + 1 : 10;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible && !this.isGuardando()) {
      this.cerrar();
    }
  }

  seleccionarEntidad(nombre: string): void {
    this.entidad.set(nombre);
  }

  setMes(m: string): void {
    this.mes.set(m);
  }

  cerrar(): void {
    if (this.isGuardando()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.confirmandoEliminar.set(false);
    this.cerrado.emit();
  }

  limpiarFormulario(): void {
    this.concepto.set('');
    this.montoOFormula.set('');
    this.notas.set('');
    this.errorMessage.set('');
    this.successMessage.set('');
    this.confirmandoEliminar.set(false);
  }

  iniciarEliminar(): void {
    this.confirmandoEliminar.set(true);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  async confirmarEliminacion(): Promise<void> {
    const id = this.itemId();
    if (this.isGuardando() || !id) return;

    this.isGuardando.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const borrarSerie = this.borrarSerieCompleta();

    this.mensualService.deleteItem(id, borrarSerie).subscribe({
      next: (res) => {
        this.isGuardando.set(false);
        this.successMessage.set(res.message || 'Ítem eliminado exitosamente');
        this.itemCreado.emit(res);

        setTimeout(() => {
          this.cerrar();
        }, 1000);
      },
      error: (err) => {
        this.isGuardando.set(false);
        const msg = err?.error?.message || err?.message || 'Error al eliminar el ítem';
        this.errorMessage.set(msg);
      },
    });
  }

  async guardar(): Promise<void> {
    if (this.isGuardando()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    const conc = this.concepto().trim();
    const montoRaw = this.montoOFormula().trim();

    if (!conc) {
      this.errorMessage.set('Por favor ingresa un concepto o descripción para el ítem.');
      return;
    }

    if (!montoRaw) {
      this.errorMessage.set('Por favor ingresa un monto o fórmula aritmética (ej: 15000 o =50000+25000).');
      return;
    }

    const calculo = this.calculoEnVivo();
    if (calculo?.error) {
      this.errorMessage.set(`Error en la fórmula aritmética: ${calculo.error}`);
      return;
    }

    this.isGuardando.set(true);

    try {
      if (this.esModoEdicion() && this.itemId()) {
        const payload: UpdateMonthlyItemPayload = {
          concepto: conc,
          montoOFormula: montoRaw,
          entidad: this.entidad(),
          notas: this.notas().trim() || undefined,
          actualizarSerieCompleta: this.actualizarSerieCompleta(),
        };

        this.mensualService.updateItem(this.itemId()!, payload).subscribe({
          next: (res) => {
            this.isGuardando.set(false);
            this.successMessage.set(res.message || 'Ítem actualizado exitosamente');
            this.itemCreado.emit(res);

            setTimeout(() => {
              this.cerrar();
            }, 1000);
          },
          error: (err) => {
            this.isGuardando.set(false);
            const msg = err?.error?.message || err?.message || 'Error al actualizar el ítem mensual';
            this.errorMessage.set(msg);
          },
        });
      } else {
        const payload = {
          year: this.anio(),
          mes: this.mesNumero(),
          entidad: this.entidad(),
          concepto: conc,
          montoOFormula: montoRaw,
          notas: this.notas().trim() || undefined,
          autoPropagarCuotas: this.autoPropagarCuotas(),
        };

        this.mensualService.createItem(payload).subscribe({
          next: (res) => {
            this.isGuardando.set(false);
            this.successMessage.set(res.message || 'Ítem guardado exitosamente');
            this.itemCreado.emit(res);

            setTimeout(() => {
              this.limpiarFormulario();
              this.cerrar();
            }, 1000);
          },
          error: (err) => {
            this.isGuardando.set(false);
            const msg = err?.error?.message || err?.message || 'Error al guardar el ítem mensual';
            this.errorMessage.set(msg);
          },
        });
      }
    } catch (e: any) {
      this.isGuardando.set(false);
      this.errorMessage.set(e?.message || 'Ocurrió un error inesperado al procesar la solicitud.');
    }
  }
}
