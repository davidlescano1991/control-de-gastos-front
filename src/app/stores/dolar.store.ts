/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/prefer-for-of */
import { Injectable, signal, inject } from '@angular/core';
import { DolarService } from '../services/dolar.service';
import { parseFechaEsAR } from '../utils/grafico.utils';

@Injectable({ providedIn: 'root' })
export class CotizacionStore {
  cotizados = signal<
    {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number | undefined;
      diferenciaUSD?: number | undefined;
      deudaUSD?: number | undefined;
    }[]
  >([]);
  private cachePorAnio = new Map<number, string>(); // hash del resumen
  private cacheResultado = new Map<number, any[]>(); // resultado enriquecido
  private enProcesoPromesas = new Map<string, Promise<any[]>>();

  private dolarService = inject(DolarService);

  private formatearFechaISO(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private obtenerCotizacionVigente(
    fechaISO: string,
    cotizacionesMap: Map<string, number>,
    diasBusqueda = 365,
  ): number {
    if (!cotizacionesMap || cotizacionesMap.size === 0) return 0;

    // 1. Buscar cotización directa
    if (cotizacionesMap.has(fechaISO)) {
      const val = cotizacionesMap.get(fechaISO)!;
      if (val > 0) return val;
    }

    // 2. Buscar hacia atrás hasta 365 días
    const fechaBase = new Date(`${fechaISO}T12:00:00`);
    if (!isNaN(fechaBase.getTime())) {
      for (let offset = 1; offset <= diasBusqueda; offset++) {
        const fechaBusqueda = new Date(fechaBase);
        fechaBusqueda.setDate(fechaBase.getDate() - offset);
        const key = this.formatearFechaISO(fechaBusqueda);
        const cotizacion = cotizacionesMap.get(key);

        if (cotizacion != null && cotizacion > 0) {
          return cotizacion;
        }
      }
    }

    // 3. Para fechas futuras o no encontradas en el rango, usar la cotización válida más reciente
    let masReciente = 0;
    let fechaMasReciente = '';
    for (const [f, v] of cotizacionesMap.entries()) {
      if (v > 0 && f <= fechaISO && f > fechaMasReciente) {
        fechaMasReciente = f;
        masReciente = v;
      }
    }
    if (masReciente > 0) return masReciente;

    // 4. Último recurso: cualquier cotización positiva disponible
    for (const v of cotizacionesMap.values()) {
      if (v > 0) return v;
    }

    return 0;
  }

  async enriquecerConDolar(
    resumen: { fecha: string; total: number; diferencia: number; deudaPesos: number }[],
  ): Promise<
    {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number;
      diferenciaUSD?: number;
      deudaPesos: number;
      deudaUSD?: number;
    }[]
  > {
    const resultado: {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number;
      diferenciaUSD?: number;
      deudaPesos: number;
      deudaUSD: number;
    }[] = [];
    const hoy = new Date().toLocaleDateString('es-AR');
    let ultimaCotizacion = 0;

    for (let i = 0; i < resumen.length; i++) {
      const r = resumen[i];
      const fechaISO = r.fecha.split('/').reverse().join('-');
      let venta = 0;

      try {
        if (r.fecha === hoy) {
          const res = await this.dolarService.obtenerCotizacionDelDiaActual().toPromise();
          console.warn(`💲 Valor del dolar actual `, JSON.stringify(res));
          venta = res?.oficial?.value_sell || 0;
        } else {
          //const res = await this.dolarService.obtenerCotizacion(fechaISO).toPromise();
          const res = await this.dolarService.obtenerDolar(fechaISO);
          //venta = res?.venta || 0;
          venta = res || 0;
        }

        if (venta === 0) {
          venta = ultimaCotizacion;
        }

        if (venta > 0) {
          ultimaCotizacion = venta;
        }

        const totalUSD = venta ? r.total / venta : 0;
        const anterior = resultado[i - 1]?.totalUSD || 0;
        const diferenciaUSD = totalUSD - anterior;
        const deudaUSD = venta ? r.deudaPesos / venta : 0;
        resultado.push({
          ...r,
          totalUSD,
          diferenciaUSD,
          deudaUSD,
        });
      } catch {
        resultado.push({ ...r, totalUSD: 0, diferenciaUSD: 0, deudaUSD: 0 });
      }
    }
    this.cotizados.set(resultado);
    return resultado;
  }

  async enriquecerConDolarPorRango(
    resumen: { fecha: string; total: number; diferencia: number; deudaPesos: number }[],
    anio: number,
    called: string,
  ): Promise<
    {
      fecha: string;
      total: number;
      diferencia: number;
      totalUSD?: number;
      diferenciaUSD?: number;
      deudaPesos: number;
      deudaUSD?: number;
    }[]
  > {
    const resumenHash = JSON.stringify(resumen);

    //const cacheLocal = localStorage.getItem(`resumenUSD_${anio}`);
    //const cacheResultado = this.cacheResultado.get(anio);
    /* if (this.cachePorAnio.get(anio) === resumenHash) {
            console.warn(`⏩ Usando cache para año ${anio} desde ${called} en enriquecerConDolarPorRango()`);
            return this.cacheResultado.get(anio)!;
        }
        else if (cacheLocal != resumenHash) {
            const resultado2 = JSON.parse(cacheLocal ?? '');
            this.cachePorAnio.set(anio, resumenHash); // opcional si querés validar hash
            this.cacheResultado.set(anio, resultado2);
            console.warn(`📦 Usando cache localStorage para año ${anio}`);
            return resultado2;
        } */

    const keyPromesa = `${anio}::${resumenHash}`;
    if (this.cachePorAnio.get(anio) === resumenHash && this.cacheResultado.has(anio)) {
      console.warn(`⏩ Usando cache para año ${anio} desde ${called}`);
      return this.cacheResultado.get(anio)!;
    }
    if (this.enProcesoPromesas.has(keyPromesa)) {
      console.warn(`⏳ Ya se está procesando el año ${anio} con este resumen, esperando resultado desde ${called}`);
      return await this.enProcesoPromesas.get(keyPromesa)!;
    }
    const msj = `🔄 enriquecerConDolarPorRango llamado por ${called}, año ${anio}, registros=${resumen.length}`;
    console.log(msj);

    const promesa = (async () => {
      try {
        // 1. Convertir fechas del resumen a objetos Date
        console.warn(` 1. Convertir fechas del resumen a objetos Date ${msj}`);
        const fechas = resumen.map((item) => parseFechaEsAR(item.fecha));
        console.log(`Fechas en EnriquecerConDolarPorRango() ${JSON.stringify(fechas)}`);
        // 2. Calcular fecha mínima y máxima
        console.warn(` 2. Calcular fecha mínima y máxima ${msj}`);
        const fechaMin = new Date(Math.min(...fechas.map((f) => f.getTime())));
        const fechaMax = new Date(Math.max(...fechas.map((f) => f.getTime())));
        const fechaMinConMargen = new Date(fechaMin);
        fechaMinConMargen.setDate(fechaMinConMargen.getDate() - 10);
        const hoy = new Date();
        // 3. Intentar obtener cotizaciones por rango
        // 3. Intentar usar cache de cotizaciones primero
        console.warn(` 3. Intentar usar cache de cotizaciones primero  ${msj}`);
        let cotizacionesMap = new Map<string, number>();
        const cacheCotizaciones = localStorage.getItem(`cotizacionesUSD_${anio}`);
        if (cacheCotizaciones) {
          try {
            const pares = JSON.parse(cacheCotizaciones) as [string, number][];
            cotizacionesMap = new Map(pares);
            // Validar que la cache cubre hasta la fecha máxima requerida
            const todayISO = this.formatearFechaISO(hoy);
            const fechaMaxISO = this.formatearFechaISO(fechaMax);
            const fechaMaxEffective = fechaMaxISO > todayISO ? todayISO : fechaMaxISO;
            const fechaStartNecesaria =
              anio < new Date().getFullYear()
                ? `${anio}-01-01`
                : this.formatearFechaISO(fechaMinConMargen);
            const fechaEnd = fechaMaxEffective;
            const keys = Array.from(cotizacionesMap.keys());
            const maxCached = keys.length > 0 ? keys.reduce((a, b) => (a > b ? a : b)) : null;
            const minCached = keys.length > 0 ? keys.reduce((a, b) => (a < b ? a : b)) : null;
            if (
              !minCached ||
              !maxCached ||
              minCached > fechaStartNecesaria ||
              maxCached < fechaEnd
            ) {
              console.warn(
                `🗑️ Cache de cotizaciones incompleta para ${anio} (minCached=${minCached}, maxCached=${maxCached}, needed=${fechaStartNecesaria}..${fechaEnd}), se forzará consulta`,
              );
              cotizacionesMap = new Map();
            } else {
              console.warn(`📦 Usando cotizaciones cacheadas para año ${anio}`);
            }
          } catch (err) {
            console.error('❌ Error parseando cacheCotizaciones, se ignorará cache', err);
            cotizacionesMap = new Map();
          }
        }

        // Si no hay cache completa, consultar API por rango y/o por día
        if (cotizacionesMap.size === 0) {
          let res: any = null;
          try {
            // Para años pasados, preferimos pedir todo el año de una sola vez
            const year = anio;
            const todayISOForRange = this.formatearFechaISO(hoy);
            const fechaMaxISOForRange = this.formatearFechaISO(fechaMax);
            const fechaEndCapped =
              fechaMaxISOForRange > todayISOForRange ? todayISOForRange : fechaMaxISOForRange;
            const fechaStart =
              anio < new Date().getFullYear()
                ? `${year}-01-01`
                : this.formatearFechaISO(fechaMinConMargen);
            const fechaEnd = anio < new Date().getFullYear() ? `${year}-12-31` : fechaEndCapped;
            res = await this.dolarService.obtenerDolarPorRango(fechaStart, fechaEnd);
            console.log(
              `res (rango: ${fechaStart} - ${fechaEnd}) tiene ${res?.results?.length ?? 0} registros`,
            );
          } catch (err) {
            console.error('❌ Error en API de rango, se usará fallback por día', err);
            res = null;
          }
          if (res?.results?.length > 0) {
            res.results.forEach((entry: any) => {
              const fecha = entry.fecha; // formato YYYY-MM-DD
              const cotizacion = entry.detalle?.[0]?.tipoCotizacion ?? 0;
              cotizacionesMap.set(fecha, cotizacion);
            });
          } else {
            console.warn('⚠️ API de rango no devolvió datos.');
          }
          // Guardar cotizaciones en cache
          try {
            localStorage.setItem(
              `cotizacionesUSD_${anio}`,
              JSON.stringify(Array.from(cotizacionesMap.entries())),
            );
          } catch (err) {
            console.error('❌ No se pudo guardar cotizaciones en localStorage', err);
          }
        }

        // 4. Si la última fecha es hoy, agregar cotización actual
        console.warn(` 4. Si la última fecha es hoy, agregar cotización actual  ${msj}`);
        if (this.esMismaFecha(fechaMax, hoy)) {
          const resHoy = await this.dolarService.obtenerCotizacionDelDiaActual().toPromise();
          console.warn(
            `💲 Valor del dolar actual  en enriquecerConDolarPorRango()`,
            JSON.stringify(resHoy),
          );
          const formato = hoy.toISOString().split('T')[0];
          const cotizacion = resHoy?.oficial?.value_sell || 0;
          cotizacionesMap.set(formato, cotizacion);
        }
        // 5. Enriquecer resumen con cotización
        console.warn(` 5. Enriquecer resumen con cotización  ${msj}`);
        const resultado: {
          fecha: string;
          total: number;
          diferencia: number;
          deudaPesos: number;
          totalUSD?: number;
          diferenciaUSD?: number;
          deudaUSD?: number;
        }[] = [];

        for (let i = 0; i < resumen.length; i++) {
          const r = resumen[i];
          const fechaObj = parseFechaEsAR(r.fecha);
          const fechaISO = this.formatearFechaISO(fechaObj);
          const venta = this.obtenerCotizacionVigente(fechaISO, cotizacionesMap);

          const anteriorTotal = i > 0 ? resumen[i - 1].total : r.total;
          const diferenciaCalculada =
            (r.diferencia !== undefined && r.diferencia !== 0) || i === 0
              ? r.diferencia
              : r.total - anteriorTotal;

          if (venta === 0) {
            resultado.push({
              ...r,
              diferencia: diferenciaCalculada,
              totalUSD: undefined,
              diferenciaUSD: undefined,
              deudaUSD: undefined,
            });
            continue;
          }

          const totalUSD = r.total / venta;
          const ultimoTotalUSD =
            [...resultado].reverse().find((item) => item.totalUSD != null)?.totalUSD ?? 0;
          const diferenciaUSD = totalUSD - ultimoTotalUSD;
          const deudaUSD = r.deudaPesos / venta;

          resultado.push({
            ...r,
            diferencia: diferenciaCalculada,
            totalUSD,
            diferenciaUSD,
            deudaUSD,
          });
        }
        // 5. Enriquecer resumen con cotización
        console.warn(` Guardar en localStorage   ${msj}`);
        if (called !== 'GraficoHistoricoUSD') {
          this.cachePorAnio.set(anio, resumenHash);
          this.cacheResultado.set(anio, resultado);
        }
        localStorage.setItem(
          `cotizacionesUSD_${anio}`,
          JSON.stringify(Array.from(cotizacionesMap.entries())),
        );

        return resultado;
      } finally {
        this.enProcesoPromesas.delete(keyPromesa);
      }
    })();

    this.enProcesoPromesas.set(keyPromesa, promesa);
    return await promesa;
  }

  async obtenerCotizacionesMensualesParaAnio(
    anio: number,
    meses: string[],
  ): Promise<Map<string, number>> {
    const cotizacionesResultado = new Map<string, number>();
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActualIdx = hoy.getMonth(); // 0 = Enero ... 11 = Diciembre

    // 1. Obtener o cargar el mapa de cotizaciones para el año
    let cotizacionesMap = new Map<string, number>();
    const cacheCotizaciones = localStorage.getItem(`cotizacionesUSD_${anio}`);
    if (cacheCotizaciones) {
      try {
        const pares = JSON.parse(cacheCotizaciones) as [string, number][];
        cotizacionesMap = new Map(pares);
      } catch (err) {
        console.error('❌ Error parseando cacheCotizaciones', err);
      }
    }

    // Si la cache está vacía, consultar por rango o todas las cotizaciones
    if (cotizacionesMap.size === 0) {
      try {
        const fechaStart = `${anio}-01-01`;
        const fechaEnd = anio < anioActual ? `${anio}-12-31` : this.formatearFechaISO(hoy);
        const res = await this.dolarService.obtenerDolarPorRango(fechaStart, fechaEnd);
        if (res?.results && res.results.length > 0) {
          res.results.forEach((entry: any) => {
            const f = entry.fecha;
            const cot = entry.detalle?.[0]?.tipoCotizacion ?? 0;
            if (f && cot > 0) {
              cotizacionesMap.set(f, cot);
            }
          });
        }
      } catch (err) {
        console.error('❌ Error al obtener cotizaciones por rango para meses anuales', err);
      }

      if (cotizacionesMap.size > 0) {
        try {
          localStorage.setItem(
            `cotizacionesUSD_${anio}`,
            JSON.stringify(Array.from(cotizacionesMap.entries())),
          );
        } catch (err) {
          console.error('❌ Error guardando en localStorage', err);
        }
      }
    }

    // 2. Obtener cotización actual si es el año en curso
    let cotizacionActual = 0;
    try {
      const resHoy = await this.dolarService.obtenerCotizacionDelDiaActual().toPromise();
      cotizacionActual = resHoy?.oficial?.value_sell || 0;
      if (cotizacionActual > 0) {
        cotizacionesMap.set(this.formatearFechaISO(hoy), cotizacionActual);
      }
    } catch {
      // Ignorar si falla bluelytics, se usará la más reciente de cotizacionesMap
    }

    if (cotizacionActual === 0) {
      cotizacionActual = this.obtenerCotizacionVigente(this.formatearFechaISO(hoy), cotizacionesMap);
    }

    const mesesBase = [
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

    for (const mes of meses) {
      const partes = mes.trim().split(/\s+/);
      const nombreMesBase = partes[0].toLowerCase();
      const idxMes = mesesBase.indexOf(nombreMesBase);
      const anioDelMes = partes.length > 1 && !isNaN(Number(partes[1])) ? Number(partes[1]) : anio;

      const esPasado =
        anioDelMes < anioActual ||
        (anioDelMes === anioActual && idxMes !== -1 && idxMes < mesActualIdx);

      if (esPasado && idxMes !== -1) {
        // Último día del mes (por ejemplo, new Date(2026, 1, 0) para enero = 31 de enero)
        const ultimoDiaMes = new Date(anioDelMes, idxMes + 1, 0);
        const ultimoDiaISO = this.formatearFechaISO(ultimoDiaMes);
        const cotizacionMesPasado = this.obtenerCotizacionVigente(ultimoDiaISO, cotizacionesMap);
        cotizacionesResultado.set(
          mes,
          cotizacionMesPasado > 0 ? cotizacionMesPasado : cotizacionActual,
        );
      } else {
        // Mes actual o futuro: cotización más reciente
        cotizacionesResultado.set(mes, cotizacionActual);
      }
    }

    return cotizacionesResultado;
  }

  getresumenCotizadosXAnio(anio: number) {
    return this.cacheResultado.get(anio);
  }
  esMismaFecha(fecha1: Date, fecha2: Date): boolean {
    return (
      fecha1.getFullYear() === fecha2.getFullYear() &&
      fecha1.getMonth() === fecha2.getMonth() &&
      fecha1.getDate() === fecha2.getDate()
    );
  }

  get cotizaciones() {
    const resp = this.cotizados.asReadonly();
    console.log('cotizacion usd: ' + resp);
    return resp;
  }

  limpiarCacheAnio(anio: number) {
    this.cachePorAnio.delete(anio);
    this.cacheResultado.delete(anio);
    for (const key of Array.from(this.enProcesoPromesas.keys())) {
      if (key.startsWith(`${anio}::`)) {
        this.enProcesoPromesas.delete(key);
      }
    }
  }

  limpiarTodoCache() {
    this.cachePorAnio.clear();
    this.cacheResultado.clear();
    this.enProcesoPromesas.clear();
  }
}
