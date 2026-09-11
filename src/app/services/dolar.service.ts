import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface CotizacionBluelytics {
  oficial?: {
    value_avg?: number;
    value_sell?: number;
    value_buy?: number;
  };
  blue?: {
    value_avg?: number;
    value_sell?: number;
    value_buy?: number;
  };
}

export interface CotizacionDetalle {
  codigoMoneda?: string;
  descripcion?: string;
  tipoCotizacion?: number;
}

export interface CotizacionRegistro {
  fecha: string;
  detalle?: CotizacionDetalle[];
}

export interface ResultadoCotizacionRango {
  status?: number;
  results?: CotizacionRegistro[];
}

@Injectable({ providedIn: 'root' })
export class DolarService {
  private http = inject(HttpClient);
  private cacheTodasCotizaciones:
    { casa: string; compra: number; venta: number; fecha: string }[] | null = null;
  private promesaCotizaciones: Promise<
    { casa: string; compra: number; venta: number; fecha: string }[]
  > | null = null;

  obtenerCotizacionDelDiaActual() {
    return this.http.get<CotizacionBluelytics>('https://api.bluelytics.com.ar/v2/latest');
  }

  async obtenerTodasCotizaciones(): Promise<
    { casa: string; compra: number; venta: number; fecha: string }[]
  > {
    if (this.cacheTodasCotizaciones && this.cacheTodasCotizaciones.length > 0) {
      return this.cacheTodasCotizaciones;
    }
    if (this.promesaCotizaciones) {
      return await this.promesaCotizaciones;
    }

    this.promesaCotizaciones = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.get<{ casa: string; compra: number; venta: number; fecha: string }[]>(
            'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial',
          ),
        );
        this.cacheTodasCotizaciones = res ?? [];
        return this.cacheTodasCotizaciones;
      } catch (err) {
        console.warn('❌ Error al obtener todas las cotizaciones de ArgentinaDatos', err);
        return [];
      } finally {
        this.promesaCotizaciones = null;
      }
    })();

    return await this.promesaCotizaciones;
  }

  obtenerCotizacion(fecha: string) {
    const [year, month, day] = fecha.split('-');
    const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    console.log('url ' + url);
    return this.http.get<{ venta: number }>(url);
  }

  async obtenerDolar(fecha: string): Promise<number> {
    const clave = `dolar_${fecha}`; // Ejemplo: dolar_2025-10-02
    const enCache = localStorage.getItem(clave);
    if (enCache) {
      return parseFloat(enCache);
    }

    const todas = await this.obtenerTodasCotizaciones();
    const encontrada = todas.find((item) => item.fecha === fecha);
    if (encontrada && encontrada.venta) {
      const valor = Number(encontrada.venta);
      localStorage.setItem(clave, valor.toString());
      return valor;
    }

    const [year, month, day] = fecha.split('-');
    const fechaFormateada = `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    try {
      const res = await firstValueFrom(
        this.http.get<{ fecha: string; venta: string }>(
          `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/${fechaFormateada}`,
        ),
      );
      const valor = parseFloat(res.venta);
      localStorage.setItem(clave, valor.toString());
      return valor;
    } catch (err) {
      console.warn(`❌ Error al obtener dólar para ${fecha}`, err);
      return 0;
    }
  }

  async obtenerDolarPorRango(start: string, end: string): Promise<ResultadoCotizacionRango> {
    try {
      const todas = await this.obtenerTodasCotizaciones();
      if (todas && todas.length > 0) {
        const filtradas = todas.filter((item) => item.fecha >= start && item.fecha <= end);
        if (filtradas.length > 0) {
          const results: CotizacionRegistro[] = filtradas.map((item) => ({
            fecha: item.fecha,
            detalle: [
              {
                codigoMoneda: 'USD',
                descripcion: 'DOLAR E.E.U.U.',
                tipoCotizacion: item.venta,
              },
            ],
          }));
          return { status: 200, results };
        }
      }
    } catch (e) {
      console.warn('⚠️ Fallo consulta bulk ArgentinaDatos, intentando BCRA...', e);
    }

    try {
      const url = `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD?fechadesde=${start}&fechahasta=${end}`;
      console.log('url BCRA: ' + url);
      const result = await firstValueFrom(this.http.get<ResultadoCotizacionRango>(url));
      return result;
    } catch (err) {
      console.error('❌ Error en API BCRA por rango', err);
      return { status: 500, results: [] };
    }
  }
}
