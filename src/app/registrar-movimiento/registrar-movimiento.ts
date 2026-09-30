import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MovimientosService, MovementBackendItem } from '../services/movimientos.service';
import { SseService } from '../services/sse.service';
import { MovimientosStoreGoogle } from '../stores/movimiento.google';
import { AuthService } from '../services/auth.service';

export interface DailyRowItem {
  id: string;
  entidad: string;
  monto: number | null; // Saldo del día (puede ser positivo o negativo)
  montoTexto: string;
  formula?: string;
  desgloseFormula?: string;
  estaEditando?: boolean;
  descripcion?: string;
}

export interface ResultadoFormula {
  esFormula: boolean;
  resultado: number | null;
  formulaLimpia: string;
  desglose: string;
}

@Component({
  selector: 'app-registrar-movimiento',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.scss'],
})
export class RegistrarMovimiento implements OnInit {
  private movimientosService = inject(MovimientosService);
  private sseService = inject(SseService);
  private googleStore = inject(MovimientosStoreGoogle);
  private authService = inject(AuthService);

  // Rol del usuario actual
  public isAdmin = this.authService.isAdmin;

  // Fecha por defecto: hoy en formato YYYY-MM-DD
  fechaSeleccionada = signal<string>(this.obtenerFechaHoyISO());

  // Deuda diaria (se precarga dinámicamente con la última registrada en la base de datos)
  deuda = signal<number | null>(null);
  deudaTexto = signal<string>('');
  deudaFormula = signal<string | null>(null);
  deudaDesglose = signal<string | null>(null);
  deudaEditando = signal<boolean>(false);

  // Entidades principales de cuenta
  private readonly entidadesPorDefecto: string[] = [
    'Santander',
    'Galicia',
    'NX',
    'ML',
    'Efectivo',
  ];

  // Filas dinámicas de cuentas (se precargan con el registro más actual de la BD)
  filas = signal<DailyRowItem[]>(this.generarFilasPorDefecto());

  // Sumatoria dinámica en tiempo real de los saldos (destacada en verde)
  sumatoriaMovimientos = computed(() => {
    return this.filas().reduce((acc, f) => {
      const val = typeof f.monto === 'number' ? f.monto : Number(f.monto) || 0;
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  });

  // Estados de carga y feedback de guardado
  isGuardando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // Listado de movimientos almacenados en la base de datos
  movimientosGuardados = signal<MovementBackendItem[]>([]);
  isCargandoHistorial = signal<boolean>(false);

  // Filtros del historial (sin filtro 'tipo' porque son saldos diarios)
  filtroFechaDesde = signal<string>('');
  filtroFechaHasta = signal<string>('');
  filtroTexto = signal<string>('');

  // Paginación (por defecto 30 items)
  pageSize = signal<number>(30);
  pageIndex = signal<number>(0);
  pageSizeOptions = [10, 20, 30, 50, 100];

  // Movimientos filtrados en memoria para cálculo dinámico de la sumatoria
  movimientosFiltrados = computed(() => {
    const todos = this.movimientosGuardados();
    const texto = this.filtroTexto().trim().toLowerCase();
    const fDesde = this.filtroFechaDesde();
    const fHasta = this.filtroFechaHasta();

    return todos.filter((m) => {
      // 1. Filtro por texto (entidad o descripción)
      if (texto) {
        const ent = (m.entidad || '').toLowerCase();
        const desc = (m.descripcion || '').toLowerCase();
        if (!ent.includes(texto) && !desc.includes(texto)) {
          return false;
        }
      }

      // 2. Filtro por rango de fechas
      const fechaISO = typeof m.fecha === 'string' ? m.fecha.substring(0, 10) : new Date(m.fecha).toISOString().substring(0, 10);
      if (fDesde && fechaISO < fDesde) {
        return false;
      }
      if (fHasta && fechaISO > fHasta) {
        return false;
      }

      return true;
    });
  });

  // Sumatoria unificada y matemática de todos los saldos filtrados
  sumatoriaSaldosFiltrados = computed(() => {
    return this.movimientosFiltrados().reduce((acc, curr) => acc + curr.monto, 0);
  });

  // Items de la página actual
  movimientosPaginados = computed(() => {
    const filtrados = this.movimientosFiltrados();
    const inicio = this.pageIndex() * this.pageSize();
    const fin = inicio + this.pageSize();
    return filtrados.slice(inicio, fin);
  });

  // Registro de deudas guardadas localmente en la sesión actual
  deudasLocalesPorFecha = signal<Record<string, number>>({});

  // Mapa reactivo de Deuda según la fecha para visualizar la deuda de cada día
  mapaDeudaPorFecha = computed(() => {
    const mapa = new Map<string, number>();
    const currentYear = new Date().getFullYear();
    try {
      // 1. Cargar desde los movimientos individuales de googleStore (tienen mov.deudapesos)
      const movs = this.googleStore.getMovimientosPorAnio(currentYear);
      if (movs && movs.length > 0) {
        for (const m of movs) {
          if (m.deudapesos !== null && m.deudapesos !== undefined && m.deudapesos > 0) {
            const fStr = this.normalizarClaveFecha(this.formatearFechaCorta(m.fecha));
            if (fStr) {
              mapa.set(fStr, m.deudapesos);
            }
          }
        }
      }

      // 2. Cargar desde resumenPorDia de googleStore (resumen consolidado)
      const resumen = this.googleStore.getResumenPorDia(currentYear);
      if (resumen && resumen.length > 0) {
        for (const r of resumen) {
          if (r.fecha && r.deudaPesos && r.deudaPesos > 0) {
            const fStr = this.normalizarClaveFecha(r.fecha);
            if (fStr && !mapa.has(fStr)) {
              mapa.set(fStr, r.deudaPesos);
            }
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo leer resumen de deudas de googleStore:', e);
    }
    return mapa;
  });

  /**
   * Normaliza formatos de fecha DD/MM/AAAA para evitar discrepancias de padding.
   */
  normalizarClaveFecha(fecha: string): string {
    if (!fecha) return '';
    const partes = fecha.split('/');
    if (partes.length === 3) {
      const d = partes[0].padStart(2, '0');
      const m = partes[1].padStart(2, '0');
      const y = partes[2];
      return `${d}/${m}/${y}`;
    }
    return fecha;
  }

  /**
   * Obtiene la deuda correspondiente a una fecha específica para la tabla histórica.
   */
  obtenerDeudaPorFecha(fecha: string | Date | null | undefined): number | null {
    if (!fecha) return null;
    const fCorta = this.normalizarClaveFecha(this.formatearFechaCorta(fecha));
    if (this.deudasLocalesPorFecha()[fCorta] !== undefined) {
      return this.deudasLocalesPorFecha()[fCorta];
    }
    return this.mapaDeudaPorFecha().get(fCorta) ?? null;
  }

  async ngOnInit(): Promise<void> {
    const currentYear = new Date().getFullYear();
    try {
      await this.googleStore.cargarDesdeSheetsPorAnio(currentYear);
    } catch (e) {
      console.warn('No se pudieron cargar movimientos desde googleStore:', e);
    }

    this.cargarUltimaDeudaRegistrada();
    this.cargarHistorial();
    this.suscribirEventosTiempoReal();
  }

  /**
   * Carga la última deuda registrada desde el backend o cache dinámico.
   */
  cargarUltimaDeudaRegistrada(): void {
    this.movimientosService.obtenerUltimaDeuda().subscribe({
      next: (res) => {
        if (res && res.ultimaDeuda !== null && res.ultimaDeuda !== undefined) {
          this.asignarDeudaDinamicamente(Number(res.ultimaDeuda));
        } else {
          this.recuperarDeudaLocalFallback();
        }
      },
      error: () => {
        this.recuperarDeudaLocalFallback();
      },
    });
  }

  private recuperarDeudaLocalFallback(): void {
    // 1. Consultar googleStore donde están los estimativos con la deuda real
    try {
      const currentYear = new Date().getFullYear();
      const movs = this.googleStore.getMovimientosPorAnio(currentYear);
      if (movs && movs.length > 0) {
        for (let i = movs.length - 1; i >= 0; i--) {
          if (movs[i].deudapesos && movs[i].deudapesos! > 0) {
            this.asignarDeudaDinamicamente(movs[i].deudapesos!);
            return;
          }
        }
      }

      const resumen = this.googleStore.getResumenPorDia(currentYear);
      if (resumen && resumen.length > 0) {
        for (let i = resumen.length - 1; i >= 0; i--) {
          if (resumen[i].deudaPesos && resumen[i].deudaPesos > 0) {
            this.asignarDeudaDinamicamente(resumen[i].deudaPesos);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error leyendo deuda de googleStore:', e);
    }

    // 2. Fallback de localStorage
    const guardada = localStorage.getItem('app_ultima_deuda_registrada');
    const formulaGuardada = localStorage.getItem('app_ultima_deuda_formula');
    if (guardada) {
      const num = parseFloat(guardada);
      if (!isNaN(num)) {
        this.asignarDeudaDinamicamente(num, formulaGuardada || undefined);
        return;
      }
    }

    // 3. Fallback a la última deuda de la hoja registrada (1047222.41)
    this.asignarDeudaDinamicamente(1047222.41);
  }

  private asignarDeudaDinamicamente(monto: number, formulaPrevia?: string): void {
    this.deuda.set(monto);
    const formulaStr = formulaPrevia || `=${this.formatearNumeroFormula(monto)}`;
    this.deudaTexto.set(formulaStr);
    this.deudaFormula.set(formulaStr);
    const ev = this.evaluarFormula(formulaStr);
    this.deudaDesglose.set(ev.desglose || `Fórmula: ${formulaStr} = ${this.formatearMoneda(monto)}`);
  }

  /**
   * Precarga dinámicamente las cajas de saldos tomando el registro MÁS ACTUAL
   * almacenado en la base de datos para cada entidad / cuenta.
   */
  precargarSaldosDesdeHistorial(movimientos: MovementBackendItem[]): void {
    if (!movimientos || movimientos.length === 0) return;

    // Ordenar de más reciente a más antiguo por fecha y timestamp
    const ordenados = [...movimientos].sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime();
      const fechaB = new Date(b.fecha).getTime();
      if (fechaB !== fechaA) return fechaB - fechaA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });

    const nuevasFilas: DailyRowItem[] = [];

    for (const entDef of this.entidadesPorDefecto) {
      // Buscar el movimiento más actual registrado para esta entidad en la base de datos
      const masActual = ordenados.find(
        (m) => (m.entidad || '').trim().toLowerCase() === entDef.toLowerCase()
      );

      if (masActual) {
        // Extraer si traía una fórmula aritmética guardada en la descripción, ej: [fx: =105,87+58347,86]
        let formulaLimpia: string | undefined = undefined;
        if (masActual.descripcion) {
          const matchFx = masActual.descripcion.match(/\[fx:\s*([^\]]+)\]/);
          if (matchFx && matchFx[1]) {
            formulaLimpia = matchFx[1].startsWith('=') ? matchFx[1] : `=${matchFx[1]}`;
          }
        }

        // Si no tiene fórmula compuesta, se genera '=valor' para que quede precargado y listo para concatenar
        if (!formulaLimpia && masActual.monto !== null && masActual.monto !== undefined) {
          formulaLimpia = `=${this.formatearNumeroFormula(Number(masActual.monto))}`;
        }

        let desglose: string | undefined = undefined;
        let montoFinal = Number(masActual.monto);

        if (formulaLimpia) {
          const ev = this.evaluarFormula(formulaLimpia);
          if (ev.resultado !== null) {
            montoFinal = ev.resultado;
          }
          desglose = ev.desglose;
        }

        nuevasFilas.push({
          id: `row-${Date.now()}-${nuevasFilas.length}`,
          entidad: masActual.entidad || entDef,
          monto: montoFinal,
          montoTexto: formulaLimpia || '',
          formula: formulaLimpia,
          desgloseFormula: desglose,
          descripcion: this.obtenerDescripcionLimpia(masActual) === '-' ? '' : this.obtenerDescripcionLimpia(masActual),
        });
      } else {
        nuevasFilas.push({
          id: `row-${Date.now()}-${nuevasFilas.length}`,
          entidad: entDef,
          monto: null,
          montoTexto: '',
        });
      }
    }

    if (nuevasFilas.length > 0) {
      this.filas.set(nuevasFilas);
    }
  }

  /**
   * Genera las 5 filas iniciales sin valores hardcodeados mientras se consulta la BD.
   */
  private generarFilasPorDefecto(): DailyRowItem[] {
    return this.entidadesPorDefecto.map((entidad, idx) => ({
      id: `row-init-${idx}`,
      entidad,
      monto: null,
      montoTexto: '',
    }));
  }

  /**
   * Obtiene la fecha actual en formato ISO (YYYY-MM-DD).
   */
  private obtenerFechaHoyISO(): string {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Suscripción a eventos Server-Sent Events (SSE) para refresco en tiempo real.
   */
  private suscribirEventosTiempoReal(): void {
    this.sseService.getEvents$().subscribe((msg) => {
      if (msg.event === 'DATA_UPDATED') {
        console.log('⚡ [RegistrarMovimiento] Refresco automático vía SSE');
        this.cargarHistorial(true);
      }
    });
  }

  /**
   * Carga los movimientos almacenados en la base de datos para el año en curso.
   */
  cargarHistorial(silencioso = false): void {
    if (!silencioso) {
      this.isCargandoHistorial.set(true);
    }

    const currentYear = new Date().getFullYear();
    this.movimientosService.listarMovimientos({ year: currentYear }).subscribe({
      next: (data) => {
        this.movimientosGuardados.set(data);
        this.isCargandoHistorial.set(false);

        // Precarga 100% DINÁMICA: toma el registro más actual para cada entidad desde los datos devueltos por la BD
        if (data && data.length > 0) {
          this.precargarSaldosDesdeHistorial(data);
        }
      },
      error: (err) => {
        console.error('Error al cargar historial de movimientos:', err);
        this.isCargandoHistorial.set(false);
      },
    });
  }

  /**
   * Agrega una fila vacía adicional a la tabla de carga.
   */
  agregarFila(): void {
    const nuevaFila: DailyRowItem = {
      id: `row-${Date.now()}`,
      entidad: '',
      monto: null,
      montoTexto: '',
    };
    this.filas.update((actuales) => [...actuales, nuevaFila]);
  }

  /**
   * Quita una fila de la tabla de carga.
   */
  eliminarFila(id: string): void {
    this.filas.update((actuales) => actuales.filter((f) => f.id !== id));
  }

  /**
   * Restablece las filas de carga a los registros más actuales de la BD.
   */
  restablecerFilas(): void {
    this.cargarHistorial(true);
    this.cargarUltimaDeudaRegistrada();
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  // =========================================================================
  // EVALUADOR MATEMÁTICO DE FÓRMULAS DE SUMA / RESTA (ESTILO EXCEL / SHEETS)
  // =========================================================================
  evaluarFormula(texto: string): ResultadoFormula {
    if (!texto || !texto.trim()) {
      return { esFormula: false, resultado: null, formulaLimpia: '', desglose: '' };
    }

    const raw = texto.trim();
    const tieneIgual = raw.startsWith('=');
    const sinIgual = tieneIgual ? raw.substring(1).trim() : raw;

    const contieneOperador = /[+\-]/.test(sinIgual.replace(/^[-+]/, ''));

    if (!tieneIgual && !contieneOperador) {
      const num = this.parseNumeroFlexible(raw);
      return {
        esFormula: false,
        resultado: isNaN(num) ? null : num,
        formulaLimpia: raw,
        desglose: isNaN(num) ? '' : this.formatearMoneda(num),
      };
    }

    try {
      let expr = sinIgual.replace(/[\(\)\s]+/g, '');
      expr = expr.replace(/\+\-/g, '-').replace(/\-\+/g, '-').replace(/\-\-/g, '+').replace(/\+\+/g, '+');

      if (!expr.startsWith('+') && !expr.startsWith('-')) {
        expr = '+' + expr;
      }

      const regex = /([+-])([0-9.,]+)/g;
      let match;
      let suma = 0;
      const componentes: { signo: string; textoNum: string; valor: number }[] = [];
      let matchCount = 0;

      while ((match = regex.exec(expr)) !== null) {
        matchCount++;
        const signo = match[1];
        const strNum = match[2];
        const val = this.parseNumeroFlexible(strNum);

        if (isNaN(val)) {
          throw new Error(`Número inválido: ${strNum}`);
        }

        const valConSigno = signo === '-' ? -val : val;
        suma += valConSigno;
        componentes.push({ signo, textoNum: strNum, valor: valConSigno });
      }

      if (matchCount === 0) {
        return { esFormula: false, resultado: null, formulaLimpia: raw, desglose: '' };
      }

      const resultado = Math.round((suma + Number.EPSILON) * 100) / 100;

      const partesDesglose = componentes.map((c, i) => {
        if (i === 0) {
          return c.signo === '-' ? `-${c.textoNum}` : c.textoNum;
        }
        return `${c.signo} ${c.textoNum}`;
      });

      const formulaPresentable = '=' + partesDesglose.join(' ');
      const desglose = `Fórmula: ${formulaPresentable} = ${this.formatearMoneda(resultado)}`;

      return {
        esFormula: true,
        resultado,
        formulaLimpia: tieneIgual ? raw : `=${raw}`,
        desglose,
      };
    } catch {
      return {
        esFormula: true,
        resultado: null,
        formulaLimpia: raw,
        desglose: 'Error de sintaxis en la fórmula',
      };
    }
  }

  private parseNumeroFlexible(valorStr: string): number {
    if (!valorStr) return NaN;
    let s = valorStr.trim();

    const esNegativo = s.startsWith('-');
    if (esNegativo) {
      s = s.substring(1).trim();
    }

    if (s.includes('.') && s.includes(',')) {
      const ultPunto = s.lastIndexOf('.');
      const ultComa = s.lastIndexOf(',');
      if (ultComa > ultPunto) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }

    const n = parseFloat(s);
    return esNegativo ? -n : n;
  }

  // =========================================================================
  // CONTROL DE EVENTOS EN FILAS DE LA GRILLA (INPUT / FOCUS / BLUR)
  // =========================================================================
  onMontoChange(fila: DailyRowItem, valorTexto: string): void {
    fila.montoTexto = valorTexto;
    const res = this.evaluarFormula(valorTexto);

    if (res.esFormula) {
      fila.formula = res.formulaLimpia;
      fila.desgloseFormula = res.desglose;
      fila.monto = res.resultado;
    } else {
      fila.formula = undefined;
      fila.desgloseFormula = undefined;
      fila.monto = res.resultado;
    }

    this.filas.update((actuales) => [...actuales]);
  }

  onMontoFocus(fila: DailyRowItem): void {
    fila.estaEditando = true;
    if (fila.formula) {
      fila.montoTexto = fila.formula;
    } else if (fila.monto !== null && fila.monto !== undefined) {
      fila.montoTexto = String(fila.monto).replace('.', ',');
    }
  }

  onMontoBlur(fila: DailyRowItem): void {
    fila.estaEditando = false;
    const raw = (fila.montoTexto || '').trim();
    if (!raw) {
      fila.monto = null;
      fila.formula = undefined;
      fila.desgloseFormula = undefined;
      fila.montoTexto = '';
      this.filas.update((actuales) => [...actuales]);
      return;
    }

    const res = this.evaluarFormula(raw);
    if (res.resultado !== null) {
      fila.monto = res.resultado;
      if (res.esFormula) {
        fila.formula = res.formulaLimpia;
        fila.desgloseFormula = res.desglose;
        fila.montoTexto = res.formulaLimpia;
      } else {
        fila.formula = undefined;
        fila.desgloseFormula = undefined;
        fila.montoTexto = this.formatearNumeroFormula(res.resultado);
      }
    }
    this.filas.update((actuales) => [...actuales]);
  }

  obtenerTooltipFila(fila: DailyRowItem): string {
    if (fila.desgloseFormula) {
      return fila.desgloseFormula;
    }
    if (fila.monto !== null && fila.monto !== undefined) {
      return `Saldo: ${this.formatearMoneda(fila.monto)}`;
    }
    return 'Ingresa el saldo del día o fórmula (ej: =105,87+58347,86)';
  }

  // =========================================================================
  // CONTROL DE FÓRMULAS EN EL CAMPO DE DEUDA
  // =========================================================================
  onDeudaChange(valorTexto: string): void {
    this.deudaTexto.set(valorTexto);
    const res = this.evaluarFormula(valorTexto);
    if (res.esFormula) {
      this.deudaFormula.set(res.formulaLimpia);
      this.deudaDesglose.set(res.desglose);
      this.deuda.set(res.resultado);
    } else {
      this.deudaFormula.set(null);
      this.deudaDesglose.set(null);
      this.deuda.set(res.resultado);
    }
  }

  onDeudaFocus(): void {
    this.deudaEditando.set(true);
    if (!this.deudaTexto() && this.deuda() !== null) {
      this.deudaTexto.set(`=${this.formatearNumeroFormula(this.deuda()!)}`);
    }
  }

  onDeudaBlur(): void {
    this.deudaEditando.set(false);
    const raw = (this.deudaTexto() || '').trim();
    if (!raw) {
      this.deuda.set(null);
      this.deudaFormula.set(null);
      this.deudaDesglose.set(null);
      this.deudaTexto.set('');
      return;
    }

    const res = this.evaluarFormula(raw);
    if (res.resultado !== null) {
      this.deuda.set(res.resultado);
      if (res.esFormula) {
        this.deudaFormula.set(res.formulaLimpia);
        this.deudaDesglose.set(res.desglose);
        this.deudaTexto.set(res.formulaLimpia);
      } else {
        this.deudaFormula.set(null);
        this.deudaDesglose.set(`Deuda: ${this.formatearMoneda(res.resultado)}`);
        this.deudaTexto.set(raw.startsWith('=') ? raw : `=${this.formatearNumeroFormula(res.resultado)}`);
      }
    }
  }

  obtenerTooltipDeuda(): string {
    if (this.deudaDesglose()) {
      return this.deudaDesglose()!;
    }
    if (this.deuda() !== null) {
      return `Deuda del día: ${this.formatearMoneda(this.deuda())}`;
    }
    return 'Ingresa la deuda del día o fórmula (ej: =5100000-1000)';
  }

  // =========================================================================
  // TOOLTIPS Y PARSEO DE FÓRMULAS EN EL HISTORIAL ALMACENADO
  // =========================================================================
  tieneFormulaHistorial(m: MovementBackendItem): boolean {
    return !!(m.descripcion && m.descripcion.includes('[fx:'));
  }

  obtenerTooltipHistorial(m: MovementBackendItem): string {
    if (m.descripcion && m.descripcion.includes('[fx:')) {
      const match = m.descripcion.match(/\[fx:\s*([^\]]+)\]/);
      if (match && match[1]) {
        const ev = this.evaluarFormula(match[1]);
        return ev.desglose || `Fórmula: ${match[1]}`;
      }
    }
    return `Saldo: ${this.formatearMoneda(m.monto)}`;
  }

  obtenerDescripcionLimpia(m: MovementBackendItem): string {
    if (!m.descripcion) return '-';
    const limpia = m.descripcion.replace(/\[fx:\s*[^\]]+\]/g, '').trim();
    return limpia || '-';
  }

  /**
   * Guarda los saldos por cuenta ingresados y sincroniza la deuda en la base de datos PostgreSQL.
   */
  guardarMovimientos(): void {
    if (!this.isAdmin()) {
      this.mostrarError('Permiso denegado: solo usuarios con rol Administrador pueden registrar o modificar saldos.');
      return;
    }

    const fecha = this.fechaSeleccionada();
    if (!fecha) {
      this.mostrarError('Por favor selecciona una fecha válida.');
      return;
    }

    const movimientosValidos = this.filas().filter(
      (f) => f.entidad.trim() !== '' && typeof f.monto === 'number' && !isNaN(f.monto),
    );

    if (movimientosValidos.length === 0 && (this.deuda() === null || this.deuda() === undefined)) {
      this.mostrarError('Ingresa al menos un saldo de cuenta o la deuda del día.');
      return;
    }

    this.isGuardando.set(true);
    this.mensajeExito.set(null);
    this.mensajeError.set(null);

    const payload = {
      fecha,
      deuda: this.deuda() !== null ? Number(this.deuda()) : undefined,
      movimientos: movimientosValidos.map((m) => {
        let desc = m.descripcion?.trim() || '';
        if (m.formula) {
          desc = desc ? `${desc} [fx: ${m.formula}]` : `[fx: ${m.formula}]`;
        }
        const saldoNum = Number(m.monto);
        return {
          entidad: m.entidad.trim(),
          monto: saldoNum,
          tipo: saldoNum >= 0 ? 'INGRESO' : 'GASTO',
          categoria: 'Saldos Diarios',
          descripcion: desc || `Saldo diario (${m.entidad.trim()})`,
        };
      }),
    };

    this.movimientosService.crearLoteMovimientos(payload).subscribe({
      next: () => {
        this.isGuardando.set(false);
        if (this.deuda() !== null) {
          const fCorta = this.normalizarClaveFecha(this.formatearFechaCorta(fecha));
          const numDeuda = Number(this.deuda()!);
          this.deudasLocalesPorFecha.update((mapa) => ({
            ...mapa,
            [fCorta]: numDeuda,
          }));
          localStorage.setItem('app_ultima_deuda_registrada', String(numDeuda));
          if (this.deudaFormula()) {
            localStorage.setItem('app_ultima_deuda_formula', this.deudaFormula()!);
          }
        }
        this.mostrarExito(
          `¡Saldos guardados exitosamente para el día ${this.formatearFechaCorta(fecha)}!`,
        );
        this.cargarHistorial(true);
      },
      error: (err) => {
        this.isGuardando.set(false);
        const detalle = err?.error?.message || 'Ocurrió un error al guardar los saldos.';
        this.mostrarError(detalle);
      },
    });
  }

  /**
   * Elimina un movimiento registrado previamente en la base de datos.
   */
  eliminarMovimientoRegistrado(id: string): void {
    if (!this.isAdmin()) {
      this.mostrarError('Permiso denegado: solo usuarios con rol Administrador pueden eliminar movimientos.');
      return;
    }

    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;

    this.movimientosService.eliminarMovimiento(id).subscribe({
      next: () => {
        this.mostrarExito('Registro eliminado con éxito.');
        this.cargarHistorial(true);
      },
      error: (err) => {
        console.error('Error al eliminar registro:', err);
        this.mostrarError('No se pudo eliminar el registro.');
      },
    });
  }

  /**
   * Manejador del cambio de página de Angular Material.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /**
   * Limpia los filtros aplicados al historial de movimientos.
   */
  limpiarFiltros(): void {
    this.filtroFechaDesde.set('');
    this.filtroFechaHasta.set('');
    this.filtroTexto.set('');
    this.pageIndex.set(0);
  }

  /**
   * Establece un filtro rápido de fechas (hoy, últimos 7 días o este mes).
   */
  aplicarFiltroRapido(opcion: 'hoy' | 'ultimos7' | 'esteMes'): void {
    const hoy = new Date();
    const hoyISO = this.obtenerFechaHoyISO();

    if (opcion === 'hoy') {
      this.filtroFechaDesde.set(hoyISO);
      this.filtroFechaHasta.set(hoyISO);
    } else if (opcion === 'ultimos7') {
      const hace7Dias = new Date();
      hace7Dias.setDate(hoy.getDate() - 7);
      this.filtroFechaDesde.set(hace7Dias.toISOString().substring(0, 10));
      this.filtroFechaHasta.set(hoyISO);
    } else if (opcion === 'esteMes') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.filtroFechaDesde.set(primerDia.toISOString().substring(0, 10));
      this.filtroFechaHasta.set(hoyISO);
    }

    this.pageIndex.set(0);
  }

  // Utilidades de formato
  formatearMoneda(monto: number | null | undefined): string {
    if (monto === null || monto === undefined || isNaN(monto)) return '$0,00';
    return (
      '$' +
      monto.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  formatearNumeroSimple(val: number): string {
    return val.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatearNumeroFormula(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '0';
    if (val % 1 === 0) {
      return String(val);
    }
    return val.toFixed(2).replace('.', ',');
  }

  /**
   * Formatea una fecha a DD/MM/AAAA de forma infalible, evitando NaN/NaN/NaN.
   */
  formatearFechaCorta(fecha: string | Date | null | undefined): string {
    if (!fecha) return '';
    if (typeof fecha === 'string') {
      const matchIso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchIso) {
        const [, anio, mes, dia] = matchIso;
        return `${dia}/${mes}/${anio}`;
      }
      const matchArg = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (matchArg) {
        return fecha;
      }
    }
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    const anio = d.getUTCFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  private mostrarExito(mensaje: string): void {
    this.mensajeExito.set(mensaje);
    setTimeout(() => this.mensajeExito.set(null), 6000);
  }

  private mostrarError(mensaje: string): void {
    this.mensajeError.set(mensaje);
    setTimeout(() => this.mensajeError.set(null), 8000);
  }
}
