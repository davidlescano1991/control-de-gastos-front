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
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ProyeccionEntidadService,
  ProyeccionEntidadData,
  ProyeccionFilaIndividual,
} from '../../../services/proyeccion-entidad.service';
import { ProyeccionOverlayService } from '../../../services/proyeccion-overlay.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-modal-proyeccion-entidad',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './modal-proyeccion-entidad.html',
  styleUrls: ['./modal-proyeccion-entidad.scss'],
  providers: [CurrencyPipe],
})
export class ModalProyeccionEntidad implements OnChanges {
  private proyeccionService = inject(ProyeccionEntidadService);
  public overlayService = inject(ProyeccionOverlayService);
  public themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  @Input() anio: number = 2026;
  @Input() mes: string = 'Octubre';
  @Input() entidadKey: string = '';
  @Input() nombreEntidad: string = '';
  @Input() logoUrl: string = '';

  // Modo: 'fila' para cuota individual, 'completo' para tabla estilo Excel con todos los registros y totales
  @Input() modo: 'fila' | 'completo' = 'completo';
  @Input() filaData?: { descripcion: string; monto: unknown };

  // Posicionamiento del tooltip flotante
  @Input() visible: boolean = false;
  @Input() esModalCompleto: boolean = false;
  @Input() posX: number = 0;
  @Input() posY: number = 0;

  @Output() cerrar = new EventEmitter<void>();
  @Output() abrirModal = new EventEmitter<void>();

  cargando = signal<boolean>(false);
  dataCompleta = signal<ProyeccionEntidadData | null>(null);
  dataFila = signal<ProyeccionFilaIndividual | null>(null);

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (this.visible && (changes['visible'] || changes['entidadKey'] || changes['filaData'] || changes['modo'])) {
      await this.cargarDatos();
    }
  }

  async cargarDatos(): Promise<void> {
    if (!this.entidadKey) return;
    this.cargando.set(true);

    try {
      if (this.modo === 'fila' && this.filaData) {
        const res = await this.proyeccionService.obtenerProyeccionFila(
          this.anio,
          this.mes,
          this.entidadKey,
          this.filaData,
          this.nombreEntidad,
        );
        this.dataFila.set(res);
        this.dataCompleta.set(null);
      } else {
        const res = await this.proyeccionService.obtenerProyeccionCompleta(
          this.anio,
          this.mes,
          this.entidadKey,
          this.nombreEntidad,
        );
        this.dataCompleta.set(res);
        this.dataFila.set(null);
      }
    } catch (err) {
      console.error('Error al cargar proyección:', err);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  solicitarAbrirModal(): void {
    this.abrirModal.emit();
  }

  cerrarVista(): void {
    this.cerrar.emit();
  }
}
