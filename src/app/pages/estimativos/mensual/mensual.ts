import { Component, EventEmitter, inject, Inject, Input, Output, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { WakeLockService } from '../../../services/wake-lock.service';
import { NgIf, NgFor, CurrencyPipe, NgClass, NgStyle, isPlatformBrowser } from '@angular/common';
import { MatCardContent, MatCardModule } from '@angular/material/card';
import { GraficoEstimativo } from '../grafico-estimativo/grafico-estimativo'
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { esDiaNoLaborable, esFinDeSemana, esFeriadoNacional, obtenerInfoDia } from '../../../utils/feriados.utils';
import { OrigenDatosComponent } from '../../../common/origen-datos/origen-datos.component';
import { AuthService } from '../../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { EstimatesService } from '../../../services/estimates.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-estimativo-mensual',
  standalone: true,
  imports: [
    NgIf, NgFor, NgClass, NgStyle,
    FormsModule,
    MatCardContent, MatCardModule,
    CurrencyPipe,
    MatFormFieldModule,
    MatInputModule, MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    OrigenDatosComponent,
  ],
  templateUrl: './mensual.html',
  styleUrl: './mensual.scss'
})
export class EstimativoMensual {
  public authService = inject(AuthService);
  private estimatesService = inject(EstimatesService);

  @Input() isColIzquierdaContraida = false;
  @Output() toggleHorizontalCollapse = new EventEmitter<void>();
  @Output() estimativoActualizado = new EventEmitter<void>();
  @Output() abrirConfig = new EventEmitter<void>();
  @Output() editarDia = new EventEmitter<any>();

  onEditarDia(fila: any): void {
    this.editarDia.emit(fila);
  }

  abrirModalConfig(): void {
    this.abrirConfig.emit();
  }

  onToggleHorizontalCollapse() {
    this.toggleHorizontalCollapse.emit();
  }

  isCollapsed = signal(false);

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  //meses = signal<string[]>([]);
  
  private _estimativoFilas = signal<EstimativoRow[]>([]);
  @Input() mesSeleccionado = '';
  //isCargando = signal(false);
  @Input() isCargando = true;
  //estimativoFilas = signal<EstimativoRow[]>([]);
  isBrowser: any;
  @Input() anioSeleccionado = new Date().getFullYear();
  @Input() set estimativoFilas(values: EstimativoRow[]) {
    this._estimativoFilas.set(values ?? []);
  }

  constructor(
    private storeGoogle: MovimientosStoreGoogle,
    @Inject(PLATFORM_ID) private platformId: Object,
    private snackbar: MatSnackBar
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /* async ngOnInit(): Promise<void> {
    const fecha = new Date();
    const nombreMes = fecha.toLocaleString('es-AR', { month: 'long' });
    const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    const mesValido = this.meses.includes(mesCapitalizado) ? mesCapitalizado : 'Enero';
    //await this.seleccionarMes(mesValido);
  } */

  async ngOnChanges(changes: SimpleChanges) {
    if ((changes['mesSeleccionado'] || changes['anioSeleccionado'] || changes['estimativoFilas'] || !changes['isCargando']) 
      && this.isBrowser) {
      console.log('Grafico de estimativo inicio método ngOnChanges()');
    }
  }



 /*  async seleccionarMes(mes: string) {
    const hoja = 'Estimativo ' + mes;
    const anio = this.anioSeleccionado;
   
    const filas = this.estimativoFilas;
    console.error(`✅ filas en mensual: ${JSON.stringify(filas)}`);
   
  } */

  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c));
  }

  calcularDiferencia(estimado: number, real: number | null): number {
    if (real === null) return 0;
    return real - estimado;
  }

  esNoLaborable(fecha: string): boolean {
    return esDiaNoLaborable(fecha);
  }

  esFinDeSemana(fecha: string): boolean {
    return esFinDeSemana(fecha);
  }

  esFeriado(fecha: string): boolean {
    return esFeriadoNacional(fecha);
  }

  obtenerClaseFila(filaOrFecha: any): string {
    const fecha = typeof filaOrFecha === 'string' ? filaOrFecha : filaOrFecha?.fecha || '';
    const clases: string[] = [];
    const info = obtenerInfoDia(fecha);
    if (info.esFeriado) clases.push('fila-no-laborable fila-feriado');
    else if (info.esFinDeSemana) clases.push('fila-no-laborable fila-fin-de-semana');

    if (typeof filaOrFecha === 'object' && (filaOrFecha?.color || filaOrFecha?.evento)) {
      clases.push('fila-personalizada');
    }
    return clases.join(' ');
  }

  obtenerEstiloFila(fila: any): { [key: string]: any } {
    if (fila && (fila.color || fila.evento)) {
      return {
        '--fila-custom-color': fila.color || '#4b5896',
      };
    }
    return {};
  }

  obtenerTooltipFecha(filaOrFecha: any): string {
    const fila = typeof filaOrFecha === 'object' ? filaOrFecha : null;
    const fecha = typeof filaOrFecha === 'string' ? filaOrFecha : filaOrFecha?.fecha || '';
    const partes: string[] = [];

    if (fila?.evento) {
      partes.push(`📌 Evento: ${fila.evento}`);
    }

    const info = obtenerInfoDia(fecha);
    if (info.esFeriado && info.motivo) {
      partes.push(`${info.nombreDia} - Feriado: ${info.motivo}`);
    } else if (info.esFinDeSemana) {
      partes.push(info.nombreDia);
    }
    return partes.join(' | ');
  }

  /* async guardarFormula(fecha: string, formula: string) {
    console.log('📝 Guardando fórmula:', formula, 'para fecha:', fecha);
    try {
      const hoja = 'Estimativo ' + this.mesSeleccionado;
      const res = await this.storeGoogle.actualizarSaldoReal(hoja, fecha, formula);
      this.snackbar.open(res.mensaje, 'Cerrar', { duration: 3000 });
      await this.seleccionarMes(this.mesSeleccionado); // recarga datos
    } catch (err) {
      this.snackbar.open('❌ Error al actualizar celda', 'Cerrar', { duration: 3000 });
      console.error('Error:', err);
    }
  } */
  get estimativoFilas(): EstimativoRow[] { return this._estimativoFilas(); }
}
