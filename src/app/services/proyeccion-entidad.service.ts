import { Injectable, inject } from '@angular/core';
import { MovimientosStoreGoogle } from '../stores/movimiento.google';

export interface ColumnaMesProyeccion {
  mes: string;
  mesCorto: string;
  anio: number;
  esPasado: boolean;
  esActual: boolean;
  esFuturo: boolean;
}

export interface FilaProyeccionEntidad {
  descripcion: string;
  valoresPorMes: Record<string, number>;
  cuotasPorMes?: Record<string, string>;
  esNuevo?: boolean;
  esUltima?: boolean;
  esFinalizada?: boolean;
}

export interface ProyeccionEntidadData {
  entidadKey: string;
  nombreEntidad: string;
  columnas: ColumnaMesProyeccion[];
  filas: FilaProyeccionEntidad[];
  totalesPorMes: Record<string, number>;
}

export interface ProyeccionFilaIndividual {
  descripcion: string;
  entidadKey: string;
  nombreEntidad: string;
  columnas: ColumnaMesProyeccion[];
  valoresPorMes: Record<string, number>;
  cuotasPorMes: Record<string, string>;
  totalRestante: number;
  esNuevo: boolean;
  esUltima: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProyeccionEntidadService {
  private storeGoogle = inject(MovimientosStoreGoogle);

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  private parseMonto(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim();
    if (!str) return 0;

    let isNegative = false;
    if (str.startsWith('(') && str.endsWith(')')) {
      isNegative = true;
      str = str.slice(1, -1);
    } else if (str.includes('-')) {
      isNegative = true;
      str = str.replace(/-/g, '');
    }

    str = str.replace(/\$/g, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    if (isNaN(num)) return 0;
    return isNegative ? -Math.abs(num) : num;
  }

  /**
   * Carga en lote todas las hojas mensuales involucradas en la proyección
   */
  private async asegurarHojasColumnas(columnas: ColumnaMesProyeccion[]): Promise<void> {
    const mesesPorAnio = new Map<number, string[]>();
    for (const col of columnas) {
      const lista = mesesPorAnio.get(col.anio) || [];
      if (!lista.includes(col.mes)) {
        lista.push(col.mes);
      }
      mesesPorAnio.set(col.anio, lista);
    }

    for (const [anioCol, mesesCol] of mesesPorAnio.entries()) {
      await this.storeGoogle.asegurarMensualPorAnioRange(
        anioCol,
        mesesCol,
        'ProyeccionEntidadService',
      );
    }
  }

  /**
   * Obtiene la lista de las 6 columnas de meses:
   * 1 mes pasado, mes actual seleccionado y 4 meses posteriores.
   */
  obtenerColumnasMeses(anio: number, mesSeleccionado: string): ColumnaMesProyeccion[] {
    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(anio);
    const index = mesesDelAnio.indexOf(mesSeleccionado);
    const columnas: ColumnaMesProyeccion[] = [];

    // Mes anterior
    if (index > 0) {
      const mesAnt = mesesDelAnio[index - 1];
      columnas.push({
        mes: mesAnt,
        mesCorto: mesAnt.substring(0, 3),
        anio,
        esPasado: true,
        esActual: false,
        esFuturo: false,
      });
    } else {
      // Si estamos en Enero, intentar obtener Diciembre del año previo
      columnas.push({
        mes: 'Diciembre',
        mesCorto: 'Dic',
        anio: anio - 1,
        esPasado: true,
        esActual: false,
        esFuturo: false,
      });
    }

    // Mes actual
    columnas.push({
      mes: mesSeleccionado,
      mesCorto: mesSeleccionado.substring(0, 3),
      anio,
      esPasado: false,
      esActual: true,
      esFuturo: false,
    });

    // 4 meses posteriores
    for (let i = 1; columnas.length < 6 && index + i < mesesDelAnio.length; i++) {
      const mesFut = mesesDelAnio[index + i];
      columnas.push({
        mes: mesFut,
        mesCorto: mesFut.substring(0, 3),
        anio,
        esPasado: false,
        esActual: false,
        esFuturo: true,
      });
    }

    return columnas;
  }

  /**
   * Obtiene la proyección completa estilo Google Sheets / Excel para una entidad,
   * incluyendo todas sus filas y los totales calculados por mes.
   */
  async obtenerProyeccionCompleta(
    anio: number,
    mesSeleccionado: string,
    entidadKey: string,
    nombreEntidadPersonalizado?: string,
  ): Promise<ProyeccionEntidadData> {
    const columnas = this.obtenerColumnasMeses(anio, mesSeleccionado);
    const colMesPasado = columnas.find((c) => c.esPasado);
    const colMesActual = columnas.find((c) => c.esActual);

    const totalesPorMes: Record<string, number> = {};
    columnas.forEach((c) => (totalesPorMes[c.mes] = 0));

    // =========================================================================
    // 1. MANEJO ESPECÍFICO PARA "OTROS"
    // En Google Sheets, "Otros" no tiene columnas multi-mes en una sola pestaña,
    // sino que cada mes tiene su propia hoja donde col 0 = concepto y col 1 = monto.
    // =========================================================================
    if (entidadKey === 'otros' || entidadKey.startsWith('otros_')) {
      await this.asegurarHojasColumnas(columnas);

      const nombreEntidad = nombreEntidadPersonalizado || 'Otros';
      const conceptosSet = new Set<string>();
      const conceptosList: string[] = [];

      const agregarConceptosDeHoja = (anioHoja: number, mesHoja: string) => {
        const hoja = this.storeGoogle.getMensualPorMes(anioHoja, mesHoja);
        const rangos = this.storeGoogle.ValidarRangoEntidades(anioHoja);
        const config = rangos?.['otros'];
        if (hoja?.values && config) {
          for (let r = config.inicio; r <= config.fin; r++) {
            const fila = hoja.values[r];
            if (!fila || fila.length === 0) continue;
            const desc = fila[0]?.trim();
            if (!desc || desc.toLowerCase() === 'total') continue;
            const norm = this.normalizar(desc);
            if (!conceptosSet.has(norm)) {
              conceptosSet.add(norm);
              conceptosList.push(desc);
            }
          }
        }
      };

      // Primero agregamos conceptos del mes actual para preservar su orden idéntico al de la tarjeta
      if (colMesActual) {
        agregarConceptosDeHoja(colMesActual.anio, colMesActual.mes);
      }
      // Luego incorporamos cualquier concepto que haya existido en meses pasados o futuros
      for (const col of columnas) {
        if (!col.esActual) {
          agregarConceptosDeHoja(col.anio, col.mes);
        }
      }

      const filas: FilaProyeccionEntidad[] = [];

      for (const concepto of conceptosList) {
        const valoresPorMes: Record<string, number> = {};
        const cuotasPorMes: Record<string, string> = {};
        const normConcepto = this.normalizar(concepto);

        for (const col of columnas) {
          const hoja = this.storeGoogle.getMensualPorMes(col.anio, col.mes);
          const rangos = this.storeGoogle.ValidarRangoEntidades(col.anio);
          const config = rangos?.['otros'];
          let montoMes = 0;

          if (hoja?.values && config) {
            for (let r = config.inicio; r <= config.fin; r++) {
              const fila = hoja.values[r];
              if (!fila || fila.length === 0) continue;
              const desc = fila[0]?.trim();
              if (desc) {
                const normF = this.normalizar(desc);
                if (normF === normConcepto || normF.startsWith(normConcepto) || normConcepto.startsWith(normF)) {
                  montoMes = this.parseMonto(fila[1]);
                  break;
                }
              }
            }
          }

          valoresPorMes[col.mes] = montoMes;
          const esCompensacion = this.normalizar(concepto).includes('compensacion');
          if (!esCompensacion) {
            totalesPorMes[col.mes] += montoMes;
          }
        }

        filas.push({
          descripcion: concepto,
          valoresPorMes,
          cuotasPorMes,
          esNuevo: this.esCuotaNueva(concepto),
          esUltima: this.esCuotaUltima(concepto),
          esFinalizada: false,
        });
      }

      return {
        entidadKey: 'otros',
        nombreEntidad,
        columnas,
        filas,
        totalesPorMes,
      };
    }

    // =========================================================================
    // 2. MANEJO PARA TARJETAS DE CRÉDITO Y RESTO DE ENTIDADES (VISA, MASTER, etc.)
    // =========================================================================
    await this.asegurarHojasColumnas(columnas);

    const hojaActual = this.storeGoogle.getMensualPorMes(anio, mesSeleccionado);
    const rangosActual = this.storeGoogle.ValidarRangoEntidades(anio);
    const configEntidad = rangosActual[entidadKey];

    const filas: FilaProyeccionEntidad[] = [];
    let nombreEntidad =
      nombreEntidadPersonalizado || entidadKey.charAt(0).toUpperCase() + entidadKey.slice(1);

    if (!hojaActual?.values || !configEntidad) {
      return { entidadKey, nombreEntidad, columnas, filas, totalesPorMes };
    }

    const valoresActual = hojaActual.values;
    const headerRowActual = valoresActual[configEntidad.headerIndex] ?? [];
    if (headerRowActual[0]?.trim()) {
      nombreEntidad = headerRowActual[0].trim();
    }

    // Mapear los índices de columnas en la hoja actual con nuestras columnas
    const mapaColIndexActual: Record<string, number> = {};
    columnas.forEach((col) => {
      if (!col.esPasado) {
        const idx = headerRowActual.findIndex((h) =>
          this.normalizar(h).includes(this.normalizar(col.mes)),
        );
        if (idx !== -1) {
          mapaColIndexActual[col.mes] = idx;
        }
      }
    });

    // Cargar datos del mes anterior
    let hojaPasado: { values: string[][] } | null = null;
    let colIndexPasado = -1;
    let configEntidadPasado: { inicio: number; fin: number; headerIndex: number } | null = null;

    if (colMesPasado) {
      hojaPasado = this.storeGoogle.getMensualPorMes(colMesPasado.anio, colMesPasado.mes) ?? null;
      if (hojaPasado?.values) {
        const rangosPasado = this.storeGoogle.ValidarRangoEntidades(colMesPasado.anio);
        configEntidadPasado = rangosPasado[entidadKey] ?? null;
        if (configEntidadPasado) {
          const headerRowPasado = hojaPasado.values[configEntidadPasado.headerIndex] ?? [];
          colIndexPasado = headerRowPasado.findIndex((h) =>
            this.normalizar(h).includes(this.normalizar(colMesPasado.mes)),
          );
          if (colIndexPasado === -1) {
            colIndexPasado = 1; // Fallback a la primera columna de monto
          }
        }
      }
    }

    // Mapa de filas del mes pasado para matching
    const filasMesPasadoMap = new Map<string, { desc: string; monto: number }>();

    if (hojaPasado?.values && configEntidadPasado && colIndexPasado !== -1) {
      const valAnt = hojaPasado.values;
      for (let r = configEntidadPasado.inicio; r <= configEntidadPasado.fin; r++) {
        const f = valAnt[r];
        if (!f || f.length === 0) continue;
        const descAnt = f[0]?.trim();
        if (!descAnt || descAnt.toLowerCase() === 'total') continue;
        const montoAnt = this.parseMonto(f[colIndexPasado]);
        if (montoAnt !== 0) {
          filasMesPasadoMap.set(this.normalizar(descAnt), { desc: descAnt, monto: montoAnt });
        }
      }
    }

    // 1. Procesar todas las filas de la hoja actual (mes actual + posteriores)
    for (let r = configEntidad.inicio; r <= configEntidad.fin; r++) {
      const fila = valoresActual[r];
      if (!fila || fila.length === 0) continue;

      const desc = fila[0]?.trim();
      if (!desc) continue;
      if (desc.toLowerCase() === 'total') continue;

      const valoresPorMes: Record<string, number> = {};
      const cuotasPorMes: Record<string, string> = {};

      // Parsear montos para mes actual y futuros desde la hoja actual
      let tieneValores = false;
      columnas.forEach((col) => {
        if (!col.esPasado) {
          const idx = mapaColIndexActual[col.mes];
          const montoVal = idx !== undefined ? this.parseMonto(fila[idx]) : 0;
          valoresPorMes[col.mes] = montoVal;
          if (montoVal !== 0) tieneValores = true;
        }
      });

      // Calcular o buscar el valor del mes anterior para esta fila
      if (colMesPasado) {
        let montoPasado = 0;
        const matchCuota = desc.match(/(\d+)\/(\d+)/);

        if (matchCuota) {
          const actualCuota = parseInt(matchCuota[1], 10);
          const totalCuota = parseInt(matchCuota[2], 10);

          if (actualCuota === 1) {
            // Cuota nueva en el mes actual -> en el mes anterior no existía
            montoPasado = 0;
          } else {
            // Cuota anterior era (actual - 1)/total
            const cuotaAnteriorStr = `${actualCuota - 1}/${totalCuota}`;
            const prefix = desc.substring(0, matchCuota.index).trim();
            const descBuscada = this.normalizar(`${prefix} ${cuotaAnteriorStr}`);

            // Buscar en el mapa del mes anterior
            for (const [keyNorm, itemAnt] of filasMesPasadoMap.entries()) {
              if (keyNorm.includes(this.normalizar(cuotaAnteriorStr))) {
                montoPasado = itemAnt.monto;
                cuotasPorMes[colMesPasado.mes] = cuotaAnteriorStr;
                break;
              }
            }
            // Si no se encontró por cuota explícita pero tiene mismo monto
            if (montoPasado === 0) {
              const montoActual = valoresPorMes[mesSeleccionado] || 0;
              montoPasado = montoActual; // Mantiene el valor de la cuota en cuotas fijas
              cuotasPorMes[colMesPasado.mes] = cuotaAnteriorStr;
            }
          }

          // Asignar cuotas secuenciales a los meses futuros
          columnas.forEach((col, idxCol) => {
            if (col.esActual) {
              cuotasPorMes[col.mes] = `${actualCuota}/${totalCuota}`;
            } else if (col.esFuturo) {
              const diff = idxCol - 1; // Distancia desde el mes actual
              const cuotaFutura = actualCuota + diff;
              if (cuotaFutura <= totalCuota) {
                cuotasPorMes[col.mes] = `${cuotaFutura}/${totalCuota}`;
              }
            }
          });
        } else {
          // Concepto recurrente no-cuota
          const descNorm = this.normalizar(desc);
          for (const [keyNorm, itemAnt] of filasMesPasadoMap.entries()) {
            if (keyNorm === descNorm || keyNorm.startsWith(descNorm) || descNorm.startsWith(keyNorm)) {
              montoPasado = itemAnt.monto;
              break;
            }
          }
        }

        valoresPorMes[colMesPasado.mes] = montoPasado;
        if (montoPasado !== 0) tieneValores = true;
      }

      if (tieneValores) {
        const esNuevo = this.esCuotaNueva(desc);
        const esUltima = this.esCuotaUltima(desc);

        filas.push({
          descripcion: desc,
          valoresPorMes,
          cuotasPorMes,
          esNuevo,
          esUltima,
          esFinalizada: false,
        });

        // Acumular a totales
        columnas.forEach((c) => {
          totalesPorMes[c.mes] += valoresPorMes[c.mes] || 0;
        });
      }
    }

    // 2. Si hubo cuotas en el mes anterior que finalizaron (ej. 6/6), agregarlas a la tabla
    if (colMesPasado && hojaPasado?.values && configEntidadPasado && colIndexPasado !== -1) {
      const valAnt = hojaPasado.values;
      for (let r = configEntidadPasado.inicio; r <= configEntidadPasado.fin; r++) {
        const f = valAnt[r];
        if (!f || f.length === 0) continue;
        const descAnt = f[0]?.trim();
        if (!descAnt || descAnt.toLowerCase() === 'total') continue;

        const montoAnt = this.parseMonto(f[colIndexPasado]);
        if (montoAnt === 0) continue;

        const matchCuota = descAnt.match(/(\d+)\/(\d+)/);
        if (matchCuota) {
          const act = parseInt(matchCuota[1], 10);
          const tot = parseInt(matchCuota[2], 10);
          if (act === tot) {
            const yaEstaEnFilas = filas.some((fila) =>
              this.normalizar(fila.descripcion).includes(this.normalizar(descAnt)),
            );
            if (!yaEstaEnFilas) {
              const valoresPorMes: Record<string, number> = {};
              columnas.forEach((c) => (valoresPorMes[c.mes] = 0));
              valoresPorMes[colMesPasado.mes] = montoAnt;

              filas.push({
                descripcion: `${descAnt} (Finalizada)`,
                valoresPorMes,
                esNuevo: false,
                esUltima: true,
                esFinalizada: true,
              });

              totalesPorMes[colMesPasado.mes] += montoAnt;
            }
          }
        }
      }
    }

    return {
      entidadKey,
      nombreEntidad,
      columnas,
      filas,
      totalesPorMes,
    };
  }

  /**
   * Obtiene la proyección detallada para una fila individual de cuota o movimiento
   * al pasar el cursor sobre ella dentro de la tarjeta de la entidad.
   */
  async obtenerProyeccionFila(
    anio: number,
    mesSeleccionado: string,
    entidadKey: string,
    filaData: { descripcion: string; monto: unknown },
    nombreEntidadPersonalizado?: string,
  ): Promise<ProyeccionFilaIndividual> {
    const columnas = this.obtenerColumnasMeses(anio, mesSeleccionado);
    const colMesPasado = columnas.find((c) => c.esPasado);
    const colMesActual = columnas.find((c) => c.esActual);

    const desc = filaData.descripcion || '';
    const montoActual = this.parseMonto(filaData.monto);

    const valoresPorMes: Record<string, number> = {};
    const cuotasPorMes: Record<string, string> = {};
    columnas.forEach((c) => (valoresPorMes[c.mes] = 0));

    valoresPorMes[mesSeleccionado] = montoActual;

    // =========================================================================
    // 1. MANEJO ESPECÍFICO PARA FILAS DE "OTROS"
    // =========================================================================
    if (entidadKey === 'otros' || entidadKey.startsWith('otros_')) {
      await this.asegurarHojasColumnas(columnas);

      const normDesc = this.normalizar(desc);
      let montoActualDetectado = montoActual;

      for (const col of columnas) {
        const hoja = this.storeGoogle.getMensualPorMes(col.anio, col.mes);
        const rangos = this.storeGoogle.ValidarRangoEntidades(col.anio);
        const config = rangos?.['otros'];
        let montoMes = 0;

        if (hoja?.values && config) {
          for (let r = config.inicio; r <= config.fin; r++) {
            const fila = hoja.values[r];
            if (!fila || fila.length === 0) continue;
            const filaDesc = fila[0]?.trim();
            if (filaDesc) {
              const normF = this.normalizar(filaDesc);
              if (normF === normDesc || normF.startsWith(normDesc) || normDesc.startsWith(normF)) {
                montoMes = this.parseMonto(fila[1]);
                break;
              }
            }
          }
        }

        if (col.esActual) {
          if (montoMes !== 0) {
            montoActualDetectado = montoMes;
          } else if (montoActual !== 0) {
            montoMes = montoActual;
          }
        }

        valoresPorMes[col.mes] = montoMes;
      }

      const matchCuota = desc.match(/(\d+)\/(\d+)/);
      let totalRestante = montoActualDetectado;

      if (matchCuota) {
        const actual = parseInt(matchCuota[1], 10);
        const total = parseInt(matchCuota[2], 10);

        columnas.forEach((col, idx) => {
          if (col.esActual) {
            cuotasPorMes[col.mes] = `${actual}/${total}`;
          } else if (col.esPasado && actual > 1) {
            cuotasPorMes[col.mes] = `${actual - 1}/${total}`;
          } else if (col.esFuturo) {
            const diff = idx - 1;
            const cuotaFut = actual + diff;
            if (cuotaFut <= total) {
              cuotasPorMes[col.mes] = `${cuotaFut}/${total}`;
            }
          }
        });

        const cuotasPendientes = Math.max(1, total - actual + 1);
        totalRestante = montoActualDetectado * cuotasPendientes;
      }

      return {
        descripcion: desc,
        entidadKey: 'otros',
        nombreEntidad: nombreEntidadPersonalizado || 'Otros',
        columnas,
        valoresPorMes,
        cuotasPorMes,
        totalRestante,
        esNuevo: this.esCuotaNueva(desc),
        esUltima: this.esCuotaUltima(desc),
      };
    }

    // =========================================================================
    // 2. MANEJO PARA FILAS DE TARJETAS DE CRÉDITO Y RESTO DE ENTIDADES
    // =========================================================================
    await this.asegurarHojasColumnas(columnas);

    const matchCuota = desc.match(/(\d+)\/(\d+)/);
    let totalRestante = montoActual;
    const esNuevo = this.esCuotaNueva(desc);
    const esUltima = this.esCuotaUltima(desc);

    if (matchCuota) {
      const actual = parseInt(matchCuota[1], 10);
      const total = parseInt(matchCuota[2], 10);

      // Mes anterior
      if (colMesPasado) {
        if (actual > 1) {
          valoresPorMes[colMesPasado.mes] = montoActual;
          cuotasPorMes[colMesPasado.mes] = `${actual - 1}/${total}`;
        } else {
          valoresPorMes[colMesPasado.mes] = 0;
        }
      }

      // Mes actual
      cuotasPorMes[mesSeleccionado] = `${actual}/${total}`;

      // Meses futuros
      columnas.forEach((col, idx) => {
        if (col.esFuturo) {
          const diff = idx - 1; // respecto al actual
          const cuotaFut = actual + diff;
          if (cuotaFut <= total) {
            valoresPorMes[col.mes] = montoActual;
            cuotasPorMes[col.mes] = `${cuotaFut}/${total}`;
          } else {
            valoresPorMes[col.mes] = 0;
          }
        }
      });

      // Total pendiente por pagar (mes actual + restantes)
      const cuotasPendientes = Math.max(1, total - actual + 1);
      totalRestante = montoActual * cuotasPendientes;
    } else {
      // Concepto regular
      if (colMesPasado) {
        const hojaPasado = this.storeGoogle.getMensualPorMes(colMesPasado.anio, colMesPasado.mes);
        const rangosPasado = this.storeGoogle.ValidarRangoEntidades(colMesPasado.anio);
        const configPasado = rangosPasado[entidadKey];
        if (hojaPasado?.values && configPasado) {
          for (let r = configPasado.inicio; r <= configPasado.fin; r++) {
            const f = hojaPasado.values[r];
            if (f && this.normalizar(f[0]).includes(this.normalizar(desc))) {
              valoresPorMes[colMesPasado.mes] = this.parseMonto(f[1]);
              break;
            }
          }
        }
      }
    }

    return {
      descripcion: desc,
      entidadKey,
      nombreEntidad:
        nombreEntidadPersonalizado || entidadKey.charAt(0).toUpperCase() + entidadKey.slice(1),
      columnas,
      valoresPorMes,
      cuotasPorMes,
      totalRestante,
      esNuevo,
      esUltima,
    };
  }

  private esCuotaNueva(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }

  private esCuotaUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    return !!match;
  }
}
