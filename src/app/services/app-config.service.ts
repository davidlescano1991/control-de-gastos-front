import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { setFeriadosDesdeServidor } from '../utils/feriados.utils';
import { environment } from '../config/environment';

export interface EntityRange {
  inicio: number;
  fin: number;
  headerIndex: number;
}

interface YearsConfig {
  anios?: number[];
}

interface AppConfig {
  rangosEntidadesPorAnio?: Record<string, Record<string, EntityRange>>;
  mesesExtraPorAnio?: Record<string, string[]>;
  filasTablaAnualPorAnio?: Record<string, number>;
  coloresEntidades?: Record<string, string>;
  celdaIngresoNeto?: string;
  celdaIngresoNetoPorAnio?: Record<string, string>;
  origenPorAnio?: Record<string, { activo: boolean; descripcion: string | null }>;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig = {};
  private aniosInicio: number[] = [2026, 2025, 2024, 2023];
  private aniosEstimativos: number[] = [2026, 2025, 2024, 2023];
  private aniosMensual: number[] = [2026, 2025, 2024, 2023, 2022];
  private aniosAnual: number[] = [2026, 2025, 2024, 2023, 2022];
  private http = inject(HttpClient);

  async load(): Promise<void> {
    const baseHref =
      typeof document !== 'undefined'
        ? document.querySelector('base')?.getAttribute('href') || '/'
        : '/';
    const prefix = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    const urlFeriados = `${prefix}assets/feriados.json`;

    // 1. Intentamos cargar feriados
    firstValueFrom(this.http.get<{ feriados?: Record<string, string> }>(urlFeriados))
      .then((feriadosData) => {
        if (feriadosData) setFeriadosDesdeServidor(feriadosData);
      })
      .catch((err) => console.warn('Feriados load failed, using defaults', err));

    // 2. Intentamos primero obtener la configuración dinámica en vivo desde la API
    try {
      const apiRes = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/sheets-config/runtime-config`)
      );

      if (apiRes && apiRes.data) {
        this.aplicarDatosRuntime(apiRes.data);
        console.log('⚡ AppConfig cargado dinámicamente desde la API');
        return;
      }
    } catch (e) {
      console.warn('⚠️ No se pudo cargar config desde API, usando archivos locales de respaldo...', e);
    }

    // 3. Respaldo (Fallback) con los JSON estáticos de assets/
    await this.cargarDesdeAssetsLocales(prefix);
  }

  /**
   * Recarga la configuración directamente desde la API en caliente.
   * Utilizado cuando el Administrador crea, edita o elimina una hoja en la UI.
   */
  async reloadFromApi(): Promise<void> {
    try {
      const apiRes = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/sheets-config/runtime-config`)
      );
      if (apiRes && apiRes.data) {
        this.aplicarDatosRuntime(apiRes.data);
        console.log('⚡ AppConfig recargado exitosamente desde la API');
      }
    } catch (e) {
      console.error('Error al recargar AppConfig desde API:', e);
    }
  }

  private aplicarDatosRuntime(data: any): void {
    if (Array.isArray(data.aniosInicio)) this.aniosInicio = data.aniosInicio;
    if (Array.isArray(data.aniosEstimativos)) this.aniosEstimativos = data.aniosEstimativos;
    if (Array.isArray(data.aniosMensual)) this.aniosMensual = data.aniosMensual;
    if (Array.isArray(data.aniosAnual)) this.aniosAnual = data.aniosAnual;

    this.config = {
      rangosEntidadesPorAnio: data.rangosEntidadesPorAnio || {},
      mesesExtraPorAnio: data.mesesExtraPorAnio || {},
      filasTablaAnualPorAnio: data.filasTablaAnualPorAnio || {},
      celdaIngresoNetoPorAnio: data.celdaIngresoNetoPorAnio || {},
      coloresEntidades: data.coloresEntidades || this.coloresEntidades,
      origenPorAnio: data.origenPorAnio || {},
    };

    this.aplicarColoresEntidadesCSS();
  }

  private async cargarDesdeAssetsLocales(prefix: string): Promise<void> {
    const urlConfig = `${prefix}assets/years-and-ranges.json`;
    const urlInicio = `${prefix}assets/years-inicio.json`;
    const urlEstimativos = `${prefix}assets/years-estimativos.json`;
    const urlMensual = `${prefix}assets/years-mensual.json`;
    const urlAnual = `${prefix}assets/years-anual.json`;

    try {
      const [cfg, inicioData, estimativosData, mensualData, anualData] = await Promise.all([
        firstValueFrom(this.http.get<AppConfig>(urlConfig)).catch(() => ({} as AppConfig)),
        firstValueFrom(this.http.get<YearsConfig>(urlInicio)).catch(() => null),
        firstValueFrom(this.http.get<YearsConfig>(urlEstimativos)).catch(() => null),
        firstValueFrom(this.http.get<YearsConfig>(urlMensual)).catch(() => null),
        firstValueFrom(this.http.get<YearsConfig>(urlAnual)).catch(() => null),
      ]);

      this.config = cfg || {};
      if (inicioData?.anios && Array.isArray(inicioData.anios)) {
        this.aniosInicio = inicioData.anios.map(Number).filter((n) => !Number.isNaN(n));
      }
      if (estimativosData?.anios && Array.isArray(estimativosData.anios)) {
        this.aniosEstimativos = estimativosData.anios.map(Number).filter((n) => !Number.isNaN(n));
      }
      if (mensualData?.anios && Array.isArray(mensualData.anios)) {
        this.aniosMensual = mensualData.anios.map(Number).filter((n) => !Number.isNaN(n));
      }
      if (anualData?.anios && Array.isArray(anualData.anios)) {
        this.aniosAnual = anualData.anios.map(Number).filter((n) => !Number.isNaN(n));
      }

      this.aplicarColoresEntidadesCSS();
      console.log('AppConfig cargado exitosamente desde assets locales');
    } catch (err) {
      console.warn('Error general al cargar configuración desde assets locales', err);
      this.config = {};
      this.aplicarColoresEntidadesCSS();
    }
  }

  get yearsInicio(): number[] {
    return this.aniosInicio;
  }

  get yearsEstimativos(): number[] {
    return this.aniosEstimativos;
  }

  get yearsMensual(): number[] {
    return this.aniosMensual;
  }

  get yearsAnual(): number[] {
    return this.aniosAnual;
  }

  getYearsForScreen(screen: 'inicio' | 'estimativos' | 'mensual' | 'anual'): number[] {
    switch (screen) {
      case 'inicio':
        return this.yearsInicio;
      case 'estimativos':
        return this.yearsEstimativos;
      case 'mensual':
        return this.yearsMensual;
      case 'anual':
        return this.yearsAnual;
      default:
        return this.yearsMensual;
    }
  }

  get years(): number[] {
    return this.aniosMensual;
  }

  getEntityRangesForYear(anio: number): Record<string, EntityRange> | null {
    return this.config?.rangosEntidadesPorAnio?.[String(anio)] ?? null;
  }

  getExtraMonthsForYear(anio: number): string[] {
    const val = this.config?.mesesExtraPorAnio?.[String(anio)];
    return Array.isArray(val) ? val : [];
  }

  getMesesForYear(anio: number, base: string[]): string[] {
    const extra = this.getExtraMonthsForYear(anio);
    return extra.length ? [...base, ...extra] : base;
  }

  getFilasTablaAnualForYear(anio: number): number | null {
    const val = this.config?.filasTablaAnualPorAnio?.[String(anio)];
    return typeof val === 'number' ? val : null;
  }

  getCeldaIngresoNetoForYear(anio: number): string {
    return (
      this.config?.celdaIngresoNetoPorAnio?.[String(anio)] ||
      this.config?.celdaIngresoNeto ||
      'K21'
    );
  }

  get coloresEntidades(): Record<string, string> {
    return (
      this.config?.coloresEntidades || {
        visa: '#768699',
        mastercard: '#768699',
        naranja: '#ff8104',
        bancor: '#005f5a',
        otros: '#c10090',
        ml: '#ffe600',
      }
    );
  }

  aplicarColoresEntidadesCSS(): void {
    const colores = this.coloresEntidades;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      Object.entries(colores).forEach(([key, color]) => {
        root.style.setProperty(`--color-entidad-${key}`, color);
      });
    }
  }

  getLeyendaOrigen(anio: number | undefined | null): string {
    if (!anio) {
      return '* Información obtenida desde la BD';
    }
    const anioStr = String(anio);
    const info = this.config?.origenPorAnio?.[anioStr];
    if (!info || !info.activo) {
      return '* Información obtenida desde la BD';
    }
    const nombre = info.descripcion || `Cuentas claras_${anio}`;
    return `* Información obtenida desde la hoja ${nombre}`;
  }

  /**
   * Determina si el año especificado tiene la conexión activa con Google Sheets.
   */
  isSheetsActivo(anio: number | undefined | null): boolean {
    if (!anio) return false;
    const anioStr = String(anio);
    const info = this.config?.origenPorAnio?.[anioStr];
    if (!info) return true;
    return info.activo === true;
  }

  /**
   * Determina si el año especificado está en modo Base de Datos (PostgreSQL).
   */
  esAnioEnBD(anio: number | undefined | null): boolean {
    return !this.isSheetsActivo(anio);
  }

  get raw(): AppConfig {
    return this.config;
  }
}
