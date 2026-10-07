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

  isCargando = signal(false);
  isBrowser = false;
  private appConfig = inject(AppConfigService);
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
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '')) || 0;
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

    if (!this.appConfig.isSheetsActivo(this.anioSeleccionado)) {
      this.entidades = [];
      this.resumen = {};
      this.totales = [];
      this.meses = [];
      this.mesesResumen = [];
      this.isCargando.set(false);
      this.cdr.detectChanges();
      return;
    }

    console.log(
      `✅ Incia método cargarTotales() mes = ${this.mesSeleccionado} año = ${this.anioSeleccionado}`,
    );
    const cacheKey = this.keyMesAnio(this.mesSeleccionado, this.anioSeleccionado);
    //if (this.cacheResumenPorMesAnio.get(cacheKey)) return;
    if (this.cacheResumenPorMesAnio.get(cacheKey)) {
      console.warn(`⚠️ Cache activa para ${cacheKey}, pero se fuerza recalculo `);
      this.resumen = {};
    }
    this.isCargando.set(true);

    const mesesDelAnio = this.store.getMesesParaResumen(this.anioSeleccionado);
    const index = mesesDelAnio.indexOf(this.mesSeleccionado);
    //const index = todosLosMeses.indexOf(this.mesSeleccionado);
    //console.log(`index ${index} --> todosLosMeses ${JSON.stringify(todosLosMeses)}`)
    const anterioresYPosteriores: string[] = [];

    if (index > 0) anterioresYPosteriores.push(mesesDelAnio[index - 1]);
    anterioresYPosteriores.push(mesesDelAnio[index]);

    for (let i = 1; anterioresYPosteriores.length < 6 && index + i < mesesDelAnio.length; i++) {
      anterioresYPosteriores.push(mesesDelAnio[index + i]);
    }
    //console.log(`anterioresYPosteriores ${JSON.stringify(anterioresYPosteriores)} --> anio ${JSON.stringify(this.anioSeleccionado)}`)
    await this.asegurarMesesParaResumen(anterioresYPosteriores, this.anioSeleccionado);
    this.subOtrosNombres.clear();
    const rangos = this.store.ValidarRangoEntidades(this.anioSeleccionado);

    // Obtener las sub-entidades de 'otros' de los meses cargados
    const subOtrosKeys: string[] = [];
    if (rangos['otros']) {
      const { inicio, fin } = rangos['otros'];
      for (const mes of anterioresYPosteriores) {
        const hoja = this.store.getMensualPorMes(this.anioSeleccionado, mes);
        if (hoja?.values) {
          for (let i = inicio; i <= fin; i++) {
            const fila = hoja.values[i];
            const desc = fila?.[0]?.trim();
            if (desc) {
              const key = 'otros_' + desc.toLowerCase();
              if (!subOtrosKeys.includes(key)) {
                subOtrosKeys.push(key);
                this.subOtrosNombres.set(key, desc);
              }
            }
          }
        }
      }
    }

    const entidadesConfig = Object.keys(rangos);
    const listaEntidades: string[] = [];
    for (const ent of entidadesConfig) {
      if (ent === 'otros') {
        listaEntidades.push(...subOtrosKeys);
      } else {
        listaEntidades.push(ent);
      }
    }
    this.entidades = listaEntidades;

    this.resumen = {};
    for (const ent of this.entidades) {
      this.resumen[ent] = {};
      for (const mes of anterioresYPosteriores) {
        this.resumen[ent][mes] = 0;
      }
    }

    for (const entidad of entidadesConfig) {
      const { inicio, fin, headerIndex } = rangos[entidad];

      for (const mes of anterioresYPosteriores) {
        const hoja = this.store.getMensualPorMes(this.anioSeleccionado, mes);
        if (!hoja?.values) continue;

        if (entidad === 'otros') {
          for (let i = inicio; i <= fin; i++) {
            const fila = hoja.values[i];
            const desc = fila?.[0]?.trim();
            if (desc) {
              const key = 'otros_' + desc.toLowerCase();
              const monto = fila?.[1];
              const valor = monto ? this.parseMoneda(monto) : 0;
              this.resumen[key][mes] = (this.resumen[key][mes] ?? 0) + valor;
            }
          }
        } else {
          const headers = hoja.values[headerIndex] ?? [];
          const colIndex = headers.findIndex((h) =>
            this.normalizar(mes).includes(this.normalizar(h)),
          );
          if (colIndex === -1) continue;

          let total = 0;
          for (let i = inicio; i <= fin; i++) {
            const fila = hoja.values[i];
            const monto = fila?.[colIndex];
            if (monto) total += this.parseMoneda(monto);
          }
          this.resumen[entidad][mes] = total;
        }
      }
    }

    this.meses = anterioresYPosteriores;
    this.cacheResumenPorMesAnio.set(cacheKey, true);
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

  getTotalPorMes(mes: string): number {
    return this.entidades.reduce((acc, entidad) => acc + (this.resumen[entidad]?.[mes] ?? 0), 0);
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
