const fs = require('fs');
const filePath = 'c:/Datos/David/Proyectos/Control_Gastos/control-de-gastos-api/src/services/reportes.service.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Replace getReporteSaldoAnual and helper methods
const oldMethodStart = '  async getReporteSaldoAnual(year: number, force = false): Promise<ReporteSaldoAnualResponse> {';
const oldMethodEnd = '  private async fetchCortesFromGoogleSheets(year: number, sheetId: string): Promise<ReporteCortesBimonetariosResponse | null> {';

const idxStart = code.indexOf(oldMethodStart);
const idxEnd = code.indexOf(oldMethodEnd);

if (idxStart === -1 || idxEnd === -1) {
  console.error('Could not locate old getReporteSaldoAnual implementation');
  process.exit(1);
}

const newImplementation = `  async getReporteSaldoAnual(year: number, force = false): Promise<ReporteSaldoAnualResponse> {
    const sheetId = await sheetConfigService.getSheetIdForYear(year);
    const cacheKey = \`\${year}_\${sheetId || 'DB'}\`;
    const currentYear = new Date().getFullYear();
    const ttl = year === currentYear ? this.CACHE_TTL_CURRENT_MS : this.CACHE_TTL_HISTORIC_MS;

    if (!force && this.cacheSaldoAnual.has(cacheKey)) {
      const entry = this.cacheSaldoAnual.get(cacheKey)!;
      if (Date.now() - entry.timestamp < ttl) {
        return entry.data;
      }
    }

    // 1. Obtener puntos del año solicitado (a partir del 01/01 de dicho año)
    const currYearData = await this.fetchRawPuntosForYear(year);
    const puntosCurr = currYearData.puntos.filter((p) => p.fechaISO >= \`\${year}-01-01\`);

    // 2. Obtener puntos del año anterior correspondientes al inicio del ejercicio (octubre a diciembre)
    let puntosPrev: SaldoPunto[] = [];
    let prevYearData: { origen: 'SHEETS' | 'DATABASE'; hoja: string } | null = null;

    if (year > 2021) {
      try {
        prevYearData = await this.fetchRawPuntosForYear(year - 1);
        puntosPrev = prevYearData.puntos.filter(
          (p) => p.fechaISO >= \`\${year - 1}-10-01\` && p.fechaISO <= \`\${year - 1}-12-31\`
        );
      } catch (err: any) {
        console.warn(\`[ReportesService] No se pudieron obtener puntos previos del año \${year - 1}:\`, err.message);
      }
    }

    // Asegurar meses estándar para los puntos del año anterior
    puntosPrev = puntosPrev.map((p) => {
      const mNum = p.fechaISO.substring(5, 7);
      let mName = p.mes;
      if (mNum === '10') mName = 'Octubre';
      else if (mNum === '11') mName = 'Noviembre';
      else if (mNum === '12') mName = 'Diciembre';
      return { ...p, mes: mName };
    });

    // Para los puntos del año actual: si hay puntos en octubre y ya existía Octubre del año anterior, marcar 'Mes actual'
    const puntosCurrAjustados = puntosCurr.map((p) => {
      const isOctubre = p.fechaISO.substring(5, 7) === '10';
      if (isOctubre && puntosPrev.length > 0) {
        return { ...p, mes: 'Mes actual' };
      }
      return p;
    });

    // 3. Combinar cronológicamente
    const puntosTotales = [...puntosPrev, ...puntosCurrAjustados];
    puntosTotales.sort((a, b) => a.fechaISO.localeCompare(b.fechaISO));

    // Determinar origen y hoja descrita
    let origen: 'SHEETS' | 'DATABASE' = currYearData.origen;
    let hoja = currYearData.hoja;

    if (puntosPrev.length > 0 && prevYearData) {
      if (currYearData.origen === 'SHEETS' && prevYearData.origen === 'SHEETS') {
        origen = 'SHEETS';
        hoja = \`\${prevYearData.hoja} y \${currYearData.hoja}\`;
      } else if (currYearData.origen === 'DATABASE' && prevYearData.origen === 'DATABASE') {
        origen = 'DATABASE';
        hoja = 'Base de Datos (PostgreSQL)';
      } else {
        origen = 'SHEETS';
        hoja = \`Híbrido (\${prevYearData.origen === 'SHEETS' ? prevYearData.hoja : 'BD ' + (year - 1)} / \${currYearData.origen === 'SHEETS' ? currYearData.hoja : 'BD ' + year})\`;
      }
    }

    const result = this.buildResponse(year, origen, hoja, puntosTotales);
    this.cacheSaldoAnual.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  private async fetchRawPuntosForYear(
    year: number
  ): Promise<{ puntos: SaldoPunto[]; origen: 'SHEETS' | 'DATABASE'; hoja: string }> {
    const sheetId = await sheetConfigService.getSheetIdForYear(year);
    if (sheetId) {
      return this.fetchRawFromGoogleSheets(year, sheetId);
    } else {
      return this.fetchRawFromDatabase(year);
    }
  }

  private async fetchRawFromGoogleSheets(
    year: number,
    sheetId: string
  ): Promise<{ puntos: SaldoPunto[]; origen: 'SHEETS'; hoja: string }> {
    let sheetName = \`Saldo \${year}\`;
    let rows: any[][] = [];

    try {
      const url = \`https://sheets.googleapis.com/v4/spreadsheets/\${sheetId}/values/\${encodeURIComponent(sheetName + '!A1:D350')}?key=\${this.apiKey}\`;
      const res = await (globalThis as any).fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const json = await res.json();
        if (json?.values) {
          rows = json.values;
        }
      }
    } catch {
      // Fallback a la hoja genérica "Saldo"
      try {
        sheetName = 'Saldo';
        const urlFallback = \`https://sheets.googleapis.com/v4/spreadsheets/\${sheetId}/values/\${encodeURIComponent('Saldo!A1:D350')}?key=\${this.apiKey}\`;
        const resFb = await (globalThis as any).fetch(urlFallback, { signal: AbortSignal.timeout(10000) });
        if (resFb.ok) {
          const jsonFb = await resFb.json();
          if (jsonFb?.values) {
            rows = jsonFb.values;
          }
        }
      } catch (fbErr: any) {
        console.warn(\`[ReportesService] Error al consultar Google Sheets para \${year}:\`, fbErr.message);
      }
    }

    const puntos: SaldoPunto[] = [];
    let currentMes = 'General';

    for (const row of rows) {
      if (!row || row.length === 0) continue;
      const col0 = String(row[0] || '').trim();

      // Detección de encabezado de mes
      const mesEncontrado = MESES_NOMBRES.find(
        (m) => col0.toLowerCase() === m.toLowerCase() || col0.toLowerCase().startsWith(m.toLowerCase())
      );
      if (mesEncontrado) {
        currentMes = mesEncontrado;
        continue;
      }

      // Si es un encabezado o fila de año
      if (col0.toLowerCase().includes('fecha') || col0.toLowerCase().includes('saldo') || col0 === String(year) || col0 === String(year - 1)) {
        continue;
      }

      const fechaParsed = parseFecha(col0, year);
      if (!fechaParsed) continue;

      const saldoPesos = parseMonto(row[1]);
      const saldoUSD = parseMonto(row[2]);
      const deuda = parseMonto(row[3]);

      puntos.push({
        fecha: fechaParsed.fechaStr,
        fechaISO: fechaParsed.fechaISO,
        mes: currentMes,
        saldoPesos,
        saldoUSD,
        deuda,
      });
    }

    return { puntos, origen: 'SHEETS', hoja: sheetName };
  }

  private async fetchRawFromDatabase(
    year: number
  ): Promise<{ puntos: SaldoPunto[]; origen: 'DATABASE'; hoja: string }> {
    const configs = await prisma.monthlyEstimateConfig.findMany({
      where: { year },
      include: {
        dailyRows: {
          orderBy: { fecha: 'asc' },
        },
      },
      orderBy: { mes: 'asc' },
    });

    const puntos: SaldoPunto[] = [];

    for (const cfg of configs) {
      for (const fila of cfg.dailyRows) {
        const fechaD = new Date(fila.fecha);
        const day = String(fechaD.getUTCDate()).padStart(2, '0');
        const month = String(fechaD.getUTCMonth() + 1).padStart(2, '0');
        const y = fechaD.getUTCFullYear();

        const saldoPesos = Number(fila.real ?? fila.saldoPesos);
        const cotizacion = fila.cotizacionUSD ? Number(fila.cotizacionUSD) : 0;
        const saldoUSD = cotizacion > 0 ? Number((saldoPesos / cotizacion).toFixed(2)) : 0;
        const deuda = Number(fila.deudaReal ?? fila.deuda);

        puntos.push({
          fecha: \`\${day}/\${month}/\${y}\`,
          fechaISO: \`\${y}-\${month}-\${day}\`,
          mes: cfg.nombreMes,
          saldoPesos,
          saldoUSD,
          deuda,
        });
      }
    }

    return { puntos, origen: 'DATABASE', hoja: 'Base de Datos (PostgreSQL)' };
  }

  private buildResponse(
    year: number,
    origen: 'SHEETS' | 'DATABASE',
    hoja: string,
    puntos: SaldoPunto[]
  ): ReporteSaldoAnualResponse {
    // Preservar orden cronológico de meses únicos
    const mesesUnicos: string[] = [];
    for (const p of puntos) {
      if (!mesesUnicos.includes(p.mes)) {
        mesesUnicos.push(p.mes);
      }
    }

    const pesosVals = puntos.map((p) => p.saldoPesos);
    const usdVals = puntos.map((p) => p.saldoUSD);

    const ultimoPunto = puntos.length > 0 ? puntos[puntos.length - 1] : null;

    const metrics = {
      ultimoSaldoPesos: ultimoPunto ? ultimoPunto.saldoPesos : 0,
      ultimoSaldoUSD: ultimoPunto ? ultimoPunto.saldoUSD : 0,
      ultimaDeuda: ultimoPunto ? ultimoPunto.deuda : 0,
      saldoMaxPesos: pesosVals.length > 0 ? Math.max(...pesosVals) : 0,
      saldoMinPesos: pesosVals.length > 0 ? Math.min(...pesosVals) : 0,
      saldoMaxUSD: usdVals.length > 0 ? Math.max(...usdVals) : 0,
      saldoMinUSD: usdVals.length > 0 ? Math.min(...usdVals) : 0,
      totalPuntos: puntos.length,
    };

    return {
      year,
      origen,
      hoja,
      mesesDisponibles: mesesUnicos,
      puntos,
      metrics,
    };
  }

`;

code = code.substring(0, idxStart) + newImplementation + code.substring(idxEnd);
fs.writeFileSync(filePath, code, 'utf8');
console.log('SUCCESS: reportes.service.ts patched with multi-year stitching!');
