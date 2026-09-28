import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { setFeriadosDesdeServidor } from '../utils/feriados.utils';

interface EntityRange {
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
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig = {};
  private aniosInicio: number[] = [2026, 2025, 2024, 2023];
  private aniosEstimativos: number[] = [2026, 2025, 2024, 2023];
  private aniosMensual: number[] = [2026, 2025, 2024, 2023, 2022];
  private aniosAnual: number[] = [2026, 2025, 2024, 2023, 2022];
  private http = inject(HttpClient);

  load(): Promise<void> {
    const baseHref =
      typeof document !== 'undefined'
        ? document.querySelector('base')?.getAttribute('href') || '/'
        : '/';
    const prefix = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    const urlConfig = `${prefix}assets/years-and-ranges.json`;
    const urlFeriados = `${prefix}assets/feriados.json`;
    const urlInicio = `${prefix}assets/years-inicio.json`;
    const urlEstimativos = `${prefix}assets/years-estimativos.json`;
    const urlMensual = `${prefix}assets/years-mensual.json`;
    const urlAnual = `${prefix}assets/years-anual.json`;

    return Promise.all([
      firstValueFrom(this.http.get<AppConfig>(urlConfig)).catch((err) => {
        console.warn('AppConfig load failed, using defaults', err);
        return {} as AppConfig;
      }),
      firstValueFrom(this.http.get<{ feriados?: Record<string, string> }>(urlFeriados)).catch((err) => {
        console.warn('Feriados load failed, using defaults', err);
        return null;
      }),
      firstValueFrom(this.http.get<YearsConfig>(urlInicio)).catch((err) => {
        console.warn('Years Inicio load failed, using defaults', err);
        return null;
      }),
      firstValueFrom(this.http.get<YearsConfig>(urlEstimativos)).catch((err) => {
        console.warn('Years Estimativos load failed, using defaults', err);
        return null;
      }),
      firstValueFrom(this.http.get<YearsConfig>(urlMensual)).catch((err) => {
        console.warn('Years Mensual load failed, using defaults', err);
        return null;
      }),
      firstValueFrom(this.http.get<YearsConfig>(urlAnual)).catch((err) => {
        console.warn('Years Anual load failed, using defaults', err);
        return null;
      }),
    ])
      .then(([cfg, feriadosData, inicioData, estimativosData, mensualData, anualData]) => {
        this.config = cfg || {};
        if (feriadosData) {
          setFeriadosDesdeServidor(feriadosData);
        }
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
        console.log('AppConfig, Feriados and Screen Years loaded successfully');
      })
      .catch((err) => {
        console.warn('Error general al cargar configuración de servidor', err);
        this.config = {};
        this.aplicarColoresEntidadesCSS();
      });
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
        ml: '#f8cb01',
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

  get raw(): AppConfig {
    return this.config;
  }
}
