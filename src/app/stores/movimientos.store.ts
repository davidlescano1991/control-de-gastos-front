import { Injectable, signal, computed } from '@angular/core';
import { MovimientosService} from '../services/movimientos.service';
import { Movimiento} from '../models/movimiento'


@Injectable({ providedIn: 'root' })
export class MovimientosStore {
  private _movimientos = signal<Movimiento[]>([]);

  // Computed para acceder desde componentes
  readonly lista = computed(() => this.movimientos());

  constructor(private servicio: MovimientosService) {}

  cargar() {
    this.servicio.listarMovimientos().subscribe(data => {
      this._movimientos.set(data);
    });
  }
 
  agregar(movimiento: Movimiento) {
    this._movimientos.update(lista => [...lista, movimiento]);
  }

  limpiar() {
    this._movimientos.set([]);
  }

  get movimientos() {
    return this._movimientos.asReadonly();
  }
}