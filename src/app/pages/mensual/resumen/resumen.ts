import {
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  PLATFORM_ID,
  signal,
  SimpleChanges,
} from '@angular/core';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

import { AppConfigService } from '../../../services/app-config.service';
import { MensualItemsService } from '../../../services/mensual-items.service';
import { EntityPaymentService, EntityPayment } from '../../../services/entity-payment.service';
import { firstValueFrom } from 'rxjs';
import { ProyeccionOverlayService } from '../../../services/proyeccion-overlay.service';

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CurrencyPipe, MatProgressSpinnerModule, MatCardModule, CommonModule],
  templateUrl: './resumen.html',
  styleUrl: './resumen.scss',
  providers: [CurrencyPipe],
})
export class Resumen implements OnInit, OnChanges {
  public overlayService = inject(ProyeccionOverlayService);
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() meses: string[] = [];

  @Input() mesSeleccionado = '';
  @Input() anioSeleccionado = 2025;

  resumen: Record<string, Record<string, number>> = {};
  //entidades: (keyof typeof RANGOS_ENTIDADES_2022)[] = Object.keys(RANGOS_ENTIDADES_2022) as (keyof typeof RANGOS_ENTIDADES_2022)[];
  entidades: string[] = [];
  mesesResumen: string[] = [];
  totales: { mes: string; total: number }[] = [];
  subOtrosNombres = new Map<string, string>();
  columnasValidasInfo: { mes: string; anio: number }[] = [];

  isCargando = signal(false);
  isBrowser = false;
  private appConfig = inject(AppConfigService);
  private mensualItemsService = inject(MensualItemsService);
  private paymentService = inject(EntityPaymentService);
  private store = inject(MovimientosStoreGoogle);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private cacheResumenPorMesAnio = new Map<string, boolean>();

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.isBrowser) return;
    if (changes['mesSeleccionado'] || changes['anioSeleccionado']) {
      this.cargarTotales();
    }
  }

  async ngOnInit() {
    if (this.isBrowser) await this.cargarTotales();
  }

  private keyMesAnio(mes: string, anio: number): string {
    return `${anio}::${mes}`;
  }

  private normalizar(texto: string | undefined): string {
    return texto?.toLowerCase().replace(/\s+/g, '').replace(/_/g, '') ?? '';
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    const limpio = String(valor)
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/\s+/g, '');
    return Number(limpio) || 0;
  }

  private async asegurarMesesParaResumen(meses: string[], anio: number) {
    for (const mes of meses) {
      const hoja = this.store.getMensualPorMes(anio, mes);
      //console.log(`🔍 Verificando hoja "${mes}" para año ${anio} → existe: ${!!hoja}`);

      if (!hoja) {
        await this.store.asegurarMensualPorAnio(anio, mes, 'Resumen');
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  async cargarTotales() {
    if (!this.isBrowser || !this.mesSeleccionado) return;

    this.isCargando.set(true);

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const index = mesesNombres.indexOf(this.mesSeleccionado);
    if (index === -1) {
      this.isCargando.set(false);
      return;
    }

    // 1. Armar candidatos para la ventana de hasta 6 meses (1 previo si existe, actual, y posteriores cruzando al año siguiente)
    const candidatos: { mes: string; anio: number }[] = [];
    if (index > 0) {
      candidatos.push({ mes: mesesNombres[index - 1], anio: this.anioSeleccionado });
    }
    candidatos.push({ mes: mesesNombres[index], anio: this.anioSeleccionado });

    for (let offset = 1; candidatos.length < 6; offset++) {
      const nextIdx = index + offset;
      if (nextIdx < 12) {
        candidatos.push({ mes: mesesNombres[nextIdx], anio: this.anioSeleccionado });
      } else {
        const nextAnioIdx = nextIdx - 12;
        if (nextAnioIdx < 12) {
          candidatos.push({ mes: mesesNombres[nextAnioIdx], anio: this.anioSeleccionado + 1 });
        } else {
          break;
        }
      }
    }

    // 2. Pre-cargar datos de BD para los años involucrados que estén en modo BD
    const aniosConsultar = Array.from(new Set(candidatos.map((c) => c.anio)));
    const itemsBDMap = new Map<number, any[]>();
    for (const anio of aniosConsultar) {
      if (!this.appConfig.isSheetsActivo(anio)) {
        try {
          const res = await firstValueFrom(this.mensualItemsService.getItems(anio));
          itemsBDMap.set(anio, res?.items || []);
        } catch {
          itemsBDMap.set(anio, []);
        }
      }
    }

    // 3. Determinar columnas válidas verificando disponibilidad real en su respectivo origen
    const columnasValidas: { mes: string; anio: number }[] = [];
    for (const c of candidatos) {
      if (c.anio === this.anioSeleccionado) {
        if (this.appConfig.isSheetsActivo(c.anio)) {
          await this.store.asegurarMensualPorAnio(c.anio, c.mes, "Resumen");
        }
        columnasValidas.push(c);
      } else {
        // Meses de año posterior: verificar según su origen configurado
        if (this.appConfig.isSheetsActivo(c.anio)) {
          try {
            await this.store.asegurarMensualPorAnio(c.anio, c.mes, "Resumen");
            const hoja = this.store.getMensualPorMes(c.anio, c.mes);
            if (hoja?.values && hoja.values.length > 0) {
              columnasValidas.push(c);
            } else {
              break;
            }
          } catch {
            break;
          }
        } else {
          // Año configurado en modo BD (ej: 2027)
          const mesNum = mesesNombres.indexOf(c.mes) + 1;
          const itemsDelAnio = itemsBDMap.get(c.anio) || [];
          const tieneItems = itemsDelAnio.some((it) => it.mes === mesNum);
          if (tieneItems) {
            columnasValidas.push(c);
          } else {
            break;
          }
        }
      }
    }

    this.columnasValidasInfo = [...columnasValidas];

    // Pre-cargar intenciones de pago / pagos para columnas en modo BD
    const pagosBDMap = new Map<string, EntityPayment[]>();
    for (const c of columnasValidas) {
      if (!this.appConfig.isSheetsActivo(c.anio)) {
        const mesNum = mesesNombres.indexOf(c.mes) + 1;
        const key = `${c.anio}::${mesNum}`;
        try {
          const pRes = await firstValueFrom(this.paymentService.getPayments(c.anio, mesNum));
          pagosBDMap.set(key, pRes?.data || []);
        } catch {
          pagosBDMap.set(key, []);
        }
      }
    }

    // 4. Mapeo de entidades para BD
    const entidadMap: Record<string, string[]> = {
      visa: ["visa", "visa galicia"],
      mastercard: ["mastercard", "master card", "master card galicia"],
      naranja: ["naranja", "naranja x"],
      bancor: ["bancor"],
      ml: ["ml", "mercado libre", "mercado libre / pago", "mercado pago", "mercadopago"]
    };

    // 5. Detectar sub-conceptos de "otros" en todas las columnas válidas (Sheets y BD)
    this.subOtrosNombres.clear();
    const subOtrosKeys: string[] = [];

    for (const col of columnasValidas) {
      if (this.appConfig.isSheetsActivo(col.anio)) {
        const rangosCol = this.store.ValidarRangoEntidades(col.anio);
        if (rangosCol["otros"]) {
          const { inicio, fin } = rangosCol["otros"];
          const hoja = this.store.getMensualPorMes(col.anio, col.mes);
          if (hoja?.values) {
            for (let i = inicio; i <= fin && i < hoja.values.length; i++) {
              const fila = hoja.values[i];
              const desc = fila?.[0]?.trim();
              if (
                desc &&
                !desc.toLowerCase().startsWith("total")
              ) {
                const key = "otros_" + desc.toLowerCase();
                if (!subOtrosKeys.includes(key)) {
                  subOtrosKeys.push(key);
                  this.subOtrosNombres.set(key, desc);
                }
              }
            }
          }
        }
      } else {
        const mesNum = mesesNombres.indexOf(col.mes) + 1;
        const items = itemsBDMap.get(col.anio) || [];
        for (const it of items) {
          if (
            it.mes === mesNum &&
            it.entidad?.toLowerCase() === "otros" &&
            it.concepto &&
            !it.concepto.startsWith("=")
          ) {
            const baseConcepto = it.concepto.replace(/\s*\d+\/\d+.*$/, "").trim();
            const key = "otros_" + baseConcepto.toLowerCase();
            if (!subOtrosKeys.includes(key)) {
              subOtrosKeys.push(key);
              this.subOtrosNombres.set(key, baseConcepto);
            }
          }
        }
      }
    }

    // Asegurar que Compensaciones quede al final de los sub-conceptos de Otros si está presente
    const compIdx = subOtrosKeys.findIndex(
      (k) => k === 'otros_compensaciones' || k.toLowerCase().includes('compensa')
    );
    if (compIdx !== -1 && compIdx !== subOtrosKeys.length - 1) {
      const compKey = subOtrosKeys.splice(compIdx, 1)[0];
      subOtrosKeys.push(compKey);
    }

    // 6. Configurar lista de entidades según orden canónico idéntico a las tarjetas de la izquierda:
    // 1. Visa, 2. Mastercard, 3. Naranja, 4. Bancor, 5. Mercado Libre, 6. Otros (subconceptos)
    const ORDEN_CANONICO_ENTIDADES = ['visa', 'mastercard', 'naranja', 'bancor', 'ml', 'otros'];
    const rangosBase = this.store.ValidarRangoEntidades(this.anioSeleccionado) || {};
    const entidadesBaseKeys = Object.keys(rangosBase);

    const entidadesConfig = (entidadesBaseKeys.length > 0 ? entidadesBaseKeys : ORDEN_CANONICO_ENTIDADES)
      .slice()
      .sort((a, b) => {
        const idxA = ORDEN_CANONICO_ENTIDADES.indexOf(a.toLowerCase());
        const idxB = ORDEN_CANONICO_ENTIDADES.indexOf(b.toLowerCase());
        const posA = idxA === -1 ? 999 : idxA;
        const posB = idxB === -1 ? 999 : idxB;
        if (posA !== posB) return posA - posB;
        return a.localeCompare(b);
      });

    const listaEntidades: string[] = [];
    for (const ent of entidadesConfig) {
      if (ent.toLowerCase() === 'otros') {
        listaEntidades.push(...subOtrosKeys);
      } else {
        listaEntidades.push(ent);
      }
    }
    this.entidades = listaEntidades;

    // 7. Inicializar matriz de resumen
    this.resumen = {};
    for (const ent of this.entidades) {
      this.resumen[ent] = {};
      for (const col of columnasValidas) {
        this.resumen[ent][col.mes] = 0;
      }
    }

    // 8. Cargar importes para cada columna y entidad
    for (const col of columnasValidas) {
      if (this.appConfig.isSheetsActivo(col.anio)) {
        const rangosCol = this.store.ValidarRangoEntidades(col.anio);
        const hoja = this.store.getMensualPorMes(col.anio, col.mes);
        if (!hoja?.values) continue;

        for (const entidad of entidadesConfig) {
          if (!rangosCol[entidad]) continue;
          const { inicio, fin, headerIndex } = rangosCol[entidad];

          if (entidad === "otros") {
            for (let i = inicio; i <= fin && i < hoja.values.length; i++) {
              const fila = hoja.values[i];
              const desc = fila?.[0]?.trim();
              if (desc) {
                const key = "otros_" + desc.toLowerCase();
                const monto = fila?.[1];
                const valor = monto ? this.parseMoneda(monto) : 0;
                if (this.resumen[key]) {
                  this.resumen[key][col.mes] = (this.resumen[key][col.mes] ?? 0) + valor;
                }
              }
            }
          } else {
            const headers = hoja.values[headerIndex] ?? [];
            let colIndex = headers.findIndex((h) =>
              this.normalizar(col.mes).includes(this.normalizar(h)),
            );
            if (colIndex === -1 && headers.length > 1 && headers[1]) {
              colIndex = 1;
            }
            if (colIndex === -1) continue;

            let total = 0;
            for (let i = inicio; i <= fin && i < hoja.values.length; i++) {
              const fila = hoja.values[i];
              const monto = fila?.[colIndex];
              if (monto) total += this.parseMoneda(monto);
            }
            if (this.resumen[entidad]) {
              this.resumen[entidad][col.mes] = total;
            }
          }
        }
      } else {
        // Origen BD (PostgreSQL)
        const mesNum = mesesNombres.indexOf(col.mes) + 1;
        const keyPago = `${col.anio}::${mesNum}`;
        const pagos = pagosBDMap.get(keyPago) || [];
        const items = (itemsBDMap.get(col.anio) || []).filter((it) => it.mes === mesNum);

        let totalFaltaPagarEntidades = 0;

        // 1. Entidades financieras oficiales
        for (const [keyOficial, aliases] of Object.entries(entidadMap)) {
          let totalItemsEntidad = 0;
          for (const it of items) {
            const entLower = it.entidad?.toLowerCase().trim() || "";
            if (entLower === "otros" || entLower === "reembolsables") continue;
            if (aliases.includes(entLower) || aliases.some((a) => entLower.includes(a))) {
              totalItemsEntidad += Number(it.monto) || 0;
            }
          }

          // Buscar si existe intención de pago o pago registrado
          const pago = pagos.find((p) => {
            const pEnt = (p.entidad || "").toLowerCase().trim();
            return (
              (!p.itemId || p.itemId === "") &&
              aliases.some((a) => pEnt.includes(a) || a.includes(pEnt))
            );
          });

          let montoFinalEntidad = totalItemsEntidad;
          if (pago && pago.montoPagado !== undefined && pago.montoPagado !== null && Number(pago.montoPagado) >= 0 && (pago.estado === 'PARCIAL' || pago.montoRestante !== undefined)) {
            montoFinalEntidad = Number(pago.montoPagado);
            totalFaltaPagarEntidades += Math.max(0, totalItemsEntidad - montoFinalEntidad);
          } else {
            // Si no está cargada esa intención de pago se asume que se paga la entidad en su totalidad
            montoFinalEntidad = totalItemsEntidad;
          }

          if (this.resumen[keyOficial] && this.resumen[keyOficial][col.mes] !== undefined) {
            this.resumen[keyOficial][col.mes] = montoFinalEntidad;
          }
        }

        // 2. Sub-conceptos de Otros
        let compItemsMonto = 0;

        for (const it of items) {
          const entLower = it.entidad?.toLowerCase().trim() || "";
          if (entLower !== "otros") continue;
          if (!it.concepto || it.concepto.startsWith("=")) continue;

          const baseConcepto = it.concepto.replace(/\s*\d+\/\d+.*$/, "").trim();
          const keyOtros = "otros_" + baseConcepto.toLowerCase();
          const montoNum = Number(it.monto) || 0;

          if (keyOtros === "otros_compensaciones" || baseConcepto.toLowerCase().includes("compensa")) {
            compItemsMonto += montoNum;
          } else {
            const pagoItem = pagos.find((p) => p.itemId === it.id);
            let montoFinalItem = montoNum;
            if (pagoItem && pagoItem.montoPagado !== undefined && pagoItem.montoPagado !== null) {
              montoFinalItem = Number(pagoItem.montoPagado);
              totalFaltaPagarEntidades += Math.max(0, montoNum - montoFinalItem);
            }

            if (this.resumen[keyOtros] && this.resumen[keyOtros][col.mes] !== undefined) {
              this.resumen[keyOtros][col.mes] += montoFinalItem;
            }
          }
        }

        // 3. Compensaciones (refleja lo que faltará o faltó para llegar al total)
        if (this.resumen["otros_compensaciones"] && this.resumen["otros_compensaciones"][col.mes] !== undefined) {
          let compensacionFinal = compItemsMonto;
          if (totalFaltaPagarEntidades > 0) {
            compensacionFinal -= totalFaltaPagarEntidades;
          }
          this.resumen["otros_compensaciones"][col.mes] = compensacionFinal;
        }
      }
    }

    this.meses = columnasValidas.map((c) => c.mes);
    this.isCargando.set(false);
    this.cdr.detectChanges();
  }
  getNombreEntidad(entidad: string): string {
    if (entidad.startsWith('otros_')) {
      return this.subOtrosNombres.get(entidad) ?? entidad.replace('otros_', '');
    }
    if (entidad === 'ml') return 'Mercado Libre';
    return entidad.charAt(0).toUpperCase() + entidad.slice(1);
  }

  getEntidadClass(entidad: string): string {
    if (entidad.startsWith('otros_')) {
      return 'entidad-otros';
    }
    return `entidad-${entidad.toLowerCase()}`;
  }

  getTotal(entidad: string, mes: string): number {
    return this.resumen[entidad]?.[mes] ?? 0;
  }

  isColumnaBD(mes: string): boolean {
    const col = this.columnasValidasInfo.find((c) => c.mes === mes);
    if (!col) return false;
    return !this.appConfig.isSheetsActivo(col.anio);
  }

  getTotalPorMes(mes: string): number {
    const esBD = this.isColumnaBD(mes);
    return this.entidades.reduce((acc, entidad) => {
      // Para datos desde BD, compensaciones se muestra en la tabla pero no computa en el total a pagar
      if (esBD && (entidad === 'otros_compensaciones' || entidad.toLowerCase().includes('compensa'))) {
        return acc;
      }
      return acc + (this.resumen[entidad]?.[mes] ?? 0);
    }, 0);
  }

  getLogoEntidad(entidad: string): string {
    const key = entidad.toLowerCase().trim();
    if (key === 'visa') return 'assets/logos/visa.png';
    if (key === 'mastercard') return 'assets/logos/mastercard.svg';
    if (key === 'naranja') return 'assets/logos/naranja.png';
    if (key === 'bancor') return 'assets/logos/bancor.png';
    if (key === 'ml') return 'assets/logos/mercadopago.png';
    return '';
  }

  onHoverEntidad(event: MouseEvent, entidad: string): void {
    const key = entidad.startsWith('otros_') ? 'otros' : entidad;
    const nombre = this.getNombreEntidad(entidad);
    const logo = this.getLogoEntidad(entidad);

    this.overlayService.mostrarTooltipTotal(
      event,
      key,
      nombre,
      this.anioSeleccionado,
      this.mesSeleccionado,
      logo,
    );
  }

  onLeaveEntidad(): void {
    this.overlayService.ocultarTooltip();
  }

  abrirModalEntidad(entidad: string): void {
    const key = entidad.startsWith('otros_') ? 'otros' : entidad;
    const nombre = this.getNombreEntidad(entidad);
    const logo = this.getLogoEntidad(entidad);

    this.overlayService.abrirModalCompleto(
      key,
      nombre,
      this.anioSeleccionado,
      this.mesSeleccionado,
      logo,
    );
  }

  async runWithConcurrency<T>(tasks: (() => Promise<T>)[], maxConcurrent: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<unknown>[] = [];

    for (const task of tasks) {
      const p = task().then((r) => results.push(r as T));
      executing.push(p);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((e) => e === p),
          1,
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}
