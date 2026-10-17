import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EstimatesService, UpsertEstimateConfigDTO } from '../../../services/estimates.service';
import { ThemeService } from '../../../services/theme.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-modal-config-estimativo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './modal-config-estimativo.html',
  styleUrls: ['./modal-config-estimativo.scss'],
  providers: [CurrencyPipe],
})
export class ModalConfigEstimativo implements OnChanges {
  private estimatesService = inject(EstimatesService);
  public themeService = inject(ThemeService);
  private snackbar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() year = new Date().getFullYear();
  @Input() mesNombre = 'Octubre';
  @Input() mesNumero = 10;
  @Output() cerrar = new EventEmitter<void>();
  @Output() configurado = new EventEmitter<void>();

  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);
  eliminando = signal<boolean>(false);
  confirmandoEliminar = signal<boolean>(false);
  existeConfigPrevia = signal<boolean>(false);

  // Form Model
  fechaInicio = ''; // YYYY-MM-DD para input date
  fechaFin = '';    // YYYY-MM-DD para input date
  sueldoNeto = 0;
  gastosPresupuestados = 0;
  remanenteAnterior = 0;
  gastoFijoDiario = 10500;
  ingresoInteresDiario = 600;
  deudaInicial = 0;
  saldoInicialCalculado = 0;
  saldoInicialManual: number | null = null;
  usarCalculoAutomatico = true;
  totalDiasCalculados = 0;
  itemsPresupuestadosCount = 0;

  // Desglose contable
  totalTarjetasOriginal = 0;
  totalTarjetasEfectivo = 0;
  totalCompensaciones = 0;
  totalPrestamos = 0;
  totalServicios = 0;
  desgloseTarjetas: Array<{
    entidad: string;
    totalOriginal: number;
    intencionAPagar: number;
    compensacion: number;
    estado: string;
  }> = [];

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (this.visible && (changes['visible'] || changes['year'] || changes['mesNumero'])) {
      this.confirmandoEliminar.set(false);
      await this.inicializarFormulario();
    }
  }

  async inicializarFormulario(): Promise<void> {
    this.cargando.set(true);
    try {
      // 1. Obtener preview de gastos del mes, desglose y remanentes base del último registro
      const preview = await firstValueFrom(
        this.estimatesService.getPreviewGastos(this.year, this.mesNumero),
      );

      this.gastosPresupuestados = preview.totalGastosMes || 0;
      this.totalTarjetasOriginal = preview.totalTarjetas || 0;
      this.totalTarjetasEfectivo = preview.totalTarjetasEfectivoAPagar || 0;
      this.totalCompensaciones = preview.totalCompensaciones || 0;
      this.totalPrestamos = preview.totalPrestamos || 0;
      this.totalServicios = preview.totalServicios || 0;
      this.desgloseTarjetas = preview.desgloseTarjetas || [];

      this.remanenteAnterior = preview.remanenteSaldoAnterior || 0;
      this.deudaInicial = preview.deudaSugerida !== undefined ? preview.deudaSugerida : (preview.deudaMesAnterior || 0);
      this.itemsPresupuestadosCount = preview.itemsCount || 0;

      // 2. Intentar cargar si ya existe configuración para este año y mes
      try {
        const existente = await firstValueFrom(
          this.estimatesService.getMonthly(this.year, this.mesNumero),
        );
        if (existente && existente.config && (existente.config.id || (existente.filas && existente.filas.length > 0))) {
          this.existeConfigPrevia.set(true);
          const cfg = existente.config;
          if (cfg.fechaInicio) {
            this.fechaInicio = this.convertirADateInput(cfg.fechaInicio);
          }
          if (cfg.fechaFin) {
            this.fechaFin = this.convertirADateInput(cfg.fechaFin);
          }
          this.gastoFijoDiario = cfg.gastoFijoDiario ?? 10500;
          this.ingresoInteresDiario = cfg.ingresoInteresDiario ?? 600;
          this.deudaInicial = cfg.deudaInicial ?? this.deudaInicial;
          this.saldoInicialManual = cfg.saldoInicial;
          this.usarCalculoAutomatico = false;
        } else {
          this.existeConfigPrevia.set(false);
          this.establecerFechasPorDefecto();
        }
      } catch {
        this.existeConfigPrevia.set(false);
        this.establecerFechasPorDefecto();
      }

      this.recalcularTotales();
    } catch (err) {
      console.warn('⚠️ Error al inicializar formulario de estimativo:', err);
      this.existeConfigPrevia.set(false);
      this.establecerFechasPorDefecto();
      this.recalcularTotales();
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  private establecerFechasPorDefecto(): void {
    // Fecha de cobro típica: día 8 del mes
    const mesPad = this.mesNumero.toString().padStart(2, '0');
    const anio = this.year;

    // Próximo mes
    const proxMesNum = this.mesNumero === 12 ? 1 : this.mesNumero + 1;
    const proxAnio = this.mesNumero === 12 ? anio + 1 : anio;
    const proxMesPad = proxMesNum.toString().padStart(2, '0');

    this.fechaInicio = `${anio}-${mesPad}-08`;
    this.fechaFin = `${proxAnio}-${proxMesPad}-07`;
  }

  private convertirADateInput(fechaStr: string): string {
    // Si viene "DD/MM/YYYY"
    if (fechaStr.includes('/')) {
      const parts = fechaStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    // Si viene ISO o YYYY-MM-DD
    return fechaStr.substring(0, 10);
  }

  recalcularTotales(): void {
    // Calcular días
    if (this.fechaInicio && this.fechaFin) {
      const dInicio = new Date(this.fechaInicio + 'T00:00:00');
      const dFin = new Date(this.fechaFin + 'T00:00:00');
      const diffMs = dFin.getTime() - dInicio.getTime();
      this.totalDiasCalculados = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    } else {
      this.totalDiasCalculados = 0;
    }

    // Fórmula Día 1: Sueldo - Gastos Totales del Mes + Remanente - Gasto Fijo Día 1 + Interés Día 1
    const netoDisponible = Number(this.sueldoNeto || 0) - Number(this.gastosPresupuestados || 0) + Number(this.remanenteAnterior || 0);
    this.saldoInicialCalculado = netoDisponible - Number(this.gastoFijoDiario || 0) + Number(this.ingresoInteresDiario || 0);

    if (this.usarCalculoAutomatico) {
      this.saldoInicialManual = this.saldoInicialCalculado;
    }
  }

  onFechaChange(): void {
    this.recalcularTotales();
  }

  onParametrosChange(): void {
    this.recalcularTotales();
  }

  toggleCalculoAutomatico(): void {
    this.usarCalculoAutomatico = !this.usarCalculoAutomatico;
    if (this.usarCalculoAutomatico) {
      this.saldoInicialManual = this.saldoInicialCalculado;
    }
  }

  async guardar(): Promise<void> {
    if (!this.fechaInicio || !this.fechaFin) {
      this.snackbar.open('❌ Debe ingresar fecha de inicio y fin del ciclo', 'Cerrar', { duration: 3000 });
      return;
    }

    const saldoFinal = this.usarCalculoAutomatico ? this.saldoInicialCalculado : (this.saldoInicialManual ?? this.saldoInicialCalculado);

    const payload: UpsertEstimateConfigDTO = {
      year: Number(this.year),
      mes: Number(this.mesNumero),
      nombreMes: this.mesNombre,
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin,
      saldoInicial: Number(saldoFinal),
      gastoFijoDiario: Number(this.gastoFijoDiario),
      ingresoInteresDiario: Number(this.ingresoInteresDiario || 0),
      deudaInicial: Number(this.deudaInicial || 0),
      presupuestoTotal: Number(this.sueldoNeto || saldoFinal),
    };

    this.guardando.set(true);
    try {
      await firstValueFrom(this.estimatesService.upsertConfig(payload));
      this.snackbar.open('✅ Ciclo de estimativo guardado y calculado exitosamente', 'Cerrar', { duration: 4000 });
      this.configurado.emit();
      this.cerrarModal();
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al guardar configuración del estimativo';
      this.snackbar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
      console.error('Error guardando estimativo:', err);
    } finally {
      this.guardando.set(false);
      this.cdr.detectChanges();
    }
  }

  solicitarEliminar(): void {
    this.confirmandoEliminar.set(true);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  async confirmarEliminacion(): Promise<void> {
    this.eliminando.set(true);
    try {
      await firstValueFrom(this.estimatesService.deleteConfig(Number(this.year), Number(this.mesNumero)));
      this.snackbar.open(`🗑️ Estimativo de ${this.mesNombre} ${this.year} eliminado correctamente`, 'Cerrar', { duration: 4000 });
      this.configurado.emit();
      this.cerrarModal();
    } catch (err: any) {
      const msg = err?.error?.message || 'Error al eliminar configuración del estimativo';
      this.snackbar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
      console.error('Error eliminando estimativo:', err);
    } finally {
      this.eliminando.set(false);
      this.confirmandoEliminar.set(false);
      this.cdr.detectChanges();
    }
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }
}
