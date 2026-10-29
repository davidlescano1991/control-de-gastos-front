import { Injectable, inject, signal, computed } from '@angular/core';
import { EstimatesService, RecordatorioItem } from './estimates.service';
import { SseService } from './sse.service';

@Injectable({
  providedIn: 'root',
})
export class ReminderService {
  private estimatesService = inject(EstimatesService);
  private sseService = inject(SseService);

  private todosRecordatorios = signal<RecordatorioItem[]>([]);
  private descartados = signal<Set<string>>(new Set<string>());
  private indiceActual = signal<number>(0);

  /**
   * Recordatorios activos no descartados por el usuario en esta sesión
   * Ordenados estrictamente: hoy o los más próximos primero, y los posteriores abajo.
   */
  public recordatoriosVisibles = computed<RecordatorioItem[]>(() => {
    const ignorados = this.descartados();
    return this.todosRecordatorios()
      .filter((r) => !ignorados.has(r.id))
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes);
  });

  /**
   * Recordatorio actualmente visible en el banner
   */
  public recordatorioActivo = computed<RecordatorioItem | null>(() => {
    const lista = this.recordatoriosVisibles();
    if (!lista.length) return null;
    const idx = Math.min(this.indiceActual(), lista.length - 1);
    return lista[idx >= 0 ? idx : 0];
  });

  public totalActivos = computed<number>(() => this.recordatoriosVisibles().length);
  public indiceActivoNumero = computed<number>(() => {
    const lista = this.recordatoriosVisibles();
    if (!lista.length) return 0;
    const idx = Math.min(this.indiceActual(), lista.length - 1);
    return idx + 1;
  });

  constructor() {
    // Limpieza defensiva de cualquier clave residual previa en sessionStorage
    try {
      sessionStorage.removeItem('cdg_recordatorios_descartados');
    } catch {}

    this.cargarRecordatorios();

    // Escuchar eventos de actualización SSE para recargar si cambian datos
    this.sseService.getEvents$().subscribe((e) => {
      if (e?.event === 'DATA_UPDATED') {
        this.cargarRecordatorios();
      }
    });
  }

  public cargarRecordatorios(): void {
    this.estimatesService.getRecordatorios().subscribe({
      next: (items) => {
        this.todosRecordatorios.set(items || []);
        if (this.indiceActual() >= (items?.length || 0)) {
          this.indiceActual.set(0);
        }
      },
      error: (err) => {
        console.warn('Error al cargar recordatorios:', err);
      },
    });
  }

  public siguiente(): void {
    const total = this.recordatoriosVisibles().length;
    if (total <= 1) return;
    this.indiceActual.update((curr) => (curr + 1) % total);
  }

  public anterior(): void {
    const total = this.recordatoriosVisibles().length;
    if (total <= 1) return;
    this.indiceActual.update((curr) => (curr - 1 + total) % total);
  }

  public descartar(id: string): void {
    const nuevoSet = new Set(this.descartados());
    nuevoSet.add(id);
    this.descartados.set(nuevoSet);

    const total = this.recordatoriosVisibles().length;
    if (this.indiceActual() >= total && total > 0) {
      this.indiceActual.set(0);
    }
  }

  /**
   * Genera un gradiente suave oficial a partir del color de la etiqueta
   */
  public obtenerGradiente(hexColor?: string): string {
    const colorBase = hexColor?.trim() || '#4b5896';
    const colorOscuro = this.oscurecerHex(colorBase, 0.28);
    return `linear-gradient(90deg, ${colorBase} 0%, ${colorOscuro} 100%)`;
  }

  public obtenerIcono(item: RecordatorioItem): string {
    if (item.icono) {
      return item.icono;
    }
    const titulo = (item.titulo || '').toLowerCase();
    if (titulo.includes('cumple') || titulo.includes('aniversario') || titulo.includes('festejo')) {
      return 'celebration';
    }
    if (item.tipo === 'VENCIMIENTO') {
      return 'credit_card';
    }
    return 'event_note';
  }

  private oscurecerHex(hex: string, porcentaje: number): string {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    if (clean.length !== 6) return '#333f75';

    const num = parseInt(clean, 16);
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;

    r = Math.max(0, Math.min(255, Math.floor(r * (1 - porcentaje))));
    g = Math.max(0, Math.min(255, Math.floor(g * (1 - porcentaje))));
    b = Math.max(0, Math.min(255, Math.floor(b * (1 - porcentaje))));

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
