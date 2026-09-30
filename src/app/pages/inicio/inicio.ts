import { Component, inject, signal, effect, OnDestroy, OnInit, WritableSignal } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardContent } from '@angular/material/card';
import { Movimientos } from './graficos/movimientos/movimientos';
import { ListaSaldoDiario } from './lista-saldo-diario/lista-saldo-diario';
import { MovimientosUsd } from './graficos/movimientos-usd/movimientos-usd';
import { CommonModule } from '@angular/common';

import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { GraficoMovimientosHistoricos } from './graficos/movimientos-historicos/movimientos-historicos';
import { GraficoMovimientosHistoricosUsd } from './graficos/movimientos-historicos-usd/movimientos-historicos-usd';
import { GraficoDiasRestantesAnual } from '../anual/grafico-dias-restantes-anual/grafico-dias-restantes-anual';
import { MovimientosStoreGoogle } from '../../stores/movimiento.google';
import { WakeLockService } from '../../services/wake-lock.service';
import { AppConfigService } from '../../services/app-config.service';
import { Cotizacion } from '../../models/cotizacion';
import { CotizacionStore } from '../../stores/dolar.store';
import { Movimiento2 } from '../../models/movimiento';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { parseFechaEsAR } from '../../utils/grafico.utils';
import { SyncSheetsDbService } from '../../services/sync-sheets-db.service';
import { SseService } from '../../services/sse.service';
import { Subscription } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';

import { SelectorAnioDelorean } from '../../common/selector-anio-delorean/selector-anio-delorean';

@Component({
  selector: 'app-inicio',
  imports: [
    CommonModule,
    MatGridListModule,
    MatCardContent,
    Movimientos,
    ListaSaldoDiario,
    MovimientosUsd,
    MatInputModule,
    MatStepperModule,
    MatFormFieldModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    GraficoMovimientosHistoricos,
    GraficoMovimientosHistoricosUsd,
    GraficoDiasRestantesAnual,
    MatIconModule,
    SelectorAnioDelorean,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit, OnDestroy {
  private _formBuilder = inject(FormBuilder);
  private appConfig = inject(AppConfigService);
  // Polling en Frontend desactivado: delegado 100% a la API con notificaciones SSE en tiempo real
  readonly refreshIntervalMs = 0;
  isMobile = false;
  firstFormGroup = this._formBuilder.group({ firstCtrl: ['', Validators.required] });
  secondFormGroup = this._formBuilder.group({ secondCtrl: ['', Validators.required] });

  anios: number[] = [];
  readonly anioActual = new Date().getFullYear();
  anioSeleccionado = signal<number>(this.anioActual);
  isCargando = signal(false);
  datosHistoricos = signal<{ anio: number; total: number }[]>([]);
  datosHistoricosDiarios = signal<{ fecha: string; total: number; deuda: number }[]>([]);
  resumenPorDia = signal<
    { fecha: string; total: number; diferencia: number; deudaPesos: number }[]
  >([]);
  mensajeEstado = signal<string>('');
  resumenConDolar = signal<Cotizacion[]>([]); //signal Cotizacion[] = [];
  resumenMovimiento = signal<Movimiento2[]>([]); //signal Cotizacion[] = [];
  colIzquierdaContraida = signal(false);
  colDerechaContraida = signal(false);

  toggleColIzquierdaHorizontal() {
    this.colIzquierdaContraida.update((v) => !v);
    if (this.colIzquierdaContraida()) {
      this.colDerechaContraida.set(false);
    }
  }

  toggleColDerechaHorizontal() {
    this.colDerechaContraida.update((v) => !v);
    if (this.colDerechaContraida()) {
      this.colIzquierdaContraida.set(false);
    }
  }

  // Inyección con la nueva API
  private storeGoogle = inject(MovimientosStoreGoogle);
  private wakeLockService = inject(WakeLockService);
  private cotizacionStore = inject(CotizacionStore);
  private breakpointObserver = inject(BreakpointObserver);
  private syncSheetsDb = inject(SyncSheetsDbService);
  private sseService = inject(SseService);
  private refreshTimerId: number | null = null;
  private autoRefreshInProgress = false;
  private sseSub: Subscription | null = null;

  constructor() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe((result) => {
      this.isMobile = result.matches;
    });
  }
  private handleFocus = () => {
    console.log('👁️ Ventana enfocado, refrescando datos desde Google Sheets...');
    void this.refrescarAutomaticamente();
  };

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      console.log('👁️ Pestaña visible, refrescando datos desde Google Sheets...');
      void this.refrescarAutomaticamente();
    }
  };

  async ngOnInit(): Promise<void> {
    this.logEstado(`...Inicializando WakeLock()`);
    this.wakeLockService.requestWakeLock();
    const configuredYears = this.appConfig.yearsInicio;
    if (configuredYears && configuredYears.length) {
      this.anios = configuredYears;
      const anioToSelect = this.anios.includes(this.anioActual) ? this.anioActual : this.anios[0];
      this.anioSeleccionado.set(anioToSelect);
    }
    await this.cargarHistoricoCompleto();
    this.iniciarAutoRefresh();

    // 📡 Suscripción reactiva en tiempo real al canal SSE
    this.sseSub = this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        console.log('⚡ [Inicio] Actualización en tiempo real recibida vía SSE. Recargando...', msg.data);
        void this.refrescarAutomaticamente();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleFocus);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleFocus);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.sseSub?.unsubscribe();
    this.detenerAutoRefresh();
    void this.wakeLockService.releaseWakeLock();
  }
  async cargarHistoricoCompleto(mostrarCarga = true, force = false, registrarEstado = true) {
    if (registrarEstado) {
      this.logEstado(`...inicia cargarHistoricoCompleto()`);
    }
    if (mostrarCarga) {
      this.isCargando.set(true);
    }

    try {
      const agrupadoPorFechaTotal = new Map<number, number>();
      const agrupadoPorFechaDeuda = new Map<number, number>();
      for (const anio of this.anios) {
        if (registrarEstado) {
          this.logEstado(`...inicia cargarDesdeSheetsPorAnio(anio: ${anio})`);
        }
        const debeForzar = force && (anio === this.anioActual || anio === this.anioSeleccionado());
        await this.storeGoogle.cargarDesdeSheetsPorAnio(anio, debeForzar);
        if (registrarEstado) {
          this.logEstado(`...inicia getMovimientosPorAnio(anio: ${anio})`);
        }
        const lista = this.storeGoogle.getMovimientosPorAnio(anio);
        for (const mov of lista) {
          const fechaKey = new Date(mov.fecha);
          fechaKey.setHours(0, 0, 0, 0);
          const key = fechaKey.getTime();
          const monto = typeof mov.monto === 'number' ? mov.monto : parseFloat(mov.monto) || 0;
          agrupadoPorFechaTotal.set(key, (agrupadoPorFechaTotal.get(key) ?? 0) + monto);
          const deuda =
            typeof mov.deudapesos === 'number'
              ? mov.deudapesos
              : parseFloat(mov.deudapesos ?? '0') || 0;
          agrupadoPorFechaDeuda.set(key, (agrupadoPorFechaDeuda.get(key) ?? 0) + deuda);
        }
      }

      const acumulado = Array.from(agrupadoPorFechaTotal.entries())
        .map(([time, total]) => {
          const fecha = new Date(time);
          const dia = String(fecha.getDate()).padStart(2, '0');
          const mes = String(fecha.getMonth() + 1).padStart(2, '0');
          const anio = fecha.getFullYear();
          return {
            fecha: `${dia}-${mes}-${anio}`,
            total,
            deuda: agrupadoPorFechaDeuda.get(time) ?? 0,
          };
        })
        .sort(
          (a, b) =>
            parseFechaEsAR(a.fecha).getTime() -
            parseFechaEsAR(b.fecha).getTime(),
        );

      this.setSignalIfChanged(this.datosHistoricosDiarios, acumulado);

      const anioInicial = this.anioSeleccionado();
      await this.ObtenerResumenPorAnio(anioInicial);
      console.log('fin método cargarHistoricoCompleto()');
      if (registrarEstado) {
        this.logEstado(`...finaliza método cargarHistoricoCompleto()`);
      }
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
  }

  private async verificarYSincronizarConBD(): Promise<void> {
    // Si está desconectada de la API en vivo, ni siquiera validar
    if (!this.sseService.isConnected()) {
      return;
    }
    try {
      const res = await this.syncSheetsDb.sincronizarMovimientosNuevos(this.anioActual);
      if (res.sincronizados > 0) {
        console.log(`✨ [Inicio] ${res.sincronizados} fecha(s) guardadas automáticamente en la BD:`, res.fechas);
      }
    } catch (err) {
      console.warn('⚠️ [Inicio] Error al verificar sincronización con la BD:', err);
    }
  }

  private async ObtenerResumenPorAnio(anioInicial: number) {
    this.logEstado(
      `...obteniendo resumen de storeGoogle.getResumenPorDia(anioInicial=${anioInicial})`,
    );
    const resumenListaMovimientos = this.storeGoogle.getResumenPorDia(anioInicial);
    // Setear sincrónicamente: el @if del template usa resumenPorDia para crear el componente
    this.setSignalIfChanged(this.resumenPorDia, resumenListaMovimientos);
    if (resumenListaMovimientos.length === 0) return;
    try {
      const resumenConUSD = await this.cotizacionStore.enriquecerConDolarPorRango(
        resumenListaMovimientos,
        anioInicial,
        'Inicio.ts',
      );
      // Si falló el enriquecimiento USD, usar datos base como fallback (se mostrarán sin USD)
      this.setSignalIfChanged(
        this.resumenConDolar,
        resumenConUSD.length > 0 ? resumenConUSD : resumenListaMovimientos,
      );
    } catch (err) {
      console.error(`Error enriching USD data for ${anioInicial}:`, err);
      // Fallback: usar datos sin USD para que la tabla siempre se muestre
      this.setSignalIfChanged(this.resumenConDolar, resumenListaMovimientos);
    }
    console.log(`Resumen para ${anioInicial} con ${resumenListaMovimientos.length} registros`);
  }

  async seleccionarAnio(index: number) {
    const anio = this.anios[index];
    this.resumenConDolar.set([]); // limpiar para destruir el componente anterior antes de recrearlo
    this.anioSeleccionado.set(anio);
    console.log('📅 Año seleccionado:', anio);
    // Forzar recarga desde Sheets para asegurar que obtengamos el último día
    await this.storeGoogle.cargarDesdeSheetsPorAnio(anio, true);
    await this.ObtenerResumenPorAnio(anio);
  }

  private iniciarAutoRefresh() {
    if (typeof window === 'undefined' || this.refreshIntervalMs <= 0) return;
    this.detenerAutoRefresh();
    this.refreshTimerId = window.setInterval(() => {
      void this.refrescarAutomaticamente();
    }, this.refreshIntervalMs);
  }

  private detenerAutoRefresh() {
    if (this.refreshTimerId == null) return;
    clearInterval(this.refreshTimerId);
    this.refreshTimerId = null;
  }

  private async refrescarAutomaticamente() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (this.autoRefreshInProgress || this.isCargando()) return;
    this.autoRefreshInProgress = true;

    try {
      await this.cargarHistoricoCompleto(false, true, false);
    } finally {
      this.autoRefreshInProgress = false;
    }
  }

  private setSignalIfChanged<T>(target: WritableSignal<T>, nextValue: T) {
    if (JSON.stringify(target()) === JSON.stringify(nextValue)) return;
    target.set(nextValue);
  }

  private logEstado(mensaje: string) {
    this.mensajeEstado.set(mensaje);
  }
  /*   onResumenGenerado(anio: number, resumen: any[]) {
    console.log(`📊 Padre recibió resumen del año ${anio} con ${resumen.length} registros`);
    console.log('Resumen recibido:', resumen);
    this.resumenesPorAnio.update(prev => ({ ...prev, [anio]: resumen }));

    // calcular total del año parseando monto
    const total = resumen.reduce((acc, r) => {
    let montoNum = 0;
    if (typeof r.total === 'string') {
      montoNum = parseFloat(r.monto.replace(/\./g, '').replace(',', '.').replace('$', ''));
    } else if (typeof r.total === 'number') {
      montoNum = r.total;
    }
    return acc + montoNum;
  }, 0);

    this.datosHistoricos.update(prev => [
      ...prev.filter(p => p.anio !== anio),
      { anio, total }
    ]);
  }
  */
}
