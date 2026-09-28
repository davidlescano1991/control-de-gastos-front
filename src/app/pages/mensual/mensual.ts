import { Component, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { MovimientosStoreGoogle } from '../../stores/movimiento.google';
import { WakeLockService } from '../../services/wake-lock.service';
import { AppConfigService } from '../../services/app-config.service';
import { VisaComponent } from './lista-entidades/visa/visa';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { GraficoVisa } from './graficos-entidades/visa/grafico-visa/grafico-visa';
import { Bancor } from './lista-entidades/bancor/bancor';
import { MasterGalicia } from './lista-entidades/master-galicia/master-galicia';
import { Naranja } from './lista-entidades/naranja/naranja';
import { Otros } from './lista-entidades/otros/otros';
import { Resumen } from './resumen/resumen';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NovedadesCuotas } from './actualizacion-cuotas/actualizacion-cuotas';
import { GraficoMensualHistorico } from './graficos-entidades/grafico-historico/grafico-historico-mensual';
import { Entidad } from '../../models/entidad';
import { MercadoLibre } from './lista-entidades/mercado-libre/mercado-libre';

import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { MatIconModule } from '@angular/material/icon';

import { TablaCuotasCoincidentes } from './cuotas-coincidentes/tabla-cuotas-coincidentes/tabla-cuotas-coincidentes';
import { GraficoCuotasCoincidentes } from './cuotas-coincidentes/grafico-cuotas-coincidentes/grafico-cuotas-coincidentes';
import { TablaProyeccionTotales } from './proyeccion-totales/tabla-proyeccion-totales/tabla-proyeccion-totales';
import { GraficoProyeccionTotales } from './proyeccion-totales/grafico-proyeccion-totales/grafico-proyeccion-totales';
import { SelectorAnioDelorean } from '../../common/selector-anio-delorean/selector-anio-delorean';

@Component({
  selector: 'app-mensual',
  templateUrl: './mensual.html',
  styleUrls: ['./mensual.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    VisaComponent,
    MatCardContent,
    GraficoVisa,
    MasterGalicia,
    Naranja,
    Bancor,
    MercadoLibre,
    Otros,
    Resumen,
    MatInputModule,
    MatStepperModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    NovedadesCuotas,
    GraficoMensualHistorico,
    TablaCuotasCoincidentes,
    GraficoCuotasCoincidentes,
    TablaProyeccionTotales,
    GraficoProyeccionTotales,
    SelectorAnioDelorean,
  ],
})
export class Mensual implements OnInit, OnDestroy {
  isMobile = false;
  sidebarCollapsed = signal(false);
  resumenGraficoCollapsed = signal(false);
  gastosHistoricosCollapsed = signal(false);
  gastosMensualesCollapsed = signal(false);

  colIzquierdaContraida = signal(false);
  colDerechaContraida = signal(false);
  todasEntidadesContraidas = signal(false);
  todosGraficosContraidos = signal(false);

  toggleGastosMensuales() {
    this.gastosMensualesCollapsed.update((v) => !v);
  }

  toggleColIzquierdaHorizontal() {
    this.colIzquierdaContraida.update((v) => !v);
  }

  toggleColDerechaHorizontal() {
    this.colDerechaContraida.update((v) => !v);
  }

  toggleTodasLasEntidades() {
    this.todasEntidadesContraidas.update((v) => !v);
  }

  toggleTodosLosGraficos() {
    this.todosGraficosContraidos.update((v) => !v);
  }

  toggleResumenGrafico() {
    this.resumenGraficoCollapsed.update((v) => !v);
  }

  toggleGastosHistoricos() {
    this.gastosHistoricosCollapsed.update((v) => !v);
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
  ];
  private appConfig = inject(AppConfigService);
  anios: number[] = [];
  readonly refreshIntervalMs = 5000;
  anioSeleccionado = signal<number>(new Date().getFullYear());
  mesSeleccionado = signal(this.meses[0]);
  isCargando = signal(false);

  // Visa
  visaDatos = signal<Entidad[]>([]);
  visaEntidad = signal('');
  ultimaClaveVisa = '';

  // Master Galicia
  masterDatos = signal<Entidad[]>([]);
  masterEntidad = signal('');
  ultimaClaveMaster = '';

  // Naranja
  naranjaDatos = signal<Entidad[]>([]);
  naranjaEntidad = signal('');
  ultimaClaveNaranja = '';

  // Bancor
  bancorDatos = signal<Entidad[]>([]);
  bancorEntidad = signal('');
  ultimaClaveBancor = '';

  // Otros
  otrosDatos = signal<Entidad[]>([]);
  otrosEntidad = signal('');
  ultimaClaveOtros = '';

  // ML
  mLDatos = signal<Entidad[]>([]);
  mLEntidad = signal('');
  ultimaClaveML = '';

  private storeGoogle = inject(MovimientosStoreGoogle);
  private wakeLockService = inject(WakeLockService);
  resultados = signal<{ anio: number; mes: string; total: number }[]>([]);
  mensajeEstado = '';
  private refreshTimerId: number | null = null;
  private autoRefreshInProgress = false;
  async ngOnInit() {
    this.mensajeEstado = 'Inicializando WakeLock()';
    this.wakeLockService.requestWakeLock();
    const fecha = new Date();
    const nombreMes = fecha.toLocaleString('es-AR', { month: 'long' });
    const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    const configuredYears = this.appConfig.yearsMensual;
    if (configuredYears && configuredYears.length) {
      this.anios = configuredYears;
      const anio = fecha.getFullYear();
      this.anioSeleccionado.set(this.anios.includes(anio) ? anio : this.anios[0]);
    }
    this.mensajeEstado = 'Inicializando cargarTotalesTotales()';
    await this.cargarTotalesTotales();
    this.mensajeEstado = `Inicializando seleccionarMes(mesCapitalizado=${mesCapitalizado})`;
    await this.seleccionarMes(mesCapitalizado);
    this.mensajeEstado = ``;
    this.iniciarAutoRefresh();
  }

  ngOnDestroy(): void {
    this.detenerAutoRefresh();
    void this.wakeLockService.releaseWakeLock();
  }

  async seleccionarAnio(index: number) {
    const anio = this.anios[index];
    this.anioSeleccionado.set(anio);
    await this.seleccionarMes(this.mesSeleccionado());
  }

  async seleccionarMes(mes: string, force = false, mostrarCarga = true) {
    if (mostrarCarga) {
      this.isCargando.set(true);
    }

    try {
      this.mesSeleccionado.set(mes);

      const anio = this.anioSeleccionado();
      const claveVisa = `${anio}_${mes}_visa`;
      const claveMaster = `${anio}_${mes}_master`;
      const claveNaranja = `${anio}_${mes}_naranja`;
      const claveBancor = `${anio}_${mes}_bancor`;
      const claveOtros = `${anio}_${mes}_otros`;
      const claveML = `${anio}_${mes}_ml`;

      if (
        !force &&
        claveVisa === this.ultimaClaveVisa &&
        claveMaster === this.ultimaClaveMaster &&
        claveNaranja === this.ultimaClaveNaranja &&
        claveBancor === this.ultimaClaveBancor &&
        claveOtros === this.ultimaClaveOtros &&
        claveML === this.ultimaClaveML
      ) {
        return;
      }

      await this.storeGoogle.asegurarMensualPorAnioRange(
        anio,
        [mes],
        'Mensual.seleccionarMes',
        force,
      );
      await this.storeGoogle.cargarEntidadesDeMesPorAnio(anio, mes);
      const registrosVisa = this.storeGoogle.getEntidadVisa(anio, mes);
      console.error(`registros visa ${JSON.stringify(registrosVisa)}`);
      const headVisa = this.storeGoogle.getHeaderVisa(anio, mes);
      this.setSignalIfChanged(this.visaDatos, registrosVisa ?? []);
      this.setSignalIfChanged(this.visaEntidad, headVisa[0] ?? 'Visa');
      this.ultimaClaveVisa = claveVisa;

      const registrosMaster = this.storeGoogle.getEntidadMasterGalicia(anio, mes);
      const headMaster = this.storeGoogle.getHeaderMasterGalicia(anio, mes);
      this.setSignalIfChanged(this.masterDatos, [...(registrosMaster ?? [])]);
      this.setSignalIfChanged(this.masterEntidad, headMaster[0] ?? 'Master Galicia');
      this.ultimaClaveMaster = claveMaster;

      const registrosNaranja = this.storeGoogle.getEntidadNaranja(anio, mes);
      const headNaranja = this.storeGoogle.getHeaderNaranja(anio, mes);
      this.setSignalIfChanged(this.naranjaDatos, registrosNaranja ?? []);
      this.setSignalIfChanged(this.naranjaEntidad, headNaranja[0] ?? 'Naranja');
      this.ultimaClaveNaranja = claveNaranja;

      const registrosBancor = this.storeGoogle.getEntidadBancor(anio, mes);
      const headBancor = this.storeGoogle.getHeaderBancor(anio, mes);
      this.setSignalIfChanged(this.bancorDatos, registrosBancor ?? []);
      this.setSignalIfChanged(this.bancorEntidad, headBancor[0] ?? 'Bancor');
      this.ultimaClaveBancor = claveBancor;

      const registrosML = this.storeGoogle.getEntidadML(anio, mes);
      const headML = this.storeGoogle.getHeaderML(anio, mes);
      this.setSignalIfChanged(this.mLDatos, registrosML ?? []);
      this.setSignalIfChanged(this.mLEntidad, headML[0] ?? 'Mercado Libre');
      this.ultimaClaveBancor = claveML;

      console.warn(`registrosML: ${JSON.stringify(registrosML)}`);

      const registrosOtros = this.storeGoogle.getEntidadOtros(anio, mes);
      const headOtros = 'Otros';
      this.setSignalIfChanged(this.otrosDatos, registrosOtros ?? []);
      this.setSignalIfChanged(this.otrosEntidad, headOtros);
      this.ultimaClaveOtros = claveOtros;
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
  }

  async cargarTotalesTotales(mostrarCarga = true, force = false) {
    if (mostrarCarga) {
      this.isCargando.set(true);
    }

    try {
      const mesesDelAnio = this.storeGoogle.base;
      const resultados: { anio: number; mes: string; total: number }[] = [];

      for (const anio of this.anios) {
        const rangos = this.storeGoogle.ValidarRangoEntidades(anio);
        const entidades = Object.keys(rangos) as (keyof typeof rangos)[];
        await this.storeGoogle.asegurarMensualPorAnioRange(anio, mesesDelAnio, 'mensual', force);
        const promesas = mesesDelAnio.map(async (mes) => {
          const hoja = await this.storeGoogle.getMensualPorMes(anio, mes);

          let totalMes = 0;
          if (hoja?.values) {
            for (const entidad of entidades) {
              const { inicio, fin, headerIndex } = rangos[entidad];
              const headers = hoja.values[headerIndex] ?? [];
              const colIndex = headers.findIndex((h) =>
                this.normalizar(mes).includes(this.normalizar(h)),
              );

              if (colIndex === -1 && entidad !== 'otros') continue;

              if (entidad === 'otros') {
                for (let i = inicio; i <= fin; i++) {
                  const fila = hoja.values[i];
                  const monto = fila?.[1];
                  if (monto) totalMes += this.parseMoneda(monto);
                }
              } else {
                for (let i = inicio; i <= fin; i++) {
                  const fila = hoja.values[i];
                  const monto = fila?.[colIndex];
                  if (monto) totalMes += this.parseMoneda(monto);
                }
              }
            }
          }
          return { anio, mes, total: totalMes };
        });

        const resultadosAnio = await Promise.all(promesas);
        resultados.push(...resultadosAnio);
      }
      resultados.sort((a, b) => {
        if (a.anio !== b.anio) return a.anio - b.anio;
        return mesesDelAnio.indexOf(a.mes) - mesesDelAnio.indexOf(b.mes);
      });
      this.setSignalIfChanged(this.resultados, resultados);
      console.log(`✅ Resultado final:`, resultados);
    } finally {
      if (mostrarCarga) {
        this.isCargando.set(false);
      }
    }
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
      await this.cargarTotalesTotales(false, true);
      await this.seleccionarMes(this.mesSeleccionado(), true, false);
    } finally {
      this.autoRefreshInProgress = false;
    }
  }

  private setSignalIfChanged<T>(target: WritableSignal<T>, nextValue: T) {
    if (JSON.stringify(target()) === JSON.stringify(nextValue)) return;
    target.set(nextValue);
  }

  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] ?? c);
  }
  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '')) || 0;
  }
  trackByAnio(index: number, anio: number): number {
    return anio;
  }
}
