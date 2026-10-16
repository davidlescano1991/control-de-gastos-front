import { Component, EventEmitter, Input, Output, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoansService, CreateLoanDTO, Loan } from '../../../../services/loans.service';

export interface CuotaEditable {
  numeroCuota: number;
  year: number;
  mes: number;
  nombreMes: string;
  monto: number;
}

@Component({
  selector: 'app-modal-cargar-prestamo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    CurrencyPipe,
    DecimalPipe,
  ],
  templateUrl: './modal-cargar-prestamo.component.html',
  styleUrls: ['./modal-cargar-prestamo.component.scss'],
})
export class ModalCargarPrestamoComponent implements OnInit {
  private loansService = inject(LoansService);

  @Input() anioInicial: number = new Date().getFullYear();
  @Output() cerrar = new EventEmitter<void>();
  @Output() prestamoCreado = new EventEmitter<Loan>();

  // Entidades predefinidas habituales
  readonly entidadesHabituales = [
    'Naranja X',
    'Mercado Pago',
    'Bancor',
    'Banco Galicia',
    'Personal Pay',
    'Ualá',
    'BBVA',
    'Santander',
    'Otra',
  ];

  readonly nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Campos reactivos del formulario
  entidad = signal<string>('Naranja X');
  entidadOtra = signal<string>('');
  nombre = signal<string>('');
  capitalTomado = signal<number | null>(null);
  fechaToma = signal<string>('');
  fechaPrimeraCuota = signal<string>('');
  totalCuotas = signal<number>(6);
  tipoCuotas = signal<'fijas' | 'variables'>('fijas');
  montoCuotaDefault = signal<number | null>(null);
  notas = signal<string>('');

  cuotasDetalle = signal<CuotaEditable[]>([]);

  // Estados de interfaz
  isGuardando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);
  exitoMensaje = signal<string | null>(null);

  // Totales calculados
  totalDevolver = computed(() => {
    return this.cuotasDetalle().reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
  });

  interesesTotales = computed(() => {
    const capital = Number(this.capitalTomado()) || 0;
    const devolver = this.totalDevolver();
    return Math.max(0, devolver - capital);
  });

  recargoPorcentaje = computed(() => {
    const capital = Number(this.capitalTomado()) || 0;
    if (capital <= 0) return 0;
    const intereses = this.interesesTotales();
    return (intereses / capital) * 100;
  });

  ngOnInit(): void {
    const hoy = new Date();
    const hoyStr = this.formatoFechaInput(hoy);
    this.fechaToma.set(hoyStr);

    // Primera cuota por defecto: día 8 del mes siguiente (o mes actual si hoy es antes del 8)
    const primerVencimiento = new Date(hoy.getFullYear(), hoy.getMonth() + (hoy.getDate() > 8 ? 1 : 0), 8);
    this.fechaPrimeraCuota.set(this.formatoFechaInput(primerVencimiento));

    this.recalcularCronogramaCuotas();
  }

  private formatoFechaInput(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  onEntidadChange(nuevaEntidad: string): void {
    this.entidad.set(nuevaEntidad);
    this.actualizarSugerenciaNombre();
  }

  onCapitalChange(monto: number | null): void {
    this.capitalTomado.set(monto);
    this.actualizarSugerenciaNombre();
  }

  onMontoDefaultChange(monto: number | null): void {
    this.montoCuotaDefault.set(monto);
    if (this.tipoCuotas() === 'fijas') {
      this.recalcularCronogramaCuotas();
    }
  }

  onTotalCuotasChange(cant: number): void {
    const cuotas = Math.max(1, Math.min(60, Number(cant) || 1));
    this.totalCuotas.set(cuotas);
    this.recalcularCronogramaCuotas();
  }

  onFechaPrimeraCuotaChange(fecha: string): void {
    this.fechaPrimeraCuota.set(fecha);
    this.recalcularCronogramaCuotas();
  }

  setTipoCuotas(tipo: 'fijas' | 'variables'): void {
    this.tipoCuotas.set(tipo);
    if (tipo === 'fijas' && this.montoCuotaDefault()) {
      // Reaplicar el monto default a todas las cuotas
      this.recalcularCronogramaCuotas();
    }
  }

  actualizarMontoCuotaIndividual(index: number, nuevoMonto: number): void {
    this.cuotasDetalle.update((cuotas) => {
      const actualizadas = [...cuotas];
      if (actualizadas[index]) {
        actualizadas[index] = {
          ...actualizadas[index],
          monto: Math.max(0, Number(nuevoMonto) || 0),
        };
      }
      return actualizadas;
    });
  }

  recalcularCronogramaCuotas(): void {
    const total = this.totalCuotas();
    const fechaBase = this.fechaPrimeraCuota() ? new Date(this.fechaPrimeraCuota() + 'T00:00:00') : new Date();
    const montoFijo = Number(this.montoCuotaDefault()) || 0;

    const cuotasActuales = this.cuotasDetalle();
    const nuevasCuotas: CuotaEditable[] = [];

    for (let i = 0; i < total; i++) {
      const d = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + i, fechaBase.getDate());
      const mesNum = d.getMonth() + 1; // 1-12
      const yearNum = d.getFullYear();
      const nombreMes = `${this.nombresMeses[d.getMonth()]} ${yearNum}`;

      // Si ya existía un monto personalizado en modo variable, conservarlo si coincide cuota
      let monto = montoFijo;
      if (this.tipoCuotas() === 'variables' && cuotasActuales[i]) {
        monto = cuotasActuales[i].monto;
      }

      nuevasCuotas.push({
        numeroCuota: i + 1,
        year: yearNum,
        mes: mesNum,
        nombreMes,
        monto,
      });
    }

    this.cuotasDetalle.set(nuevasCuotas);
  }

  private actualizarSugerenciaNombre(): void {
    const entidadActual = this.entidad() === 'Otra' ? (this.entidadOtra() || 'Préstamo') : this.entidad();
    const capital = this.capitalTomado();
    if (capital && capital > 0) {
      const kMonto = capital >= 1000 ? `${Math.round(capital / 1000)}k` : `${capital}`;
      this.nombre.set(`${entidadActual} ${kMonto}`);
    } else if (!this.nombre()) {
      this.nombre.set(`${entidadActual}`);
    }
  }

  esFormularioValido(): boolean {
    const capital = Number(this.capitalTomado());
    if (!capital || capital <= 0) return false;

    const ent = this.entidad() === 'Otra' ? this.entidadOtra().trim() : this.entidad();
    if (!ent) return false;

    if (!this.nombre().trim()) return false;
    if (!this.fechaToma()) return false;
    if (!this.fechaPrimeraCuota()) return false;
    if (this.totalCuotas() < 1) return false;

    const cuotas = this.cuotasDetalle();
    if (cuotas.length === 0) return false;

    // Verificar que todas las cuotas tengan monto mayor a 0
    return cuotas.every((c) => Number(c.monto) > 0);
  }

  guardarPrestamo(): void {
    if (!this.esFormularioValido() || this.isGuardando()) return;

    this.isGuardando.set(true);
    this.errorMensaje.set(null);
    this.exitoMensaje.set(null);

    const entFinal = this.entidad() === 'Otra' ? this.entidadOtra().trim() : this.entidad();
    const yearToma = Number(this.fechaToma().split('-')[0]) || this.anioInicial;

    const dto: CreateLoanDTO = {
      year: yearToma,
      entidad: entFinal,
      nombre: this.nombre().trim(),
      capitalTomado: Number(this.capitalTomado()),
      fechaToma: this.fechaToma(),
      fechaPrimeraCuota: this.fechaPrimeraCuota(),
      totalCuotas: Number(this.totalCuotas()),
      montoCuotaDefault: this.tipoCuotas() === 'fijas' ? Number(this.montoCuotaDefault()) : undefined,
      cuotas: this.cuotasDetalle().map((c) => ({
        numeroCuota: c.numeroCuota,
        year: c.year,
        mes: c.mes,
        monto: Number(c.monto),
      })),
      notas: this.notas().trim() || undefined,
    };

    this.loansService.createLoan(dto).subscribe({
      next: (res) => {
        this.isGuardando.set(false);
        this.exitoMensaje.set('¡Préstamo registrado exitosamente! Se impactó en la Deuda Real y Estimativos.');
        setTimeout(() => {
          this.prestamoCreado.emit(res.data);
          this.cerrar.emit();
        }, 1200);
      },
      error: (err) => {
        this.isGuardando.set(false);
        const mensaje = err?.error?.message || err?.message || 'Error al guardar el préstamo. Verifique los datos.';
        this.errorMensaje.set(mensaje);
      },
    });
  }

  onCerrar(): void {
    if (!this.isGuardando()) {
      this.cerrar.emit();
    }
  }
}
