import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ReembolsablesService,
  ReembolsablesMesData,
  GastoReembolsableItem,
} from '../../../services/reembolsables.service';

@Component({
  selector: 'app-gastos-reembolsables',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './gastos-reembolsables.component.html',
  styleUrls: ['./gastos-reembolsables.component.scss'],
})
export class GastosReembolsablesComponent implements OnChanges {
  public reembolsablesService = inject(ReembolsablesService);

  @Input({ required: true }) mesSeleccionado!: string;
  @Input({ required: true }) anioSeleccionado!: number;
  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  @Output() reintegroRegistrado = new EventEmitter<void>();

  isCollapsed = signal(false);
  isCargando = signal(false);
  data = signal<ReembolsablesMesData | null>(null);

  private readonly mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mesSeleccionado'] || changes['anioSeleccionado']) {
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    if (!this.mesSeleccionado || !this.anioSeleccionado) return;

    this.isCargando.set(true);
    this.reembolsablesService
      .getReembolsablesMes(this.anioSeleccionado, this.mesSeleccionado)
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.isCargando.set(false);
        },
        error: (err) => {
          console.error('[GastosReembolsables] Error al cargar reembolsables:', err);
          this.isCargando.set(false);
        },
      });
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }

  obtenerNumeroMes(nombre: string): number {
    const idx = this.mesesNombres.findIndex(
      (m) => m.toLowerCase() === (nombre || '').toLowerCase()
    );
    return idx >= 0 ? idx + 1 : new Date().getMonth() + 1;
  }

  abrirModalReintegro(): void {
    const d = this.data();
    if (!d) return;
    this.reembolsablesService.abrirModalReintegro(d);
  }

  abrirModalNuevoConcepto(): void {
    const d = this.data();
    const mesNum = this.obtenerNumeroMes(this.mesSeleccionado);
    const itemsActuales = d ? [...d.items, ...(d.itemAporte ? [d.itemAporte] : [])] : [];
    this.reembolsablesService.abrirModalItem({
      modo: 'CREAR',
      year: this.anioSeleccionado,
      mesNumero: mesNum,
      mesNombre: this.mesSeleccionado,
      tipoPorDefecto: 'SERVICIO',
      todosLosItemsActuales: itemsActuales,
    });
  }

  abrirModalEditarConcepto(item: GastoReembolsableItem): void {
    const d = this.data();
    const mesNum = this.obtenerNumeroMes(this.mesSeleccionado);
    const itemsActuales = d ? [...d.items, ...(d.itemAporte ? [d.itemAporte] : [])] : [];
    this.reembolsablesService.abrirModalItem({
      modo: 'EDITAR',
      year: this.anioSeleccionado,
      mesNumero: mesNum,
      mesNombre: this.mesSeleccionado,
      item,
      todosLosItemsActuales: itemsActuales,
    });
  }

  abrirModalEditarAporte(): void {
    const d = this.data();
    if (!d) return;
    const mesNum = this.obtenerNumeroMes(this.mesSeleccionado);
    const itemAporte: GastoReembolsableItem = d.itemAporte || {
      concepto: d.nombreAporteTercero || 'Mamá',
      monto: d.montoAporteTercero,
      tipo: 'APORTE',
    };
    const itemsActuales = [...d.items, itemAporte];
    this.reembolsablesService.abrirModalItem({
      modo: 'EDITAR',
      year: this.anioSeleccionado,
      mesNumero: mesNum,
      mesNombre: this.mesSeleccionado,
      item: itemAporte,
      todosLosItemsActuales: itemsActuales,
    });
  }

  async eliminarConcepto(item: GastoReembolsableItem): Promise<void> {
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar el concepto "${item.concepto}" de este mes?`
    );
    if (!confirmacion) return;

    const d = this.data();
    const mesNum = this.obtenerNumeroMes(this.mesSeleccionado);
    const itemsActuales = d ? [...d.items, ...(d.itemAporte ? [d.itemAporte] : [])] : [];

    this.isCargando.set(true);
    try {
      await this.reembolsablesService.eliminarItem(
        item,
        this.anioSeleccionado,
        mesNum,
        itemsActuales
      );
      this.cargarDatos();
    } catch (err) {
      console.error('Error al eliminar ítem reembolsable:', err);
      alert('No se pudo eliminar el concepto.');
      this.isCargando.set(false);
    }
  }

  tieneConceptosConCosto(): boolean {
    const d = this.data();
    if (!d || !d.items) return false;
    return d.items.some((it) => it.monto > 0) || d.montoAporteTercero > 0;
  }
}
