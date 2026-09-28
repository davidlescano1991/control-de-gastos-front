import { Injectable, signal, computed, inject } from '@angular/core';
import { MovimientosService } from '../services/movimientos.service';
import { Movimiento } from '../models/movimiento';
import { SseService } from '../services/sse.service';

@Injectable({ providedIn: 'root' })
export class MovimientosStore {
  private servicio = inject(MovimientosService);
  private sseService = inject(SseService);

  private _movimientos = signal<Movimiento[]>([]);

  // Computed para acceder desde componentes
  readonly lista = computed(() => this.movimientos());

  constructor() {
    this.cargar();

    // 📡 Suscripción al canal SSE para actualizaciones en tiempo real
    this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        console.log('⚡ [MovimientosStore] Notificación DATA_UPDATED recibida. Recargando movimientos...');
        this.cargar();
      }
    });
  }

  cargar() {
    this.servicio.listarMovimientos().subscribe({
      next: (data) => {
        this._movimientos.set(data);
      },
      error: (err) => {
        console.warn('⚠️ [MovimientosStore] No se pudieron listar movimientos desde la API:', err);
      },
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