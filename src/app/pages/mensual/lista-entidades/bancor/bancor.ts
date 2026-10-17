import { AuthService } from '../../../../services/auth.service';
import { Component, effect, Inject, inject, Input, PLATFORM_ID, signal, SimpleChanges , EventEmitter, Output } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { CurrencyPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { ProyeccionOverlayService } from '../../../../services/proyeccion-overlay.service';
import { computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EntidadAPagarInfo } from '../../modal-pagar-entidad/modal-pagar-entidad.component';
import { EntityPaymentService, EntityPayment } from '../../../../services/entity-payment.service';

@Component({
  selector: 'app-bancor',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule, MatIconModule],
  templateUrl: './bancor.html',
  styleUrl: './bancor.scss',
  providers: [CurrencyPipe]
})
export class Bancor {
  private paymentService = inject(EntityPaymentService);
  modalPagoAbierto = signal(false);

  private MESES_MAP: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
  };

  getMesNumero(): number {
    const normal = (this.mes || '').toLowerCase().trim();
    return this.MESES_MAP[normal] || (new Date().getMonth() + 1);
  }

  pagoInfo = computed(() => {
    const mesNum = this.getMesNumero();
    const key = `${this.anio}::${mesNum}`;
    const pagos = this.paymentService.pagosMesSignal().get(key) || [];
    return pagos.find(p => p.entidad.toLowerCase().includes('bancor') && (!p.itemId || p.itemId === '')) || null;
  });

  mostrarIntencionPago = computed(() => {
    const p = this.pagoInfo();
    if (!p) return false;
    const total = this.totalMes();
    return total > 0 && p.montoPagado < total;
  });

  estadoPago = computed<'COMPLETO' | 'PARCIAL' | 'NO_PAGADO'>(() => {
    const p = this.pagoInfo();
    if (p) {
      if (p.estado === 'COMPLETO') return 'COMPLETO';
      if (p.estado === 'PARCIAL') return 'PARCIAL';
      return 'NO_PAGADO';
    }
    const esHistorico = this.anio < 2026 || (this.anio === 2026 && this.getMesNumero() < 10);
    if (esHistorico) return 'COMPLETO';
    if (this.totalMes() === 0) return 'COMPLETO';
    return 'NO_PAGADO';
  });

  iconoEstadoPago = computed(() => {
    const estado = this.estadoPago();
    if (estado === 'COMPLETO') return 'check_circle';
    if (estado === 'PARCIAL') return 'pending';
    return 'cancel';
  });

  tooltipEstadoPago = computed(() => {
    const estado = this.estadoPago();
    const p = this.pagoInfo();
    if (estado === 'COMPLETO') {
      if (p?.fechaPago) {
        return `Pagado en su totalidad el ${new Date(p.fechaPago).toLocaleDateString('es-AR')}`;
      }
      return 'Pagado en su totalidad';
    }
    if (estado === 'PARCIAL' && p) {
      return `Pago parcial: Abonado $ ${p.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Resta $ ${p.montoRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`;
    }
    return 'No pagado (Pendiente de pago)';
  });

  entidadAPagarInfo = computed<EntidadAPagarInfo>(() => {
    return {
      year: this.anio,
      mes: this.getMesNumero(),
      mesNombre: this.mes,
      entidad: this.entidad || 'Bancor',
      totalOriginal: this.totalMes(),
      pagoExistente: this.pagoInfo() || undefined,
    };
  });

  abrirModalPago(): void {
    this.paymentService.abrirModalPago(this.entidadAPagarInfo());
  }

  onPagoConfirmado(pago: EntityPayment): void {
    this.modalPagoAbierto.set(false);
  }

  public authService = inject(AuthService);
  @Output() eliminarEntidad = new EventEmitter<string>();
  @Output() editarFila = new EventEmitter<any>();

  onEditarFila(fila: any, event: MouseEvent): void {
    event.stopPropagation();
    this.editarFila.emit(fila);
  }

  private overlayService = inject(ProyeccionOverlayService);
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  /* datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);
  headers = signal<string[]>([]);
  mesSeleccionado = ''; // si querés mostrar el mes
  isCargando = signal(false);
  
  constructor(private storeGoogle: MovimientosStoreGoogle) {
    effect(() => {
      this.isCargando.set(true); // ⏳ empieza la carga
      console.log('Esta cargando Bancor ⏳');
      const datos = this.storeGoogle.entidadBancor(); // ✅ esto es reactivo
      const headers = this.storeGoogle.headerBancor(); // ✅ también reactivo

      this.datosMes.set(datos);
      this.headers.set(headers);

      const total = datos.reduce((acc, fila) => {
        const valores = Object.values(fila);
        const montoCrudo = valores[1];
        const monto = typeof montoCrudo === 'string'
          ? parseFloat(montoCrudo.replace(/\./g, '').replace(',', '.').replace('$', ''))
          : typeof montoCrudo === 'number'
            ? montoCrudo
            : 0;
        return acc + monto;
      }, 0);

      this.totalMes.set(total);
      this.isCargando.set(false); // ✅ termina la carga
      console.log('Fin de la carga Bancor⏳');
    });
  }

  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, c =>
        ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c)
      );
  }
  esNuevo(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }
  esUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    if (match) {
      const cuota = match[0]; // por ejemplo "6/6", mas adelanto seriviria para tomar el valor
    }
    return !!match;
  } */
  @Input() anio!: number;
  @Input() mes!: string;
  @Input() entidad: string = '';
  @Input() isCargando: boolean = false;

  @Input() set datos(value: any[]) {
    const claveActual = JSON.stringify(value);
    if (claveActual === this.ultimaClave) return;

    this.ultimaClave = claveActual;
    this.datosMes.set(value ?? []);
    this.totalMes.set(this.calcularTotal(value ?? []));
  }
  private ultimaClave = '';

  datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);

  onHoverFila(event: MouseEvent, fila: any): void {
    this.overlayService.mostrarTooltipFila(
      event,
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      fila,
      'assets/logos/bancor.png',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      'assets/logos/bancor.png',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'bancor',
      this.entidad || 'Bancor',
      this.anio,
      this.mes,
      'assets/logos/bancor.png',
    );
  }

  private calcularTotal(registros: any[]): number {
    console.log(`calcularTotal() de BancorComponet --> registros:  `, JSON.stringify(registros));
    return registros.reduce((acc, fila) => {
      const montoCrudo = fila['monto'];
      const monto = typeof montoCrudo === 'string'
        ? parseFloat(montoCrudo.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'))
        : typeof montoCrudo === 'number' ? montoCrudo : 0;
      return acc + (isNaN(monto) ? 0 : monto);
    }, 0);
  }

  esNuevo(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }

  esUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    return !!match;
  }

  solicitarBajaEntidad(event: MouseEvent): void {
    event.stopPropagation();
    this.eliminarEntidad.emit(this.entidad);
  }
}
