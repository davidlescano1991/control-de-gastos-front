import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SseEventMessage {
  event: string;
  data: any;
}

/**
 * Servicio en Angular para escuchar eventos en tiempo real
 * emitidos por la API 2.0 mediante Server-Sent Events (SSE).
 */
@Injectable({
  providedIn: 'root',
})
export class SseService {
  private eventSource: EventSource | null = null;
  private zone = inject(NgZone);
  private eventSubject = new Subject<SseEventMessage>();

  // Señal reactiva de estado (true = conectado a la API, false = esperando o desconectado)
  public isConnected = signal<boolean>(false);
  public lastEvent = signal<SseEventMessage | null>(null);

  constructor() {
    this.conectar();
  }

  /**
   * Abre la conexión persistente con el canal SSE de la API
   */
  public conectar(url: string = 'http://localhost:3000/api/events/sub'): void {
    // Si estamos en entorno servidor (SSR) o el navegador no soporta EventSource, salimos limpiamente
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.zone.run(() => {
          this.isConnected.set(true);
          console.log('📡 [SSE Front] Conexión establecida con la API en http://localhost:3000');
        });
      };

      // Escucha evento inicial de bienvenida
      this.eventSource.addEventListener('connected', (event: MessageEvent) => {
        this.zone.run(() => {
          this.isConnected.set(true);
          console.log('📡 [SSE Front] Mensaje de bienvenida del backend:', event.data);
        });
      });

      // Escucha notificaciones de actualización de datos (DATA_UPDATED)
      this.eventSource.addEventListener('DATA_UPDATED', (event: MessageEvent) => {
        this.zone.run(() => {
          try {
            const data = JSON.parse(event.data);
            const msg: SseEventMessage = { event: 'DATA_UPDATED', data };
            this.lastEvent.set(msg);
            this.eventSubject.next(msg);
            console.log('⚡ [SSE Front] ¡Evento en tiempo real recibido desde la API!:', data);
          } catch (e) {
            console.error('Error parseando evento SSE:', e);
          }
        });
      });

      this.eventSource.onerror = () => {
        this.zone.run(() => {
          this.isConnected.set(false);
          // EventSource se reconecta automáticamente en segundo plano cuando la API vuelva a encender
        });
      };
    } catch (err) {
      console.error('Error al inicializar EventSource:', err);
    }
  }

  /**
   * Observable para que cualquier componente o store se suscriba a los eventos
   */
  public getEvents$(): Observable<SseEventMessage> {
    return this.eventSubject.asObservable();
  }

  /**
   * Cierra limpiamente la conexión
   */
  public desconectar(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected.set(false);
    }
  }
}
