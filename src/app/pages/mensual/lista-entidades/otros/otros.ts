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
  selector: 'app-otros',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule, MatIconModule],
  templateUrl: './otros.html',
  styleUrl: './otros.scss',
  providers: [CurrencyPipe]
})
export class Otros {
  private paymentService = inject(EntityPaymentService);
  modalPagoAbierto = signal(false);
  filaSeleccionadaParaPago = signal<any>(null);

  private MESES_MAP: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
  };

  getMesNumero(): number {
    const normal = (this.mes || '').toLowerCase().trim();
    return this.MESES_MAP[normal] || (new Date().getMonth() + 1);
  }

  getPagoFila(fila: any): EntityPayment | null {
    const mesNum = this.getMesNumero();
    const key = `${this.anio}::${mesNum}`;
    const pagos = this.paymentService.pagosMesSignal().get(key) || [];
    const idBuscar = String(fila.id || fila.descripcion || '');
    return pagos.find(p => p.entidad.toLowerCase() === 'otros' && p.itemId === idBuscar) || null;
  }

  getEstadoPagoFila(fila: any): 'COMPLETO' | 'PARCIAL' | 'NO_PAGADO' {
    const esHistorico = this.anio < 2026 || (this.anio === 2026 && this.getMesNumero() < 10);
    const p = this.getPagoFila(fila);
    if (p) return p.estado as any;
    if (esHistorico) return 'COMPLETO';
    const monto = typeof fila?.montoCrudo === 'number' ? fila.montoCrudo : this.parseMoneda(fila?.monto);
    if (monto === 0) return 'COMPLETO';
    return 'NO_PAGADO';
  }

  getIconoPagoFila(fila: any): string {
    const estado = this.getEstadoPagoFila(fila);
    if (estado === 'COMPLETO') return 'check_circle';
    if (estado === 'PARCIAL') return 'pending';
    return 'cancel';
  }

  parseMoneda(valor: any): number {
    if (typeof valor === 'number') return valor;
    if (typeof valor !== 'string') return 0;
    const limpio = valor.replace(/\$/g, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpio);
    return isNaN(num) ? 0 : num;
  }

  getTooltipPagoFila(fila: any): string {
    const estado = this.getEstadoPagoFila(fila);
    const p = this.getPagoFila(fila);
    const monto = typeof fila?.montoCrudo === 'number' ? fila.montoCrudo : this.parseMoneda(fila?.monto);
    if (monto === 0) {
      return 'Sin saldo a pagar ($ 0,00) - Pagado';
    }
    if (estado === 'COMPLETO') {
      return `Pagado completamente${p?.fechaPago ? ' el ' + new Date(p.fechaPago).toLocaleDateString('es-AR') : ''}`;
    }
    if (estado === 'PARCIAL' && p) {
      return `Pago parcial: Abonado $ ${p.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (Resta $ ${p.montoRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`;
    }
    return 'No pagado (Pendiente de pago)';
  }

  entidadAPagarInfo = computed<EntidadAPagarInfo>(() => {
    const fila = this.filaSeleccionadaParaPago();
    const monto = fila ? (typeof fila.montoCrudo === 'number' ? fila.montoCrudo : this.parseMoneda(fila.monto)) : 0;
    const pagoExistente = fila ? this.getPagoFila(fila) : null;

    return {
      year: this.anio,
      mes: this.getMesNumero(),
      mesNombre: this.mes,
      entidad: 'Otros',
      itemId: fila ? String(fila.id || fila.descripcion || '') : '',
      concepto: fila ? fila.descripcion : '',
      totalOriginal: monto,
      pagoExistente: pagoExistente || undefined,
    };
  });

  abrirModalPagoFila(fila: any, event: MouseEvent): void {
    event.stopPropagation();
    this.filaSeleccionadaParaPago.set(fila);
    this.paymentService.abrirModalPago(this.entidadAPagarInfo());
  }

  onPagoConfirmado(pago: EntityPayment): void {
    this.modalPagoAbierto.set(false);
    this.filaSeleccionadaParaPago.set(null);
  }

  public authService = inject(AuthService);
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
       this.isCargando.set(true);
      console.log('Esta cargando Otros⏳');

      const datos = this.storeGoogle.entidadOtros(); // ya filtrado por mes
       console.log('Datos en Otros ',JSON.stringify(datos));
      this.datosMes.set(datos);

      const total = datos.reduce((acc, fila) => {
        const valores = Object.values(fila);
        const montoCrudo = valores[1];
        //console.log("mONTO EN OTROS ",JSON.stringify(valores[0]));
        const monto = typeof montoCrudo === 'string'
          ? parseFloat(montoCrudo.replace(/\./g, '').replace(',', '.').replace('$', ''))
          : typeof montoCrudo === 'number'
            ? montoCrudo
            : 0;
        
        return acc + monto;
      }, 0);
      console.log('Total en Otros: ',JSON.stringify(total));
      this.totalMes.set(total);
      this.isCargando.set(false);
      console.log('Fin de la carga Otros⏳');
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
  }
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
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
      'otros',
      this.entidad || 'Otros',
      this.anio,
      this.mes,
      fila,
      '',
    );
  }

  onLeaveFila(): void {
    this.overlayService.ocultarTooltip();
  }

  onHoverTotal(event: MouseEvent): void {
    this.overlayService.mostrarTooltipTotal(
      event,
      'otros',
      this.entidad || 'Otros',
      this.anio,
      this.mes,
      '',
    );
  }

  onLeaveTotal(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalCompleto(): void {
    this.overlayService.abrirModalCompleto(
      'otros',
      this.entidad || 'Otros',
      this.anio,
      this.mes,
      '',
    );
  }

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private calcularTotal(registros: any[]): number {
    return registros.reduce((acc, fila) => {
      const desc = fila['descripcion'] || '';
      if (this.normalizar(desc).includes('compensacion')) {
        return acc;
      }
      const montoCrudo = fila['monto'];
      const monto = typeof montoCrudo === 'string'
        ? parseFloat(montoCrudo.replace(/\$/g, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'))
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

}
