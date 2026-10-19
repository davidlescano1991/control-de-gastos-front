import { Component, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { MovimientosStoreGoogle } from '../../stores/movimiento.google';
import { WakeLockService } from '../../services/wake-lock.service';
import { AppConfigService } from '../../services/app-config.service';
import { SseService } from '../../services/sse.service';
import { EstimatesService } from '../../services/estimates.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { NgIf, NgFor, CurrencyPipe } from '@angular/common';
import { MatCardContent, MatCardModule } from '@angular/material/card';
import { GraficoEstimativo } from './grafico-estimativo/grafico-estimativo';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { EstimativoMensual } from './mensual/mensual';
import { MatStepperModule } from '@angular/material/stepper';
import { GraficoHistorico } from './grafico-historico/grafico-historico';
import { GraficoDiasRestantesAnual } from '../anual/grafico-dias-restantes-anual/grafico-dias-restantes-anual';

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

interface EstimativoRow {
  fecha: string;
  saldoPesos: number;
  saldoUSD: number;
  deuda: number;
  real: number | null;
  deudaReal: number;
  editando?: boolean;
}

import { SelectorAnioDelorean } from '../../common/selector-anio-delorean/selector-anio-delorean';
import { ModalConfigEstimativo } from './modal-config-estimativo/modal-config-estimativo';
import { ModalEditarDiaComponent } from './modal-editar-dia/modal-editar-dia';

@Component({
  selector: 'app-home-estimativo',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    CurrencyPipe,
    MatCardContent,
    MatCardModule,
    GraficoEstimativo,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    EstimativoMensual,
    MatStepperModule,
    GraficoHistorico,
    GraficoDiasRestantesAnual,
    SelectorAnioDelorean,
    ModalConfigEstimativo,
    ModalEditarDiaComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeEstimativo implements OnInit, OnDestroy {
  modalConfigVisible = signal(false);
  diaParaEditar = signal<any | null>(null);
  modalEditarDiaVisible = signal(false);

  // Parámetros clave del estimativo (Fila 1 Google Sheets / Config BD: I, J, L)
  gastoDiarioEstimado = signal<number>(0);
  interesDiarioBilleteras = signal<number>(0);
  gastoEstimadoMes = signal<number>(0);
  parametrosCollapsed = signal<boolean>(false);

  toggleParametrosCollapse(): void {
    this.parametrosCollapsed.update((v) => !v);
  }

  abrirModalConfig(): void {
    this.modalConfigVisible.set(true);
  }

  cerrarModalConfig(): void {
    this.modalConfigVisible.set(false);
  }

  abrirEditarDia(fila: any): void {
    this.diaParaEditar.set(fila);
    this.modalEditarDiaVisible.set(true);
  }

  cerrarEditarDia(): void {
    this.modalEditarDiaVisible.set(false);
    this.diaParaEditar.set(null);
  }

  async onDiaGuardado(): Promise<void> {
    this.cerrarEditarDia();
    await this.seleccionarMesMensual(this.mesSeleccionado(), true);
    void this.cargaInicial(false, true);
  }

  async onEstimativoConfigurado(): Promise<void> {
    await this.seleccionarMesMensual(this.mesSeleccionado(), true);
    void this.cargaInicial(false, true);
  }

  mesNumero(): number {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const limpio = (this.mesSeleccionado() || '').split('_')[0];
    const idx = meses.indexOf(limpio);
    return idx >= 0 ? idx + 1 : 1;
  }

  isMobile = false;
  sidebarCollapsed = signal(false);

  colIzquierdaContraida = signal(false);
  colDerechaContraida = signal(false);

  toggleColIzquierdaHorizontal() {
    this.colIzquierdaContraida.update((v) => !v);
  }

  toggleColDerechaHorizontal() {
    this.colDerechaContraida.update((v) => !v);
  }
  private breakpointObserver = inject(BreakpointObserver);

  constructor() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe((result) => {
      this.isMobile = result.matches;
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  //this.meses.set(this.storeGoogle.getMesesParaResumen(this.anioSeleccionado))
  meses = signal<string[]>([]);
  private appConfig = inject(AppConfigService);
  anios: number[] = [];
  // Polling desactivado: delegado a la API con notificaciones SSE en tiempo real
  readonly refreshIntervalMs = 0;
  estimativoFilas = signal<EstimativoRow[]>([]);

  anioSeleccionado = signal<number>(new Date().getFullYear());
  mesSeleccionado = signal(this.meses()[0]);
  isCargando = signal(false);
  mensajeEstado = signal<string>('');
  datosHistoricosEstimativos = signal<EstimativoRow[]>([]);
  private refreshTimerId: number | null = null;
  private autoRefreshInProgress = false;

  private storeGoogle = inject(MovimientosStoreGoogle);
  private wakeLockService = inject(WakeLockService);
  private sseService = inject(SseService);
  private estimatesService = inject(EstimatesService);
  private sseSub: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    const configuredYears = this.appConfig.yearsEstimativos;
    if (configuredYears && configuredYears.length) {
      this.anios = configuredYears;
    }
    const fecha = new Date();
    const nombreMes = fecha.toLocaleString('es-AR', { month: 'long' });
    const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    this.wakeLockService.requestWakeLock();

    const anio = fecha.getFullYear();
    const anioValido = this.anios.includes(anio) ? anio : (this.anios[0] || anio);
    this.anioSeleccionado.set(anioValido);

    const mesesDisponibles = this.storeGoogle.getMesesParaResumen(anioValido);
    this.meses.set(mesesDisponibles);
    const mesValido = mesesDisponibles.includes(mesCapitalizado) ? mesCapitalizado : (mesesDisponibles[0] || 'Enero');
    this.mesSeleccionado.set(mesValido);

    // 1. Cargar inmediatamente el mes activo para mostrar la tabla y gráficos de inmediato
    this.logEstado(`...inicia seleccionarMes(${mesValido})`);
    await this.seleccionarMes(mesValido);

    // 2. Cargar histórico en segundo plano sin bloquear la UI
    void this.cargaInicial(false);

    // 3. Iniciar auto-refresco del mes activo
    this.iniciarAutoRefresh();

    // 📡 Suscripción reactiva en tiempo real al canal SSE
    this.sseSub = this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED' || msg.event === 'ESTIMATE_UPDATED') {
        console.log('⚡ [Estimativos] Actualización en tiempo real recibida vía SSE. Recargando...', msg.data);
        void this.refrescarAutomaticamente();
        void this.cargaInicial(false, true);
      }
    });
  }

  async cargaInicial(mostrarCarga = true, force = false) {
    if (mostrarCarga) {
      this.isCargando.set(true);
    }
    const mesesDelAnio = this.storeGoogle.base.map((mes) => `Estimativo ${mes}`);
    const filas: EstimativoRow[] = [];
    try {
      for (const anio of this.anios) {
        if (!this.appConfig.isSheetsActivo(anio)) {
          // Si el año está en modo Base de Datos (ej. 2022), cargar meses disponibles de la BD
          for (let m = 1; m <= 12; m++) {
            try {
              const res = await firstValueFrom(this.estimatesService.getMonthly(anio, m));
              if (res && res.filas && res.filas.length > 0) {
                const mapped = res.filas.map((f: any) => ({
                  fecha: f.fecha,
                  saldoPesos: Number(f.saldoPesos),
                  saldoUSD: f.saldoUSD !== null && f.saldoUSD !== undefined ? Number(f.saldoUSD) : 0,
                  deuda: Number(f.deuda),
                  real: f.real !== null && f.real !== undefined ? Number(f.real) : null,
                  deudaReal: f.deudaReal !== null && f.deudaReal !== undefined ? Number(f.deudaReal) : Number(f.deuda),
                }));
                filas.push(...mapped);
              }
            } catch {
              // mes sin configuración en BD, continuar
            }
          }
          continue;
        }
        try {
          this.logEstado(
            `...inicia storeGoogle.asegurarMensualPorAnioRange(anio: ${anio}, mesesDelAnio: ${JSON.stringify(mesesDelAnio)}, 'mensual');`,
          );
          await this.storeGoogle.asegurarEstimativoAnioRange(anio, mesesDelAnio, 'mensual', force);
          const fila = await this.storeGoogle.getEstimadosRange(anio, mesesDelAnio);
          filas.push(...fila);
        } catch (e) {
          console.warn(`⚠️ Error cargando año ${anio} en cargaInicial estimativos:`, e);
        }
      }
      const uniqueFilas = filas.reduce<EstimativoRow[]>((acc, curr) => {
        if (!acc.some((fila) => fila.fecha === curr.fecha)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      uniqueFilas.sort((a, b) => {
        const [diaA, mesA, anioA] = a.fecha.split('/').map(Number);
        const [diaB, mesB, anioB] = b.fecha.split('/').map(Number);
        const fechaA = new Date(anioA, mesA - 1, diaA).getTime();
        const fechaB = new Date(anioB, mesB - 1, diaB).getTime();
        return fechaA - fechaB;
      });

      this.setSignalIfChanged(this.datosHistoricosEstimativos, uniqueFilas);
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
  }

  ngOnDestroy() {
    this.sseSub?.unsubscribe();
    this.detenerAutoRefresh();
    void this.wakeLockService.releaseWakeLock();
  }

  async seleccionarMes(mes: string, mostrarCarga = true, force = false) {
    if (mostrarCarga) {
      this.isCargando.set(true);
    }
    try {
      this.mesSeleccionado.set(mes);
      await this.seleccionarMesMensual(mes, force);
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
  }

  async seleccionarMesMensual(mes: string, force = false) {
    const hoja = 'Estimativo ' + mes;
    const anio = this.anioSeleccionado();
    const mesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mesBase = mes.split('_')[0];
    let mesNumero = mesNombres.indexOf(mesBase) + 1;
    if (mesNumero <= 0) mesNumero = 1;

    if (!this.appConfig.isSheetsActivo(anio)) {
      try {
        const res = await firstValueFrom(this.estimatesService.getMonthly(anio, mesNumero));
        if (res && res.filas && res.filas.length > 0) {
          const filas: EstimativoRow[] = res.filas.map((f: any) => ({
            id: f.id,
            dia: f.dia,
            fecha: f.fecha,
            saldoPesos: Number(f.saldoPesos),
            saldoUSD: f.saldoUSD !== null && f.saldoUSD !== undefined ? Number(f.saldoUSD) : 0,
            deuda: Number(f.deuda),
            real: f.real !== null && f.real !== undefined ? Number(f.real) : null,
            deudaReal: f.deudaReal !== null && f.deudaReal !== undefined ? Number(f.deudaReal) : Number(f.deuda),
          }));
          this.setSignalIfChanged(this.estimativoFilas, filas);
          this.actualizarFilasEnHistorico(filas);
        } else {
          this.setSignalIfChanged(this.estimativoFilas, []);
        }
        if (res && res.config) {
          this.gastoDiarioEstimado.set(Number(res.config.gastoFijoDiario) || 0);
          this.interesDiarioBilleteras.set(Number(res.config.ingresoInteresDiario) || 0);
          this.gastoEstimadoMes.set(Number(res.config.presupuestoTotal) || 0);
        }
      } catch (err) {
        console.warn(`[HomeEstimativo] Sin datos de estimativo en BD para ${anio}-${mesNumero}:`, err);
        this.setSignalIfChanged(this.estimativoFilas, []);
      }
      return;
    }

    // 1. Hidratar de inmediato desde cache para mostrar datos instantáneos (0ms)
    const filasCache = await this.storeGoogle.getEstimados(anio, hoja);
    if (filasCache && filasCache.length > 0) {
      this.setSignalIfChanged(this.estimativoFilas, filasCache);
      this.actualizarFilasEnHistorico(filasCache);
    }
    const cfgCache = this.storeGoogle.getEstimativoConfig(anio, hoja);
    if (cfgCache) {
      this.gastoDiarioEstimado.set(cfgCache.gastoFijoDiario);
      this.interesDiarioBilleteras.set(cfgCache.ingresoInteresDiario);
      this.gastoEstimadoMes.set(cfgCache.gastoEstimadoMes);
    }

    try {
      await this.storeGoogle.asegurarEstimativoAnioRange(
        anio,
        [hoja],
        'HomeEstimativo.seleccionarMesMensual',
        force,
      );
    } catch (err) {
      console.warn(`⚠️ Error en asegurarEstimativoAnioRange para ${hoja}:`, err);
    }

    const clave = `${anio}::${hoja}`;
    console.warn(`Estimados clave en Home ${clave}`);
    const filas = await this.storeGoogle.getEstimados(anio, hoja);
    this.setSignalIfChanged(this.estimativoFilas, filas);
    this.actualizarFilasEnHistorico(filas);

    const cfgLive = this.storeGoogle.getEstimativoConfig(anio, hoja);
    if (cfgLive && (cfgLive.gastoFijoDiario > 0 || cfgLive.gastoEstimadoMes > 0)) {
      this.gastoDiarioEstimado.set(cfgLive.gastoFijoDiario);
      this.interesDiarioBilleteras.set(cfgLive.ingresoInteresDiario);
      this.gastoEstimadoMes.set(cfgLive.gastoEstimadoMes);
    }

    // Asegurar sincronización con la API de estimaciones (para presupuestoTotal y parámetros de BD/Sheets)
    try {
      const res = await firstValueFrom(this.estimatesService.getMonthly(anio, mesNumero));
      if (res?.config) {
        if (res.config.gastoFijoDiario !== undefined && res.config.gastoFijoDiario > 0) {
          this.gastoDiarioEstimado.set(Number(res.config.gastoFijoDiario));
        }
        if (res.config.ingresoInteresDiario !== undefined && res.config.ingresoInteresDiario > 0) {
          this.interesDiarioBilleteras.set(Number(res.config.ingresoInteresDiario));
        }
        if (res.config.presupuestoTotal !== undefined && res.config.presupuestoTotal !== null && Number(res.config.presupuestoTotal) > 0) {
          this.gastoEstimadoMes.set(Number(res.config.presupuestoTotal));
        }
      }
    } catch {
      // ignorar si no hay conexión o no está disponible
    }
  }

  /**
   * Sincroniza dinámicamente las filas de un mes con el histórico general.
   * Si la fila ya existía, actualiza sus valores. Si es un mes nuevo (ej. Febrero 2027),
   * incorpora automáticamente sus días y reordena cronológicamente el gráfico.
   */
  private actualizarFilasEnHistorico(filasMes: EstimativoRow[]): void {
    if (!filasMes || filasMes.length === 0) return;
    const historicos = [...this.datosHistoricosEstimativos()];
    const mapaNuevas = new Map(filasMes.map((f: EstimativoRow) => [f.fecha, f]));

    let huboCambios = false;
    // 1. Actualizar filas existentes en el histórico
    const actualizadas = historicos.map((h) => {
      if (mapaNuevas.has(h.fecha)) {
        const nueva = mapaNuevas.get(h.fecha)!;
        mapaNuevas.delete(h.fecha);
        if (JSON.stringify(h) !== JSON.stringify(nueva)) {
          huboCambios = true;
          return { ...h, ...nueva };
        }
      }
      return h;
    });

    // 2. Incorporar filas de meses nuevos que aún no estaban en el gráfico histórico
    if (mapaNuevas.size > 0) {
      huboCambios = true;
      for (const [, nuevaFila] of mapaNuevas) {
        actualizadas.push(nuevaFila);
      }
      actualizadas.sort((a, b) => {
        const [diaA, mesA, anioA] = a.fecha.split('/').map(Number);
        const [diaB, mesB, anioB] = b.fecha.split('/').map(Number);
        return new Date(anioA, mesA - 1, diaA).getTime() - new Date(anioB, mesB - 1, diaB).getTime();
      });
    }

    if (huboCambios) {
      this.setSignalIfChanged(this.datosHistoricosEstimativos, actualizadas);
    }
  }

  async seleccionarAnio(index: number) {
    const anio = this.anios[index];
    this.anioSeleccionado.set(anio);
    this.meses.set(this.storeGoogle.getMesesParaResumen(anio));
    await this.seleccionarMesMensual(this.mesSeleccionado());
  }
  private logEstado(mensaje: string) {
    this.mensajeEstado.set(mensaje);
  }
  trackByAnio(index: number, anio: number): number {
    return anio;
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
      // Refrescar directamente la hoja del mes y año actualmente en pantalla sin re-descargar todo el histórico
      await this.seleccionarMesMensual(this.mesSeleccionado(), true);
    } catch (err) {
      console.warn('⚠️ Error en refresco automático de estimativos:', err);
    } finally {
      this.autoRefreshInProgress = false;
    }
  }

  private setSignalIfChanged<T>(target: WritableSignal<T>, nextValue: T) {
    if (JSON.stringify(target()) === JSON.stringify(nextValue)) return;
    target.set(nextValue);
  }

  esAnioEnBD(anio: number): boolean {
    return this.appConfig.esAnioEnBD(anio);
  }
}
