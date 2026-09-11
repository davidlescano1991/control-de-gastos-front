import { Component, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { MovimientosStoreGoogle } from '../../stores/movimiento.google';
import { WakeLockService } from '../../services/wake-lock.service';
import { AppConfigService } from '../../services/app-config.service';
import { NgIf, NgFor } from '@angular/common';
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

@Component({
  selector: 'app-home-estimativo',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
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
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeEstimativo implements OnInit, OnDestroy {
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
  /* meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    'Enero_2026', 'Febrero_2026', 'Marzo_2026', 'Abril_2026'
  ]; */
  anios: number[] = [];
  readonly refreshIntervalMs = 12000;
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
  }

  async cargaInicial(mostrarCarga = true, force = false) {
    if (mostrarCarga) {
      this.isCargando.set(true);
    }
    const mesesDelAnio = this.storeGoogle.base.map((mes) => `Estimativo ${mes}`);
    const filas: EstimativoRow[] = [];
    try {
      for (const anio of this.anios) {
        try {
          this.logEstado(
            `...inicia storeGoogle.asegurarMensualPorAnioRange(anio: ${anio}, mesesDelAnio: ${JSON.stringify(mesesDelAnio)}, 'mensual');`,
          );
          await this.storeGoogle.asegurarEstimativoAnioRange(anio, mesesDelAnio, 'mensual', force);
          const fila = await this.storeGoogle.getEstimadosRange(anio, mesesDelAnio);
          console.warn(`Fila en getEstimadoRange: ${JSON.stringify(fila)} para año ${anio}`);
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

      console.log(`✅ Filas ordenadas:`, JSON.stringify(uniqueFilas));
      this.setSignalIfChanged(this.datosHistoricosEstimativos, uniqueFilas);
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
  }

  ngOnDestroy() {
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

    // 1. Hidratar de inmediato desde cache para mostrar datos instantáneos (0ms)
    const filasCache = await this.storeGoogle.getEstimados(anio, hoja);
    if (filasCache && filasCache.length > 0) {
      this.setSignalIfChanged(this.estimativoFilas, filasCache);
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
    //console.log(`✅ filas en Home: ${JSON.stringify(filas)}`);
    this.setSignalIfChanged(this.estimativoFilas, filas);

    // Sincronizar automáticamente datos históricos con los cambios del mes activo
    if (filas && filas.length > 0) {
      const historicosActuales = this.datosHistoricosEstimativos();
      if (historicosActuales.length > 0) {
        const mapaNuevas = new Map(filas.map((f: EstimativoRow) => [f.fecha, f]));
        let huboCambio = false;
        const actualizados = historicosActuales.map((h) => {
          if (mapaNuevas.has(h.fecha)) {
            const nuevaFila = mapaNuevas.get(h.fecha)!;
            if (JSON.stringify(h) !== JSON.stringify(nuevaFila)) {
              huboCambio = true;
              return nuevaFila;
            }
          }
          return h;
        });
        if (huboCambio) {
          this.setSignalIfChanged(this.datosHistoricosEstimativos, actualizados);
        }
      }
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
}
