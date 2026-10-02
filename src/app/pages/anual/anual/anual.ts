import { NgFor, NgIf } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { WakeLockService } from '../../../services/wake-lock.service';
import { AppConfigService } from '../../../services/app-config.service';
import { SseService } from '../../../services/sse.service';
import { Subscription } from 'rxjs';
import { Prestamo } from '../../../models/prestamo';
import { GraficoSaldoAnual } from '../grafico-saldo-anual/grafico-saldo-anual';
import { GraficoDiasRestantesAnual } from '../grafico-dias-restantes-anual/grafico-dias-restantes-anual';
import { RendimientosPositivosMensuales } from '../rendimientos-positivos-mensuales/rendimientos-positivos-mensuales';
import { GraficoRendimientosPositivosMensuales } from '../grafico-rendimientos-positivos-mensuales/grafico-rendimientos-positivos-mensuales';
import { TablaPrestamos } from '../tabla-prestamos/tabla-prestamos';
import { TablaGastosMensuales } from '../tabla-gastos-mensuales/tabla-gastos-mensuales';
import { TablaGastosDiarioPromedio } from '../tabla-gastos-diario-promedio/tabla-gastos-diario-promedio';
import { GraficoGastoAnual } from '../grafico-gasto-anual/grafico-gasto-anual';
import { GraficoGastosDiarioPromedio } from '../grafico-gastos-diario-promedio/grafico-gastos-diario-promedio';
import { TablaDeudaTotal } from '../tabla-deuda-total/tabla-deuda-total';
import { GraficoDeudaTotal } from '../grafico-deuda-total/grafico-deuda-total';
import { GraficoDeudaTotalUsd } from '../grafico-deuda-total-usd/grafico-deuda-total-usd';
import { GraficoDeudaTotalHistorico } from '../grafico-deuda-total-historico/grafico-deuda-total-historico';
import { GraficoDeudaTotalHistoricoUsd } from '../grafico-deuda-total-historico-usd/grafico-deuda-total-historico-usd';
import { TablaIngresoNeto } from '../tabla-ingreso-neto/tabla-ingreso-neto';
import { GraficoIngresoNeto } from '../grafico-ingreso-neto/grafico-ingreso-neto';
import { GraficoIngresoNetoUsd } from '../grafico-ingreso-neto-usd/grafico-ingreso-neto-usd';
import { GraficoIngresoNetoHistorico } from '../grafico-ingreso-neto-historico/grafico-ingreso-neto-historico';
import { GraficoIngresoNetoHistoricoUsd } from '../grafico-ingreso-neto-historico-usd/grafico-ingreso-neto-historico-usd';
import { CotizacionStore } from '../../../stores/dolar.store';
import { DeudaTotalMes, DeudaTotalHistoricoItem } from '../../../models/deuda-total';
import { IngresoNetoMes, IngresoNetoHistoricoItem } from '../../../models/ingreso-neto';
import { parseCellCoordinates } from '../../../utils/grafico.utils';
import { MatStepperModule } from '@angular/material/stepper';

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { SelectorAnioDelorean } from '../../../common/selector-anio-delorean/selector-anio-delorean';
import { OrigenDatosComponent } from '../../../common/origen-datos/origen-datos.component';

@Component({
  selector: 'app-anual',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    GraficoSaldoAnual,
    GraficoDiasRestantesAnual,
    RendimientosPositivosMensuales,
    GraficoRendimientosPositivosMensuales,
    TablaPrestamos,
    TablaGastosMensuales,
    TablaGastosDiarioPromedio,
    TablaDeudaTotal,
    TablaIngresoNeto,
    GraficoGastoAnual,
    GraficoGastosDiarioPromedio,
    GraficoDeudaTotal,
    GraficoDeudaTotalUsd,
    GraficoDeudaTotalHistorico,
    GraficoDeudaTotalHistoricoUsd,
    GraficoIngresoNeto,
    GraficoIngresoNetoUsd,
    GraficoIngresoNetoHistorico,
    GraficoIngresoNetoHistoricoUsd,
    MatStepperModule,
    SelectorAnioDelorean,
    OrigenDatosComponent,
  ],
  templateUrl: './anual.html',
  standalone: true,
  styleUrl: './anual.scss',
})
export class Anual implements OnInit, OnDestroy {
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

  // Polling desactivado: delegado a la API con notificaciones SSE en tiempo real
  readonly refreshIntervalMs = 0;
  isCargando = signal(false);
  filas = signal<Prestamo[]>([]);
  filasSecundarias = signal<Prestamo[]>([]);
  categorias = signal<string[]>([]);
  categoriasSecundarias = signal<string[]>([]);
  filasAnioActual = signal<Prestamo[]>([]);
  categoriasAnioActual = signal<string[]>([]);
  readonly Math = Math;
  private appConfig = inject(AppConfigService);
  private cotizacionStore = inject(CotizacionStore);
  private sseService = inject(SseService);
  private sseSub: Subscription | null = null;
  anios: number[] = [];
  readonly anioActual = new Date().getFullYear();
  anioSeleccionado = signal<number>(this.anioActual);

  // DeLorean Time Travel Animation state
  isTimeTraveling = signal(false);
  travelDirection = signal<'left' | 'right'>('right');
  fireTrailLeft = signal<string>('0%');
  fireTrailWidth = signal<string>('0%');

  deloreanPosition = computed(() => {
    const total = this.anios.length;
    if (total <= 1) return '50%';
    const idx = this.anios.indexOf(this.anioSeleccionado());
    if (idx === -1) return '0%';
    const pct = (idx / (total - 1)) * 100;
    return `${pct}%`;
  });

  resumenesPorAnio = signal<Record<number, unknown[]>>({});
  graficoAnual = signal<{ mes: string; total: number }[]>([]);
  gastosMensuales = signal<{ mes: string; total: number }[]>([]);
  gastosDiarioPromedio = signal<{ mes: string; total: number }[]>([]);
  deudaTotalAnual = signal<DeudaTotalMes[]>([]);
  deudaTotalHistorico = signal<DeudaTotalHistoricoItem[]>([]);
  ingresoNetoAnual = signal<IngresoNetoMes[]>([]);
  ingresoNetoHistorico = signal<IngresoNetoHistoricoItem[]>([]);
  readonly resultado = signal<Record<string, number>>({});
  readonly resumenPositivo = signal<Prestamo[]>([]);

  meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
    'Enero_2026',
    'Febrero_2026',
    'Marzo_2026',
    'Abril_2026',
  ];
  totalesSaldoAnualesVisa = signal<
    {
      mes: string;
      total: number;
    }[]
  >([]);
  totalesAnualesVisa = signal<
    {
      mes: string;
      total: number;
    }[]
  >([]);
  private storeGoogle = inject(MovimientosStoreGoogle);
  private wakeLockService = inject(WakeLockService);
  private refreshTimerId: number | null = null;
  private autoRefreshInProgress = false;
  private historicoInProgress = false;

  async ngOnInit(): Promise<void> {
    const fecha = new Date();
    await this.wakeLockService.requestWakeLock();
    const cfgYears = Array.isArray(this.appConfig.yearsAnual) ? this.appConfig.yearsAnual : [];
    if (cfgYears.length > 0) {
      this.anios = cfgYears.map((y) => Number(y)).filter((n) => !Number.isNaN(n));
    } else {
      this.anios = [2026, 2025, 2024, 2023, 2022];
    }
    const anioToSelect = this.anios.includes(this.anioActual) ? this.anioActual : this.anios[0];
    this.anioSeleccionado.set(anioToSelect);

    // Recuperar caché instantáneo del histórico si existe
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('deudaTotalHistorico_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.setSignalIfChanged(this.deudaTotalHistorico, parsed);
          }
        }
        const cachedIngreso = localStorage.getItem('ingresoNetoHistorico_cache');
        if (cachedIngreso) {
          const parsedIngreso = JSON.parse(cachedIngreso);
          if (Array.isArray(parsedIngreso) && parsedIngreso.length > 0) {
            this.setSignalIfChanged(this.ingresoNetoHistorico, parsedIngreso);
          }
        }
      } catch (err) {
        console.warn('Error reading historical caches', err);
      }
    }

    const anio = fecha.getFullYear();
    console.log(`El año en onInit() es ${anio}`);
    await this.Inicio();
    this.iniciarAutoRefresh();

    // 📡 Suscripción reactiva en tiempo real al canal SSE
    this.sseSub = this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        console.log('⚡ [Anual] Actualización en tiempo real recibida vía SSE. Recargando...', msg.data);
        void this.refrescarAutomaticamente();
      }
    });
  }

  ngOnDestroy(): void {
    this.sseSub?.unsubscribe();
    this.detenerAutoRefresh();
    void this.wakeLockService.releaseWakeLock();
  }

  porcentajePendiente(): Record<string, number> {
    return this.storeGoogle.calcularPorcentajePendiente();
  }
  async Inicio() {
    this.isCargando.set(true);

    const anio = this.anioSeleccionado();
    console.warn(`año seleccionado ${anio}`);

    try {
      await this.CargarTablaAnual(anio);
    } catch (err) {
      console.error('❌ Error en CargarTablaAnual en Inicio()', err);
    } finally {
      this.isCargando.set(false);
    }

    // Cargar histórico multianual en segundo plano sin bloquear la pantalla inicial
    void this.cargarHistoricoDeudaTotalCompleto();
    void this.cargarHistoricoIngresoNetoCompleto();
  }

  private cacheDeudaAnualPorAnio = new Map<number, DeudaTotalMes[]>();

  private async CargarTablaAnual(anio: number, force = false) {
    if (!this.appConfig.isSheetsActivo(anio)) {
      this.setSignalIfChanged(this.filas, []);
      this.setSignalIfChanged(this.categorias, []);
      this.setSignalIfChanged(this.filasSecundarias, []);
      this.setSignalIfChanged(this.categoriasSecundarias, []);
      this.setSignalIfChanged(this.resultado, {});
      this.setSignalIfChanged(this.gastosMensuales, []);
      this.setSignalIfChanged(this.gastosDiarioPromedio, []);
      this.setSignalIfChanged(this.graficoAnual, []);
      this.setSignalIfChanged(this.deudaTotalAnual, []);
      this.setSignalIfChanged(this.ingresoNetoAnual, []);
      this.setSignalIfChanged(this.resumenPositivo, []);
      this.storeGoogle.tablaAnual.set([]);
      this.storeGoogle.tablaSecundaria.set([]);
      this.storeGoogle.valorOtorgado.set(0);
      return;
    }

    try {
      await this.storeGoogle.cargarTablaAnualAllXAnio(anio, force);
    } catch (err) {
      console.warn(`Error en cargarTablaAnualAllXAnio para ${anio}:`, err);
    }

    const filasPrestamos = this.storeGoogle.tablaAnual?.() ?? [];
    const categoriasPrestamos = this.storeGoogle.categoriasAnuales();

    this.setSignalIfChanged(this.filas, filasPrestamos);
    this.setSignalIfChanged(this.categorias, categoriasPrestamos);
    if (anio === this.anioActual) {
      this.setSignalIfChanged(this.filasAnioActual, filasPrestamos);
      this.setSignalIfChanged(this.categoriasAnioActual, categoriasPrestamos);
    }
    this.setSignalIfChanged(this.filasSecundarias, this.storeGoogle.tablaSecundaria?.() ?? []);
    this.setSignalIfChanged(this.categoriasSecundarias, this.storeGoogle.categoriasSecundaria());

    this.setSignalIfChanged(this.resultado, this.porcentajeRestanteFinalRefactorizado());

    const gastos = this.storeGoogle.getGastosMensualesAnio(anio);
    this.setSignalIfChanged(this.gastosMensuales, gastos);

    const gastosProm = this.storeGoogle.getGastosDiarioPromedioAnio(anio);
    this.setSignalIfChanged(this.gastosDiarioPromedio, gastosProm);

    this.setSignalIfChanged(this.resumenPositivo, this.storeGoogle.tablaAnual());

    // Carga de gráfico de saldo anual con captura aislada
    try {
      const vari = await this.storeGoogle.obtenerTotalesGlobalesDesdeResumenSaldoAnio(anio, force);
      this.setSignalIfChanged(this.graficoAnual, vari);
    } catch (err) {
      console.warn(`Error al cargar totales globales de saldo para ${anio}:`, err);
    }

    // Carga de deuda total del año seleccionado con captura aislada y caché instantáneo
    try {
      const datosDeuda = await this.calcularDeudaTotalParaAnio(anio, force);
      this.setSignalIfChanged(this.deudaTotalAnual, datosDeuda);
    } catch (err) {
      console.warn(`Error al calcular deuda total para ${anio}:`, err);
    }

    // Carga de ingreso neto del año seleccionado con captura aislada y caché instantáneo
    try {
      const datosIngreso = await this.calcularIngresoNetoParaAnio(anio, force);
      this.setSignalIfChanged(this.ingresoNetoAnual, datosIngreso);
    } catch (err) {
      console.warn(`Error al calcular ingreso neto para ${anio}:`, err);
    }
  }

  async calcularDeudaTotalParaAnio(anio: number, force = false): Promise<DeudaTotalMes[]> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      return [];
    }

    if (!force && this.cacheDeudaAnualPorAnio.has(anio)) {
      return this.cacheDeudaAnualPorAnio.get(anio)!;
    }

    if (!force && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(`deuda_total_meses_${anio}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cacheDeudaAnualPorAnio.set(anio, parsed);
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`Error reading deuda_total_meses_${anio}`, err);
      }
    }

    try {
      if (anio !== this.anioSeleccionado() || force) {
        await this.storeGoogle.cargarTablaAnualAllXAnio(anio, force);
      }
      const filasPrestamos = this.storeGoogle.tablaAnual?.() ?? [];
      const categoriasPrestamos = this.storeGoogle.categoriasAnuales();
      if (anio === this.anioActual) {
        this.setSignalIfChanged(this.filasAnioActual, filasPrestamos);
        this.setSignalIfChanged(this.categoriasAnioActual, categoriasPrestamos);
      }
      const filasMeses = filasPrestamos.slice(1, -1);

      const primerMesPorCategoria = new Map<string, number>();
      for (const cat of categoriasPrestamos) {
        for (let i = 0; i < filasMeses.length; i++) {
          const fila = filasMeses[i];
          const val = fila.valores?.[cat] ?? 0;
          if (val > 0) {
            primerMesPorCategoria.set(cat, i);
            break;
          }
        }
      }

      const proyeccionFuturaRaw = await this.storeGoogle.obtenerProyeccionTotalesFuturosAnio(anio, force);
      const MESES_BASE = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];

      const proyeccionFutura = anio < this.anioActual
        ? proyeccionFuturaRaw.filter((item) => MESES_BASE.includes(item.mes.toLowerCase().trim()))
        : proyeccionFuturaRaw;

      const nombresMeses = proyeccionFutura.map((item) => item.mes);
      const cotizacionesMensuales = await this.cotizacionStore.obtenerCotizacionesMensualesParaAnio(
        anio,
        nombresMeses,
      );

      const resultado = proyeccionFutura.map((item, mesIdx) => {
        const mesNorm = this.storeGoogle.normalizar(item.mes);
        const idxMesEnFilas = filasMeses.findIndex(
          (f) => this.storeGoogle.normalizar(f.nombreFila) === mesNorm,
        );
        const targetIdx = idxMesEnFilas !== -1 ? idxMesEnFilas : mesIdx;

        let totalPrestamosRestante = 0;
        const desglosePrestamos: { nombre: string; monto: number; cuotas?: number }[] = [];

        for (const cat of categoriasPrestamos) {
          const primerIdx = primerMesPorCategoria.get(cat);
          if (primerIdx !== undefined && primerIdx <= targetIdx) {
            let sumaCat = 0;
            let cantCuotasRestantes = 0;
            for (let r = targetIdx; r < filasMeses.length; r++) {
              const val = filasMeses[r]?.valores?.[cat] ?? 0;
              if (val > 0) {
                sumaCat += val;
                cantCuotasRestantes++;
              }
            }
            if (sumaCat > 0) {
              totalPrestamosRestante += sumaCat;
              desglosePrestamos.push({
                nombre: cat,
                monto: sumaCat,
                cuotas: cantCuotasRestantes,
              });
            }
          }
        }

        const desgloseTarjetas: { nombre: string; monto: number }[] = [];
        if (item.desglose) {
          for (const [entidad, monto] of Object.entries(item.desglose)) {
            if (monto > 0) {
              desgloseTarjetas.push({
                nombre: entidad.toUpperCase(),
                monto,
              });
            }
          }
        }

        const deudaTotalCalculada = item.subtotal + totalPrestamosRestante;
        const cotizacionMes = cotizacionesMensuales.get(item.mes) ?? 0;
        const deudaTotalUSD =
          cotizacionMes > 0 ? Number((deudaTotalCalculada / cotizacionMes).toFixed(2)) : undefined;

        return {
          mes: item.mes,
          subtotalTarjetas: item.subtotal,
          totalPrestamos: totalPrestamosRestante,
          deudaTotal: deudaTotalCalculada,
          deudaTotalUSD,
          cotizacionUSD: cotizacionMes > 0 ? cotizacionMes : undefined,
          desgloseTarjetas,
          desglosePrestamos,
        };
      });

      if (resultado.length > 0) {
        this.cacheDeudaAnualPorAnio.set(anio, resultado);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`deuda_total_meses_${anio}`, JSON.stringify(resultado));
          } catch (e) {
            console.warn(`Error saving deuda_total_meses_${anio}`, e);
          }
        }
      }

      return resultado;
    } catch (err) {
      console.warn(`⚠️ Error calculando deuda total para año ${anio}:`, err);
      return [];
    }
  }

  async cargarHistoricoDeudaTotalCompleto(force = false) {
    if (this.historicoInProgress) return;
    this.historicoInProgress = true;

    try {
      const aniosOrdenados = [...this.anios].sort((a, b) => a - b);
      const acumulado: DeudaTotalHistoricoItem[] = [];

      for (const anio of aniosOrdenados) {
        const itemsAnio = await this.calcularDeudaTotalParaAnio(anio, force);
        for (const item of itemsAnio) {
          const matchYear = item.mes.match(/(20\d{2})/);
          const anioItem = matchYear ? parseInt(matchYear[1], 10) : anio;
          const mesLimpio = item.mes.replace(/[\d_]+/g, '').trim();
          const mesCorto = mesLimpio.length > 0 ? mesLimpio.slice(0, 3) : item.mes.slice(0, 3);
          const label = `${mesCorto} ${anioItem}`;

          acumulado.push({
            anio: anioItem,
            mes: item.mes,
            label,
            deudaTotal: item.deudaTotal,
            deudaTotalUSD: item.deudaTotalUSD,
            subtotalTarjetas: item.subtotalTarjetas,
            totalPrestamos: item.totalPrestamos,
            cotizacionUSD: item.cotizacionUSD,
          });
        }
        // Pequeña pausa de 150ms para dosificar consultas de fondo y respetar límites de Google
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (acumulado.length > 0) {
        this.setSignalIfChanged(this.deudaTotalHistorico, acumulado);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('deudaTotalHistorico_cache', JSON.stringify(acumulado));
          } catch (e) {
            console.warn('Error saving deudaTotalHistorico_cache', e);
          }
        }
      }
    } finally {
      this.historicoInProgress = false;
    }
  }

  private historicoIngresoInProgress = false;
  private cacheIngresoNetoAnualPorAnio = new Map<number, IngresoNetoMes[]>();

  private parseMoneda(valor: any): number {
    if (valor === undefined || valor === null) return 0;
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const convertido = Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '').trim());
      return isNaN(convertido) ? 0 : convertido;
    }
    return 0;
  }

  async calcularIngresoNetoParaAnio(anio: number, force = false): Promise<IngresoNetoMes[]> {
    if (!this.appConfig.isSheetsActivo(anio)) {
      return [];
    }

    if (!force && this.cacheIngresoNetoAnualPorAnio.has(anio)) {
      return this.cacheIngresoNetoAnualPorAnio.get(anio)!;
    }

    if (!force && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(`ingreso_neto_meses_${anio}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cacheIngresoNetoAnualPorAnio.set(anio, parsed);
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`Error reading ingreso_neto_meses_${anio}`, err);
      }
    }

    try {
      const mesesAMostrarRaw = this.storeGoogle.getMesesParaResumen(anio);
      const MESES_BASE = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];

      const mesesAMostrar =
        anio < this.anioActual
          ? mesesAMostrarRaw.filter((m) => MESES_BASE.includes(m.toLowerCase().trim()))
          : mesesAMostrarRaw;

      await this.storeGoogle.asegurarMensualPorAnioRange(
        anio,
        mesesAMostrar,
        '--> anual.calcularIngresoNetoParaAnio',
        force,
      );

      const celdaConfig = this.appConfig.getCeldaIngresoNetoForYear(anio);
      const { row, col } = parseCellCoordinates(celdaConfig);

      const cotizacionesMensuales = await this.cotizacionStore.obtenerCotizacionesMensualesParaAnio(
        anio,
        mesesAMostrar,
      );

      const resultado: IngresoNetoMes[] = mesesAMostrar.map((mes) => {
        const hoja = this.storeGoogle.getMensualPorMes(anio, mes);
        const celdaValor = hoja?.values?.[row]?.[col];
        const montoRaw = this.parseMoneda(celdaValor);
        const ingresoNeto = Math.abs(montoRaw);

        const cotizacionMes = cotizacionesMensuales.get(mes) ?? 0;
        const ingresoNetoUSD =
          cotizacionMes > 0 && ingresoNeto > 0
            ? Number((ingresoNeto / cotizacionMes).toFixed(2))
            : undefined;

        return {
          mes,
          ingresoNeto,
          ingresoNetoUSD,
          cotizacionUSD: cotizacionMes > 0 ? cotizacionMes : undefined,
        };
      });

      if (resultado.length > 0) {
        this.cacheIngresoNetoAnualPorAnio.set(anio, resultado);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`ingreso_neto_meses_${anio}`, JSON.stringify(resultado));
          } catch (e) {
            console.warn(`Error saving ingreso_neto_meses_${anio}`, e);
          }
        }
      }

      return resultado;
    } catch (err) {
      console.warn(`⚠️ Error calculando ingreso neto para año ${anio}:`, err);
      return [];
    }
  }

  async cargarHistoricoIngresoNetoCompleto(force = false) {
    if (this.historicoIngresoInProgress) return;
    this.historicoIngresoInProgress = true;

    try {
      const aniosOrdenados = [...this.anios].sort((a, b) => a - b);
      const acumulado: IngresoNetoHistoricoItem[] = [];

      for (const anio of aniosOrdenados) {
        const itemsAnio = await this.calcularIngresoNetoParaAnio(anio, force);
        for (const item of itemsAnio) {
          const matchYear = item.mes.match(/(20\d{2})/);
          const anioItem = matchYear ? parseInt(matchYear[1], 10) : anio;
          const mesLimpio = item.mes.replace(/[\d_]+/g, '').trim();
          const mesCorto = mesLimpio.length > 0 ? mesLimpio.slice(0, 3) : item.mes.slice(0, 3);
          const label = `${mesCorto} ${anioItem}`;

          acumulado.push({
            anio: anioItem,
            mes: item.mes,
            label,
            ingresoNeto: item.ingresoNeto,
            ingresoNetoUSD: item.ingresoNetoUSD,
            cotizacionUSD: item.cotizacionUSD,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (acumulado.length > 0) {
        this.setSignalIfChanged(this.ingresoNetoHistorico, acumulado);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('ingresoNetoHistorico_cache', JSON.stringify(acumulado));
          } catch (e) {
            console.warn('Error saving ingresoNetoHistorico_cache', e);
          }
        }
      }
    } finally {
      this.historicoIngresoInProgress = false;
    }
  }
  /*  private async CargarTablaAnual(anio: number) {
    await this.storeGoogle.cargarTablaAnualAllXAnio(anio);

    const filas = this.storeGoogle.tablaAnual?.() ?? [];
    const categorias = this.storeGoogle.categoriasAnuales();
    const filasSec = this.storeGoogle.tablaSecundaria?.() ?? [];
    const categoriasSec = this.storeGoogle.categoriasSecundaria();

    const vari = await this.storeGoogle.obtenerTotalesGlobalesDesdeResumenSaldoAnio(anio);
    const resumenPos = this.storeGoogle.tablaAnual();
    const resultadoCalc = this.porcentajeRestanteFinalRefactorizado();
    console.log(`resultadoCalc es ${JSON.stringify(resultadoCalc)}`)

    // setear en bloque
    this.filas.set(filas);
    this.categorias.set(categorias);
    this.filasSecundarias.set(filasSec);
    this.categoriasSecundarias.set(categoriasSec);
    this.resultado.set(resultadoCalc);
    this.graficoAnual.set(vari);
    this.resumenPositivo.set(resumenPos);
  } */

  porcentajeRestanteFinalRefactorizado(): Record<string, number> {
    const filasIn = this.filas();
    //return
    console.log(`comienza porcentajeRestanteFinal() `);
    const otorgado = filasIn.at(-1)?.valores ?? {}; // 👈 anteúltima fila
    const pendiente = this.calcularTotalesPendientes();

    //console.log(`finaliza totalesPendientes() otorg ${JSON.stringify(otorgado)} pend ${JSON.stringify(pendiente)}`)
    const resultado: Record<string, number> = {};

    for (const cat of Object.keys(otorgado)) {
      const total = otorgado[cat] ?? 0;
      const resto = pendiente[cat] ?? 0;
      //console.log(`resto [cat=${cat}] ${resto}`)
      //console.log(`/ total [cat=${cat}] ${total}`)
      const porcentaje = total > 0 ? (resto / total) * 100 : 0;
      resultado[cat] = Math.round(porcentaje * 100) / 100;
    }
    console.log(`finaliza porcentajeRestanteFinal() resultado ${JSON.stringify(resultado)} `);
    return resultado;
  }

  calcularTotalesPendientes(): Record<string, number> {
    //const filas = this.tablaAnual();
    //const filas = this.tablaAnual().slice(1,-1);
    const filas = this.filas().slice(1, -1);
    //console.log(`total pendiente ${JSON.stringify(filas)}`)
    const totales: Record<string, number> = {};

    for (const fila of filas) {
      for (const cat of Object.keys(fila.valores)) {
        const color = fila.colores?.[cat] ?? '';
        const valor = fila.valores[cat] ?? 0;

        if (color.toLowerCase() !== '#0000ff') {
          //console.log(`calcularTotalesPendientes() valor: ${valor}`)
          totales[cat] = (totales[cat] ?? 0) + valor;
          //console.log(`calcularTotalesPendientes() totales[${cat}]: ${JSON.stringify(totales[cat])}`)
        }
      }
    }

    return totales;
  }
  async seleccionarAnio(index: number) {
    const anio = this.anios[index];
    if (anio === this.anioSeleccionado()) return;

    const prevIndex = this.anios.indexOf(this.anioSeleccionado());
    const total = this.anios.length;

    if (prevIndex !== -1 && total > 1) {
      const isRight = index > prevIndex;
      this.travelDirection.set(isRight ? 'right' : 'left');

      const minIdx = Math.min(prevIndex, index);
      const maxIdx = Math.max(prevIndex, index);
      const startPct = (minIdx / (total - 1)) * 100;
      const widthPct = ((maxIdx - minIdx) / (total - 1)) * 100;

      this.fireTrailLeft.set(`${startPct}%`);
      this.fireTrailWidth.set(`${widthPct}%`);
      this.isTimeTraveling.set(true);

      setTimeout(() => {
        this.isTimeTraveling.set(false);
      }, 800);
    }

    console.warn(`El en seleccionarAnio() es ${anio}`);
    this.anioSeleccionado.set(anio);
    this.isCargando.set(true);

    try {
      await this.CargarTablaAnual(anio);
    } catch (err) {
      console.error(`❌ Error en CargarTablaAnual para año ${anio}`, err);
    } finally {
      this.isCargando.set(false);
    }
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
      await this.CargarTablaAnual(this.anioSeleccionado(), true);
    } finally {
      this.autoRefreshInProgress = false;
    }
  }

  private setSignalIfChanged<T>(target: WritableSignal<T>, nextValue: T) {
    if (JSON.stringify(target()) === JSON.stringify(nextValue)) return;
    target.set(nextValue);
  }

  /* totalesSaldoAnualesVisa = computed(() => {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return this.storeGoogle.obtenerTotalesGlobalesDesdeResumenSaldo(meses);
  }); */
  /* resumenPositivo = computed(() => {
    if (!this.storeGoogle.anualCargado) {
      return this.storeGoogle.cargarTablaAnualAll();
    }
    else return this.storeGoogle.anualCargado;
  });
  get filaOtorgada() {
    return this.storeGoogle.filaOtorgada();
  } */

  esAnioEnBD(anio: number): boolean {
    return this.appConfig.esAnioEnBD(anio);
  }
}
