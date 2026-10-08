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
   * Obtiene la lista de columnas de meses:
   * - Si vistaAnioCompleto es true: todos los meses del año (Enero a Diciembre).
   * - Si vistaAnioCompleto es false: 1 mes anterior, mes actual seleccionado y 4 posteriores (6 meses).
   */
  obtenerColumnasMeses(
    anio: number,
    mesSeleccionado: string,
    vistaAnioCompleto = false,
  ): ColumnaMesProyeccion[] {
    const mesesDelAnio = this.storeGoogle.getMesesParaResumen(anio);
    const index = mesesDelAnio.indexOf(mesSeleccionado);

    if (vistaAnioCompleto) {
      return mesesDelAnio.map((mes, idx) => ({
        mes,
        mesCorto: mes.substring(0, 3),
        anio,
        esPasado: index !== -1 && idx < index,
        esActual: mes === mesSeleccionado,
        esFuturo: index !== -1 && idx > index,
      }));
    }

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
   * Permite alternar entre la ventana compacta de 6 meses y todos los meses del año.
   */
  async obtenerProyeccionCompleta(
    anio: number,
    mesSeleccionado: string,
    entidadKey: string,
    nombreEntidadPersonalizado?: string,
    vistaAnioCompleto = false,
  ): Promise<ProyeccionEntidadData> {
    const columnas = this.obtenerColumnasMeses(anio, mesSeleccionado, vistaAnioCompleto);
    const colMesActual = columnas.find((c) => c.esActual);
    const colMesPasado = columnas.find((c) => c.esPasado);

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

      // Si es una sub-entidad de otros (ej: otros_internet), filtramos la lista
      let listaConceptosAProcesar = conceptosList;
      if (entidadKey.startsWith('otros_')) {
        const subFiltro = this.normalizar(entidadKey.replace('otros_', ''));
        listaConceptosAProcesar = conceptosList.filter(
          (c) => this.normalizar(c).includes(subFiltro) || subFiltro.includes(this.normalizar(c)),
        );
      }

      const filas: FilaProyeccionEntidad[] = [];

      for (const concepto of listaConceptosAProcesar) {
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

    const indexActual = columnas.findIndex((c) => c.esActual);

    // Mapear los índices de columnas en cada hoja de mes pasado
    const mapaColIndexPast: Record<string, number> = {};
    for (const colP of columnas.filter((c) => c.esPasado)) {
      const hojaP = this.storeGoogle.getMensualPorMes(colP.anio, colP.mes);
      const rangosP = this.storeGoogle.ValidarRangoEntidades(colP.anio);
      const configP = rangosP?.[entidadKey];
      if (hojaP?.values && configP) {
        const headerRowP = hojaP.values[configP.headerIndex] ?? [];
        const colIdxP = headerRowP.findIndex((h) =>
          this.normalizar(h).includes(this.normalizar(colP.mes)),
        );
        mapaColIndexPast[colP.mes] = colIdxP !== -1 ? colIdxP : 1;
      } else {
        mapaColIndexPast[colP.mes] = 1;
      }
    }

    // Helper para verificar coincidencia entre conceptos no cuota
    const coincideConcepto = (a: string, b: string): boolean => {
      if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
      if (a.includes('un pago') && b.includes('un pago')) return true;
      if (a.includes('intereses') && b.includes('intereses')) return true;
      if (a.includes('sello') && b.includes('sello')) return true;
      if (a.includes('saldo anterior') && b.includes('saldo anterior')) return true;
      if (a.includes('iva') && b.includes('iva')) return true;
      return false;
    };

    // 1. Procesar todas las filas activas de la hoja del mes actual
    for (let r = configEntidad.inicio; r <= configEntidad.fin; r++) {
      const fila = valoresActual[r];
      if (!fila || fila.length === 0) continue;

      const desc = fila[0]?.trim();
      if (!desc || desc.toLowerCase() === 'total') continue;

      const valoresPorMes: Record<string, number> = {};
      const cuotasPorMes: Record<string, string> = {};
      columnas.forEach((c) => (valoresPorMes[c.mes] = 0));
      let tieneValores = false;

      const matchCuota = desc.match(/(\d+)\/(\d+)/);
      const esUnPago = this.normalizar(desc).includes('un pago');
      const esCuota = !!matchCuota && parseInt(matchCuota[2], 10) > 1 && !esUnPago;
      const actualCuota = esCuota ? parseInt(matchCuota![1], 10) : 0;
      const totalCuotas = esCuota ? parseInt(matchCuota![2], 10) : 0;

      // A) Monto en el mes actual
      const idxActualCol = mapaColIndexActual[mesSeleccionado] ?? 1;
      const montoActual = this.parseMonto(fila[idxActualCol]);
      valoresPorMes[mesSeleccionado] = montoActual;
      if (montoActual !== 0) tieneValores = true;
      if (esCuota) {
        cuotasPorMes[mesSeleccionado] = `${actualCuota}/${totalCuotas}`;
      }

      // B) Meses futuros (posteriores al mes actual)
      columnas.forEach((col, idxCol) => {
        if (col.esFuturo) {
          const distFut = idxCol - indexActual;
          if (esCuota) {
            const cuotaFut = actualCuota + distFut;
            if (cuotaFut <= totalCuotas) {
              cuotasPorMes[col.mes] = `${cuotaFut}/${totalCuotas}`;
              const idxFut = mapaColIndexActual[col.mes];
              let montoFut = idxFut !== undefined ? this.parseMonto(fila[idxFut]) : 0;
              if (montoFut === 0 && montoActual !== 0) {
                montoFut = montoActual;
              }
              valoresPorMes[col.mes] = montoFut;
              if (montoFut !== 0) tieneValores = true;
            } else {
              valoresPorMes[col.mes] = 0;
            }
          } else {
            const idxFut = mapaColIndexActual[col.mes];
            const montoFut = idxFut !== undefined ? this.parseMonto(fila[idxFut]) : 0;
            valoresPorMes[col.mes] = montoFut;
            if (montoFut !== 0) tieneValores = true;
          }
        }
      });

      // C) Meses pasados (anteriores al mes actual)
      columnas.forEach((col, idxCol) => {
        if (col.esPasado) {
          const distPas = indexActual - idxCol;
          if (esCuota) {
            const cuotaPas = actualCuota - distPas;
            if (cuotaPas >= 1) {
              const cuotaPasStr = `${cuotaPas}/${totalCuotas}`;
              cuotasPorMes[col.mes] = cuotaPasStr;

              const hojaP = this.storeGoogle.getMensualPorMes(col.anio, col.mes);
              const rangosP = this.storeGoogle.ValidarRangoEntidades(col.anio);
              const configP = rangosP?.[entidadKey];
              const colIdxP = mapaColIndexPast[col.mes] ?? 1;
              let montoPasado = 0;

              if (hojaP?.values && configP) {
                // Verificar en la misma fila física r
                const fP = hojaP.values[r];
                const descP = fP ? fP[0]?.trim() || '' : '';
                const mP = fP ? this.parseMonto(fP[colIdxP]) : 0;
                if (fP && mP > 0 && (descP.includes(cuotaPasStr) || Math.abs(mP - montoActual) < 1)) {
                  montoPasado = mP;
                } else {
                  // Buscar por la cuota exacta en la hoja pasada
                  for (let rP = configP.inicio; rP <= configP.fin; rP++) {
                    const rowP = hojaP.values[rP];
                    if (!rowP) continue;
                    const dP = rowP[0]?.trim() || '';
                    const mRowP = this.parseMonto(rowP[colIdxP]);
                    if (dP.includes(cuotaPasStr) && mRowP > 0) {
                      montoPasado = mRowP;
                      break;
                    }
                  }
                }
              }

              if (montoPasado === 0 && montoActual !== 0) {
                montoPasado = montoActual;
              }
              valoresPorMes[col.mes] = montoPasado;
              if (montoPasado !== 0) tieneValores = true;
            } else {
              valoresPorMes[col.mes] = 0;
            }
          } else {
            // Fila no cuota (Un Pago 1/1, Intereses, Impuesto al sello, DB IVA, SALDO ANTERIOR):
            const hojaP = this.storeGoogle.getMensualPorMes(col.anio, col.mes);
            const rangosP = this.storeGoogle.ValidarRangoEntidades(col.anio);
            const configP = rangosP?.[entidadKey];
            const colIdxP = mapaColIndexPast[col.mes] ?? 1;
            let montoPasado = 0;

            if (hojaP?.values && configP) {
              const normDesc = this.normalizar(desc);
              const fP = hojaP.values[r];
              const descP = fP ? this.normalizar(fP[0]?.trim()) : '';

              if (fP && coincideConcepto(normDesc, descP)) {
                montoPasado = this.parseMonto(fP[colIdxP]);
              } else {
                for (let rP = configP.inicio; rP <= configP.fin; rP++) {
                  const rowP = hojaP.values[rP];
                  if (!rowP) continue;
                  const dP = this.normalizar(rowP[0]?.trim());
                  if (coincideConcepto(normDesc, dP)) {
                    montoPasado = this.parseMonto(rowP[colIdxP]);
                    break;
                  }
                }
              }
            }
            valoresPorMes[col.mes] = montoPasado;
            if (montoPasado !== 0) tieneValores = true;
          }
        }
      });

      if (tieneValores) {
        filas.push({
          descripcion: desc,
          valoresPorMes,
          cuotasPorMes,
          esNuevo: this.esCuotaNueva(desc),
          esUltima: this.esCuotaUltima(desc),
          esFinalizada: false,
        });

        columnas.forEach((c) => {
          totalesPorMes[c.mes] += valoresPorMes[c.mes] || 0;
        });
      }
    }

    // 2. Incorporar compras finalizadas en meses anteriores del año
    for (let idxP = indexActual - 1; idxP >= 0; idxP--) {
      const colP = columnas[idxP];
      const hojaP = this.storeGoogle.getMensualPorMes(colP.anio, colP.mes);
      const rangosP = this.storeGoogle.ValidarRangoEntidades(colP.anio);
      const configP = rangosP?.[entidadKey];
      const colIdxP = mapaColIndexPast[colP.mes] ?? 1;

      if (!hojaP?.values || !configP) continue;

      for (let rP = configP.inicio; rP <= configP.fin; rP++) {
        const rowP = hojaP.values[rP];
        if (!rowP || rowP.length === 0) continue;
        const descP = rowP[0]?.trim();
        if (!descP || descP.toLowerCase() === 'total') continue;

        const montoP = this.parseMonto(rowP[colIdxP]);
        if (montoP === 0) continue;

        const matchCuotaP = descP.match(/(\d+)\/(\d+)/);
        const esUnPagoP = this.normalizar(descP).includes('un pago');
        if (!matchCuotaP || esUnPagoP || parseInt(matchCuotaP[2], 10) <= 1) continue;

        const cuotaP = parseInt(matchCuotaP[1], 10);
        const totalP = parseInt(matchCuotaP[2], 10);

        // Verificar si este plan de cuotas ya está cubierto en alguna fila activa o previa
        const yaCubierto = filas.some((f) => {
          return (
            f.cuotasPorMes?.[colP.mes] === `${cuotaP}/${totalP}` &&
            Math.abs((f.valoresPorMes[colP.mes] || 0) - montoP) < 1
          );
        });

        if (!yaCubierto) {
          const valoresPorMes: Record<string, number> = {};
          const cuotasPorMes: Record<string, string> = {};
          columnas.forEach((c) => (valoresPorMes[c.mes] = 0));
          let tieneValoresFin = false;

          for (let idxM = 0; idxM < indexActual; idxM++) {
            const colM = columnas[idxM];
            const dist = idxM - idxP;
            const cM = cuotaP + dist;
            if (cM >= 1 && cM <= totalP) {
              cuotasPorMes[colM.mes] = `${cM}/${totalP}`;
              valoresPorMes[colM.mes] = montoP;
              tieneValoresFin = true;
            }
          }

          if (tieneValoresFin) {
            filas.push({
              descripcion: `${descP} (Finalizada)`,
              valoresPorMes,
              cuotasPorMes,
              esNuevo: false,
              esUltima: true,
              esFinalizada: true,
            });

            columnas.forEach((c) => {
              totalesPorMes[c.mes] += valoresPorMes[c.mes] || 0;
            });
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
    vistaAnioCompleto = false,
  ): Promise<ProyeccionFilaIndividual> {
    const columnas = this.obtenerColumnasMeses(anio, mesSeleccionado, vistaAnioCompleto);
    const colMesPasado = columnas.find((c) => c.esPasado);
    const colMesActual = columnas.find((c) => c.esActual);
    const indexActual = columnas.findIndex((c) => c.esActual);

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
          } else if (col.esPasado) {
            const dist = indexActual - idx;
            const cuotaPas = actual - dist;
            if (cuotaPas >= 1) {
              cuotasPorMes[col.mes] = `${cuotaPas}/${total}`;
            }
          } else if (col.esFuturo) {
            const diff = idx - indexActual;
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
    const esUnPago = this.normalizar(desc).includes('un pago');
    const esCuota = !!matchCuota && parseInt(matchCuota[2], 10) > 1 && !esUnPago;
    let totalRestante = montoActual;
    const esNuevo = this.esCuotaNueva(desc);
    const esUltima = this.esCuotaUltima(desc);

    if (esCuota && matchCuota) {
      const actual = parseInt(matchCuota[1], 10);
      const total = parseInt(matchCuota[2], 10);

      // Meses pasados
      columnas.forEach((col, idx) => {
        if (col.esPasado) {
          const dist = indexActual - idx;
          const cuotaPas = actual - dist;
          if (cuotaPas >= 1) {
            valoresPorMes[col.mes] = montoActual;
            cuotasPorMes[col.mes] = `${cuotaPas}/${total}`;
          } else {
            valoresPorMes[col.mes] = 0;
          }
        }
      });

      // Mes actual
      cuotasPorMes[mesSeleccionado] = `${actual}/${total}`;

      // Meses futuros
      columnas.forEach((col, idx) => {
        if (col.esFuturo) {
          const diff = idx - indexActual;
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
      // Concepto regular sin cuotas
      columnas.forEach((col) => {
        if (col.esPasado) {
          const hojaPasado = this.storeGoogle.getMensualPorMes(col.anio, col.mes);
          const rangosPasado = this.storeGoogle.ValidarRangoEntidades(col.anio);
          const configPasado = rangosPasado?.[entidadKey];
          if (hojaPasado?.values && configPasado) {
            for (let r = configPasado.inicio; r <= configPasado.fin; r++) {
              const f = hojaPasado.values[r];
              if (f && this.normalizar(f[0]).includes(this.normalizar(desc))) {
                valoresPorMes[col.mes] = this.parseMonto(f[1]);
                break;
              }
            }
          }
        }
      });
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
    if (limpio.includes('un pago')) return false;
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }

  private esCuotaUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    if (limpio.includes('un pago')) return false;
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    return !!match && match[1] !== '1';
  }
}
