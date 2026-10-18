import { Component, inject, OnDestroy, OnInit, signal, computed, WritableSignal } from '@angular/core';
import { MovimientosStoreGoogle } from '../../stores/movimiento.google';
import { WakeLockService } from '../../services/wake-lock.service';
import { AppConfigService } from '../../services/app-config.service';
import { SseService } from '../../services/sse.service';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { EntityPaymentService } from '../../services/entity-payment.service';
import { MensualItemsService, FinancialEntityFront } from '../../services/mensual-items.service';
import { SyncMensualSheetsDbService } from '../../services/sync-mensual-sheets-db.service';
import { ModalCargarItemComponent } from './modal-cargar-item/modal-cargar-item';
import { ModalPagarEntidadComponent } from './modal-pagar-entidad/modal-pagar-entidad.component';
import { VisaComponent } from './lista-entidades/visa/visa';
import { NgFor, NgIf, CurrencyPipe } from '@angular/common';
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
import { OrigenDatosComponent } from '../../common/origen-datos/origen-datos.component';
import { ModalProyeccionEntidad } from './proyeccion-entidad/modal-proyeccion-entidad';
import { ProyeccionOverlayService } from '../../services/proyeccion-overlay.service';

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
    OrigenDatosComponent,
    ModalProyeccionEntidad,
    ModalCargarItemComponent,
    ModalPagarEntidadComponent,
  ],
})
export class Mensual implements OnInit, OnDestroy {
  public overlayService = inject(ProyeccionOverlayService);
  public authService = inject(AuthService);
  private mensualItemsService = inject(MensualItemsService);
  public syncMensualService = inject(SyncMensualSheetsDbService);
  readonly esOrigenBD = signal<boolean>(false);
  readonly leyendaFallback = signal<string>('');
  readonly leyendaOrigenActual = computed(() => {
    if (this.leyendaFallback()) {
      return this.leyendaFallback();
    }
    if (this.esOrigenBD()) {
      return '* Información obtenida desde la BD';
    }
    return this.appConfig.getLeyendaOrigen(this.anioSeleccionado());
  });
  mostrarModalCargar = signal(false);
  itemParaEditar = signal<any>(null);
  modoEliminarDirecto = signal<boolean>(false);

  // 🏛️ Gestión Dinámica de Entidades con Vigencia Temporal
  entidadesVigentes = signal<FinancialEntityFront[]>([]);
  entidadADarDeBaja = signal<FinancialEntityFront | null>(null);
  mostrarModalBajaEntidad = signal<boolean>(false);
  isProcesandoBaja = signal<boolean>(false);
  bajaError = signal<string>('');
  bajaSuccess = signal<string>('');
  datosItemsPorEntidad = signal<Record<string, any>>({});

  async cargarEntidadesVigentes(anio: number, mesNombre: string): Promise<void> {
    const mesNum = this.meses.indexOf(mesNombre) + 1;
    if (mesNum < 1 || mesNum > 12) return;
    try {
      const list = await firstValueFrom(this.mensualItemsService.getEntidadesVigentes(anio, mesNum));
      this.entidadesVigentes.set(list || []);
    } catch (e) {
      console.warn('No se pudieron obtener entidades vigentes:', e);
    }
  }

  estaEntidadVigente(nombre: string): boolean {
    const list = this.entidadesVigentes();
    if (!list || list.length === 0) return true;
    const norm = nombre.toLowerCase().trim();
    return list.some((e) => {
      const eNorm = e.nombre.toLowerCase().trim();
      return (eNorm === norm || eNorm.includes(norm) || norm.includes(eNorm)) && e.activo;
    });
  }

  entidadesPersonalizadasVigentes = computed(() => {
    const list = this.entidadesVigentes();
    const baseNames = [
      'visa galicia', 'visa',
      'master card galicia', 'mastercard',
      'naranja x', 'naranja',
      'bancor',
      'mercado libre', 'mercado pago',
      'otros',
    ];
    return list.filter((e) => !baseNames.some((b) => e.nombre.toLowerCase().includes(b)));
  });

  getDatosEntidadPersonalizada(nombre: string): any[] {
    const map = this.datosItemsPorEntidad();
    const items = map[nombre]?.items || [];
    return items.map((it: any) => ({
      id: it.id,
      descripcion: it.concepto,
      monto:
        typeof it.monto === 'number'
          ? '$ ' + it.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '$ ' + parseFloat(String(it.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      montoCrudo: it.monto,
      formula: it.formula,
      esCuota: it.esCuota,
      cuotaActual: it.cuotaActual,
      totalCuotas: it.totalCuotas,
      grupoCuotaId: it.grupoCuotaId,
      entidad: it.entidad,
      notas: it.notas,
      anio: it.year,
      mes: it.mes,
    }));
  }

  getTotalEntidadPersonalizada(nombre: string): number {
    const map = this.datosItemsPorEntidad();
    return map[nombre]?.subtotal || 0;
  }

  async abrirModalBajaEntidad(entidadOString: FinancialEntityFront | string): Promise<void> {
    if (this.entidadesVigentes().length === 0) {
      await this.cargarEntidadesVigentes(this.anioSeleccionado(), this.mesSeleccionado());
    }
    let entObj: FinancialEntityFront | undefined;
    if (typeof entidadOString === 'string') {
      const norm = entidadOString.toLowerCase().trim();
      entObj = this.entidadesVigentes().find((e) => {
        const eNorm = e.nombre.toLowerCase().trim();
        return eNorm === norm || eNorm.includes(norm) || norm.includes(eNorm);
      });
      if (!entObj) {
        entObj = {
          id: entidadOString,
          nombre: entidadOString,
          tipo: 'TARJETA',
          color: '#768699',
          orden: 99,
          activo: true,
          vigenteDesdeAnio: 2020,
          vigenteDesdeMes: 1,
        };
      }
    } else {
      entObj = entidadOString;
    }
    this.entidadADarDeBaja.set(entObj);
    this.bajaError.set('');
    this.bajaSuccess.set('');
    this.mostrarModalBajaEntidad.set(true);
  }

  cerrarModalBajaEntidad(): void {
    if (this.isProcesandoBaja()) return;
    this.mostrarModalBajaEntidad.set(false);
    this.entidadADarDeBaja.set(null);
  }

  async confirmarBajaEntidad(): Promise<void> {
    const ent = this.entidadADarDeBaja();
    if (!ent || this.isProcesandoBaja()) return;

    this.isProcesandoBaja.set(true);
    this.bajaError.set('');
    this.bajaSuccess.set('');

    const mesNum = this.meses.indexOf(this.mesSeleccionado()) + 1;
    const anio = this.anioSeleccionado();

    try {
      const res = await firstValueFrom(this.mensualItemsService.darDeBajaEntidad(ent.id, anio, mesNum));
      this.isProcesandoBaja.set(false);
      this.bajaSuccess.set(res.message);

      setTimeout(async () => {
        this.cerrarModalBajaEntidad();
        await this.seleccionarMes(this.mesSeleccionado(), true);
        await this.cargarTotalesTotales(false, true);
      }, 1200);
    } catch (err: any) {
      this.isProcesandoBaja.set(false);
      this.bajaError.set(err?.error?.message || err?.message || 'Error al dar de baja la entidad');
    }
  }

  abrirModalCarga(): void {
    this.modoEliminarDirecto.set(false);
    this.itemParaEditar.set(null);
    this.mostrarModalCargar.set(true);
  }

  abrirModalEditar(fila: any): void {
    this.modoEliminarDirecto.set(false);
    this.itemParaEditar.set(fila);
    this.mostrarModalCargar.set(true);
  }

  abrirModalEliminarItem(fila: any): void {
    this.itemParaEditar.set(fila);
    this.modoEliminarDirecto.set(true);
    this.mostrarModalCargar.set(true);
  }

  cerrarModalCargar(): void {
    this.mostrarModalCargar.set(false);
    this.itemParaEditar.set(null);
    this.modoEliminarDirecto.set(false);
  }

  async onItemCreado(event: any): Promise<void> {
    this.cerrarModalCargar();
    await this.seleccionarMes(this.mesSeleccionado(), true);
    await this.cargarTotalesTotales(false, true);
  }

  async onPagoConfirmado(): Promise<void> {
    this.entityPaymentService.cerrarModalPago();
    await this.seleccionarMes(this.mesSeleccionado(), true);
    await this.cargarTotalesTotales(false, true);
  }

  async onAbonoEliminado(): Promise<void> {
    await this.seleccionarMes(this.mesSeleccionado(), true);
    await this.cargarTotalesTotales(false, true);
  }

  /**
   * Sincroniza dinámicamente el total de un mes específico en el histórico mensual (resultados).
   * Si ya existía el año y mes, actualiza su total. Si es un nuevo mes o año, lo agrega y ordena cronológicamente.
   */
  private actualizarMesEnResultados(anio: number, mesNombre: string, total: number): void {
    const mesesDelAnio = this.storeGoogle.base;
    this.resultados.update((actuales) => {
      const idx = actuales.findIndex((r) => r.anio === anio && r.mes.toLowerCase() === mesNombre.toLowerCase());
      let copia = [...actuales];
      if (idx >= 0) {
        copia[idx] = { anio, mes: mesNombre, total };
      } else {
        copia.push({ anio, mes: mesNombre, total });
      }
      copia.sort((a, b) => {
        if (a.anio !== b.anio) return a.anio - b.anio;
        return mesesDelAnio.indexOf(a.mes) - mesesDelAnio.indexOf(b.mes);
      });
      return copia;
    });
  }

  async cargarEntidadesDesdeBD(anio: number, mesNombre: string): Promise<boolean> {
    const mesNum = this.meses.indexOf(mesNombre) + 1;
    if (mesNum < 1 || mesNum > 12) return false;

    try {
      const res = await firstValueFrom(this.mensualItemsService.getItems(anio, mesNum));
      if (!res?.porEntidad) return false;
      this.datosItemsPorEntidad.set(res.porEntidad || {});

      const formatItems = (items: any[]) =>
        (items || []).map((it) => ({
          id: it.id,
          descripcion: it.concepto,
          monto:
            typeof it.monto === 'number'
              ? '$ ' + it.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '$ ' + parseFloat(String(it.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          montoCrudo: it.monto,
          formula: it.formula,
          esCuota: it.esCuota,
          cuotaActual: it.cuotaActual,
          totalCuotas: it.totalCuotas,
          grupoCuotaId: it.grupoCuotaId,
          entidad: it.entidad,
          notas: it.notas,
          anio: it.year,
          mes: it.mes,
        }));

      this.setSignalIfChanged(this.visaDatos, formatItems(res.porEntidad['Visa Galicia']?.items || res.porEntidad['Visa']?.items));
      this.setSignalIfChanged(this.visaEntidad, 'Visa Galicia');

      this.setSignalIfChanged(this.masterDatos, formatItems(res.porEntidad['Master Card Galicia']?.items || res.porEntidad['Master Card']?.items || res.porEntidad['Mastercard']?.items));
      this.setSignalIfChanged(this.masterEntidad, 'Master Card Galicia');

      this.setSignalIfChanged(this.naranjaDatos, formatItems(res.porEntidad['Naranja X']?.items || res.porEntidad['Naranja']?.items));
      this.setSignalIfChanged(this.naranjaEntidad, anio <= 2023 ? 'Naranja' : 'Naranja X');

      this.setSignalIfChanged(this.bancorDatos, formatItems(res.porEntidad['Bancor']?.items));
      this.setSignalIfChanged(this.bancorEntidad, 'Bancor');

      this.setSignalIfChanged(this.mLDatos, formatItems(res.porEntidad['Mercado Libre']?.items || res.porEntidad['Mercado Pago']?.items || res.porEntidad['Mercado Libre / Pago']?.items));
      this.setSignalIfChanged(this.mLEntidad, 'Mercado Libre');

      this.setSignalIfChanged(this.otrosDatos, formatItems(res.porEntidad['Otros']?.items));
      this.setSignalIfChanged(this.otrosEntidad, 'Otros');

      if (res?.resumen) {
        this.actualizarMesEnResultados(anio, mesNombre, Number(res.resumen.totalGeneral || 0));
      }

      return true;
    } catch (err) {
      console.error('Error cargando entidades desde BD para mensual:', err);
      throw err;
    }
  }

  async cargarEntidadesDesdeSheets(anio: number, mes: string, force = false): Promise<void> {
    const claveVisa = `${anio}_${mes}_visa`;
    const claveMaster = `${anio}_${mes}_master`;
    const claveNaranja = `${anio}_${mes}_naranja`;
    const claveBancor = `${anio}_${mes}_bancor`;
    const claveOtros = `${anio}_${mes}_otros`;
    const claveML = `${anio}_${mes}_ml`;

    await this.storeGoogle.asegurarMensualPorAnioRange(
      anio,
      [mes],
      'Mensual.cargarEntidadesDesdeSheets',
      force,
    );
    await this.storeGoogle.cargarEntidadesDeMesPorAnio(anio, mes);

    const registrosVisa = this.storeGoogle.getEntidadVisa(anio, mes);
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
    this.ultimaClaveML = claveML;

    const registrosOtros = this.storeGoogle.getEntidadOtros(anio, mes);
    const headOtros = 'Otros';
    this.setSignalIfChanged(this.otrosDatos, registrosOtros ?? []);
    this.setSignalIfChanged(this.otrosEntidad, headOtros);
    this.ultimaClaveOtros = claveOtros;

    const calcularTotalLista = (lista: Entidad[] | null | undefined) =>
      (lista || []).reduce((acc, it: any) => {
        const mc = it?.montoCrudo;
        if (mc !== undefined && mc !== null) {
          return acc + Number(mc);
        }
        return acc + this.parseMoneda(String(it?.monto ?? ''));
      }, 0);

    const totalMes =
      calcularTotalLista(registrosVisa) +
      calcularTotalLista(registrosMaster) +
      calcularTotalLista(registrosNaranja) +
      calcularTotalLista(registrosBancor) +
      calcularTotalLista(registrosML) +
      calcularTotalLista(registrosOtros);

    if (totalMes > 0) {
      this.actualizarMesEnResultados(anio, mes, totalMes);
    }
  }
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
  public entityPaymentService = inject(EntityPaymentService);


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
  private sseService = inject(SseService);
  anios: number[] = [];
  // Polling desactivado: delegado a la API con notificaciones SSE en tiempo real
  readonly refreshIntervalMs = 0;
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
  private sseSub: Subscription | null = null;
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

    // 📡 Suscripción reactiva en tiempo real al canal SSE
    this.sseSub = this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED' || msg.event === 'MONTHLY_UPDATED') {
        console.log('⚡ [Mensual] Actualización en tiempo real recibida vía SSE. Recargando...', msg.data);
        void this.refrescarAutomaticamente();
        void this.cargarTotalesTotales(false, true);
      }
    });
  }

  ngOnDestroy(): void {
    this.sseSub?.unsubscribe();
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
      await this.cargarEntidadesVigentes(this.anioSeleccionado(), mes);
      const mesIndex = this.meses.indexOf(mes) + 1;
      if (mesIndex >= 1 && mesIndex <= 12) {
        this.entityPaymentService.getPayments(this.anioSeleccionado(), mesIndex).subscribe({
          error: (err) => console.warn('No se pudieron obtener pagos de entidades:', err),
        });
      }
      const anio = this.anioSeleccionado();
      const isSheetsActivo = this.appConfig.isSheetsActivo(anio);

      if (isSheetsActivo) {
        // 1. INTERRUPTOR ACTIVADO: Obtener datos desde Google Sheets
        this.esOrigenBD.set(false);
        this.leyendaFallback.set('');
        await this.cargarEntidadesDesdeSheets(anio, mes, force);

        // 2. SINCRONIZACIÓN AUTOMÁTICA EN SEGUNDO PLANO A LA BD SI ESTÁ CONECTADO A LA API
        if (this.sseService.isConnected()) {
          void this.syncMensualService.sincronizarMesDesdeSheets(anio, mes);
        }
      } else {
        // 3. INTERRUPTOR DESACTIVADO: Modo Base de Datos (PostgreSQL)
        try {
          const cargadoOk = await this.cargarEntidadesDesdeBD(anio, mes);
          if (cargadoOk) {
            this.esOrigenBD.set(true);
            this.leyendaFallback.set('');
          } else {
            throw new Error('No se encontraron registros en la BD');
          }
        } catch (apiError) {
          // 4. FALLBACK A GOOGLE SHEETS SI NO SE PUEDE CONECTAR DESDE LA API
          console.warn('⚠️ [Mensual] No se pudo conectar con la API en modo BD. Recurriendo a Google Sheets como fallback...', apiError);
          this.esOrigenBD.set(false);
          const descHoja = this.appConfig.raw?.origenPorAnio?.[String(anio)]?.descripcion || `Cuentas claras_${anio}`;
          this.leyendaFallback.set(`* Información obtenida desde la hoja ${descHoja} (Fallback: API no disponible)`);
          await this.cargarEntidadesDesdeSheets(anio, mes, force);
        }
      }
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
      const configuredYears = this.appConfig.yearsMensual || [];
      if (configuredYears.length > 0) {
        this.anios = [...new Set([...configuredYears, ...this.anios, this.anioSeleccionado()])].sort((a, b) => b - a);
      }

      const mesesDelAnio = this.storeGoogle.base;
      const resultados: { anio: number; mes: string; total: number }[] = [];
      const anioActual = new Date().getFullYear();

      for (const anio of this.anios) {
        if (!this.appConfig.isSheetsActivo(anio)) {
          try {
            const resAnio = await firstValueFrom(this.mensualItemsService.getItems(anio));
            if (resAnio?.items) {
              const totalesPorMes: Record<number, number> = {};
              for (const it of resAnio.items) {
                totalesPorMes[it.mes] = (totalesPorMes[it.mes] || 0) + Number(it.monto);
              }
              const mesesConDatos = Object.keys(totalesPorMes).map(Number);
              const maxMesConDatos = mesesConDatos.length > 0 ? Math.max(...mesesConDatos) : 0;

              mesesDelAnio.forEach((mesNombre, idx) => {
                const mesNum = idx + 1;
                // Si el año es futuro respecto al actual, no agregar meses futuros vacíos que todavía no tienen datos cargados
                if (anio > anioActual && mesNum > maxMesConDatos && !totalesPorMes[mesNum]) {
                  return;
                }
                resultados.push({ anio, mes: mesNombre, total: totalesPorMes[mesNum] || 0 });
              });
              continue;
            }
          } catch (e) {
            console.warn('⚠️ Error al cargar totales de BD para el año ' + anio + ', recurriendo a Sheets como fallback:', e);
          }
        }
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
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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

  esAnioEnBD(anio: number): boolean {
    return this.appConfig.esAnioEnBD(anio);
  }
}
