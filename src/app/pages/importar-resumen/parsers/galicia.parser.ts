import { Movement, EntityParserStrategy } from '../models';
import {
  cleanCell,
  extractLastNumber,
  isDateValue,
  moneyToNumber,
  normalizeCuotas,
  normalizeHeader,
  pad2,
} from './parse-utils';

export class GaliciaParser implements EntityParserStrategy {
  /**
   * Parsea movimientos copiados desde la web (online banking) de Galicia (Visa o Mastercard).
   * Soporta tanto formato vertical (línea por línea) como formato tabular (separado por tabs).
   */
  parseMovements(text: string): Movement[] {
    const rawLines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (!rawLines.length) return [];

    // Si tiene líneas con tabs, procesar como tabla
    const hasTabs = rawLines.some(l => l.includes('\t'));
    if (hasTabs) {
      return this.parseTabularMovements(rawLines);
    }

    return this.parseVerticalMovements(rawLines);
  }

  /**
   * Formato vertical: cada movimiento arranca con una fecha (DD/MM/YYYY)
   * Seguido de Tarjeta (ej: Visa 1564), Descripción, Cuotas (1 de 3), e Importes ($ ...).
   */
  private parseVerticalMovements(lines: string[]): Movement[] {
    const out: Movement[] = [];
    let currentBlock: string[] = [];

    const flushBlock = (block: string[]) => {
      if (!block.length) return;
      const mov = this.buildMovementFromVerticalBlock(block);
      if (mov) out.push(mov);
    };

    for (const line of lines) {
      // Ignorar cabeceras y totales
      if (this.isHeaderOrFooter(line)) {
        if (/^total$/i.test(line) && currentBlock.length) {
          flushBlock(currentBlock);
          currentBlock = [];
        }
        continue;
      }

      if (isDateValue(line)) {
        if (currentBlock.length) {
          flushBlock(currentBlock);
        }
        currentBlock = [line];
      } else if (currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length) {
      flushBlock(currentBlock);
    }

    return out;
  }

  private buildMovementFromVerticalBlock(block: string[]): Movement | null {
    const [fecha, ...rest] = block;
    if (!isDateValue(fecha)) return null;

    let tarjeta = '';
    let cuotas = '01/01';
    let pesos: number | null = null;
    let dolares: number | null = null;
    const descParts: string[] = [];

    for (const item of rest) {
      const trimmed = cleanCell(item);
      if (!trimmed) continue;

      // 1. Detección de tarjeta: "Visa 1564", "Mastercard 1234", etc.
      if (this.isCardLine(trimmed)) {
        tarjeta = trimmed;
        continue;
      }

      // 2. Detección de cuotas: "1 de 3", "02 de 06", "1/3"
      if (this.isCuotasLine(trimmed)) {
        cuotas = normalizeCuotas(trimmed);
        continue;
      }

      // 3. Detección de importe (pesos o dólares)
      if (this.isMoneyLine(trimmed)) {
        const isUsd = /USD/i.test(trimmed);
        const amount = moneyToNumber(trimmed);
        if (amount !== null) {
          if (isUsd) {
            dolares = amount;
          } else if (pesos === null) {
            pesos = amount;
          } else {
            // Segundo importe sin marca USD suele ser dólares o viceversa
            dolares = amount;
          }
        }
        continue;
      }

      // 4. Si no es tarjeta, ni cuota, ni dinero, es descripción
      descParts.push(trimmed);
    }

    const referencia = descParts.join(' ').trim();
    if (!referencia && pesos === null && dolares === null) {
      return null;
    }

    // Para el caso de Galicia: si es "Pago de tu tarjeta" o pago similar, dejar cuota vacía
    if (/pago\s+(?:de\s+)?(?:tu|su)?\s*tarjeta/i.test(referencia) || /^pago\b/i.test(referencia)) {
      cuotas = '';
    }

    return {
      fecha,
      referencia,
      cuotas,
      pesos,
      dolares,
    };
  }

  private parseTabularMovements(lines: string[]): Movement[] {
    const out: Movement[] = [];

    for (const line of lines) {
      const cells = line.split('\t').map(c => cleanCell(c));
      if (!cells.length) continue;

      // Buscar celda con fecha
      const dateIdx = cells.findIndex(c => isDateValue(c));
      if (dateIdx === -1) continue;

      const fecha = cells[dateIdx];
      const remainingCells = cells.slice(dateIdx + 1).filter(Boolean);

      let cuotas = '01/01';
      let pesos: number | null = null;
      let dolares: number | null = null;
      const descParts: string[] = [];

      for (const cell of remainingCells) {
        if (this.isCardLine(cell)) continue;
        if (this.isCuotasLine(cell)) {
          cuotas = normalizeCuotas(cell);
          continue;
        }
        if (this.isMoneyLine(cell)) {
          const isUsd = /USD/i.test(cell);
          const amount = moneyToNumber(cell);
          if (amount !== null) {
            if (isUsd) dolares = amount;
            else if (pesos === null) pesos = amount;
            else dolares = amount;
          }
          continue;
        }
        descParts.push(cell);
      }

      const referencia = descParts.join(' ').trim();
      if (/pago\s+(?:de\s+)?(?:tu|su)?\s*tarjeta/i.test(referencia) || /^pago\b/i.test(referencia)) {
        cuotas = '';
      }

      if (referencia || pesos !== null || dolares !== null) {
        out.push({ fecha, referencia, cuotas, pesos, dolares });
      }
    }

    return out;
  }

  /**
   * Parsea resumen descargado en PDF de Galicia (Visa o Mastercard).
   * Procesa compras nacionales e internacionales, cuotas, pagos, transferencias e impuestos.
   */
  parseSummary(text: string): Movement[] {
    const lines = text
      .split(/\r?\n/)
      .map(l => cleanCell(l))
      .filter(Boolean);

    const out: Movement[] = [];
    let currentSection: 'HEADER' | 'COMPRAS' | 'DETALLE' | 'CUOTAS' = 'HEADER';

    // Coincide con fechas DD-Mmm-AA, DD-Mmm-AAAA, DD/MM/AA, DD/MM/AAAA, DD.MM.AA, etc.
    const dateRe = /^(\d{2}[./-](?:[A-Za-z]{3}|\d{2})[./-]\d{2,4})\s+(.+)$/i;

    for (const line of lines) {
      // Detección de secciones del resumen Galicia
      if (/^COMPRAS\s+DEL\s+MES$/i.test(line) || /^COMPRAS\s+EN\s+EL\s+EXTERIOR$/i.test(line)) {
        currentSection = 'COMPRAS';
        continue;
      }
      if (/^CUOTAS?\s+DEL\s+MES$/i.test(line)) {
        currentSection = 'CUOTAS';
        continue;
      }
      if (/^DETALLE\s+DEL\s+CONSUMO/i.test(line)) {
        if (currentSection !== 'CUOTAS') {
          currentSection = 'DETALLE';
        }
        continue;
      }

      if (this.isSummaryIgnoredLine(line)) {
        continue;
      }

      const dm = line.match(dateRe);
      if (dm) {
        const fecha = dm[1];
        let rest = dm[2].trim();

        // 1. Pagos de tarjeta: "SU PAGO -490.000,00-490.000,00"
        if (/^(?:su\s+)?pago\b/i.test(rest) || /pago\s+(?:de\s+)?(?:tu|su)?\s*tarjeta/i.test(rest)) {
          const moneyMatches = Array.from(
            rest.matchAll(/(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?|-?\s*[0-9]+,[0-9]{2}-?)/g)
          );
          let amount = moneyMatches.length ? moneyToNumber(moneyMatches[0][0]) : null;
          if (amount !== null && amount > 0) {
            amount = -amount;
          }
          let referencia = rest.replace(/(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?|-?\s*[0-9]+,[0-9]{2}-?)/g, '').trim();
          referencia = cleanCell(referencia) || 'SU PAGO';

          out.push({
            fecha,
            referencia,
            cuotas: '',
            pesos: amount,
            dolares: null,
          });
          continue;
        }

        // 2. Transferencia de financiamiento: "TRANSFER FINANC. PESOS 11.592,40" o "-7,94"
        if (/^TRANSFER\s+FINANC/i.test(rest)) {
          const moneyMatches = Array.from(
            rest.matchAll(/(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?|-?\s*[0-9]+,[0-9]{2}-?)/g)
          );
          const referencia = cleanCell(
            rest.replace(/(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?|-?\s*[0-9]+,[0-9]{2}-?)/g, '')
          );

          if (moneyMatches.length >= 2) {
            const pesos = moneyToNumber(moneyMatches[0][0]);
            const dolares = moneyToNumber(moneyMatches[1][0]);
            out.push({ fecha, referencia, cuotas: '01/01', pesos, dolares });
          } else if (moneyMatches.length === 1) {
            const amount = moneyToNumber(moneyMatches[0][0]);
            const lastMov = out[out.length - 1];
            // Si la línea anterior fue un TRANSFER FINANC. PESOS en pesos y esta línea tiene el contraasiento en dólares (negativo)
            if (
              lastMov &&
              lastMov.fecha === fecha &&
              /^TRANSFER\s+FINANC/i.test(lastMov.referencia) &&
              lastMov.dolares === null &&
              amount !== null &&
              amount < 0
            ) {
              lastMov.dolares = amount;
            } else {
              out.push({ fecha, referencia, cuotas: '01/01', pesos: amount, dolares: null });
            }
          }
          continue;
        }

        // 3. Compras del mes (en el exterior / dólares):
        // "GOOGLE *Google O(USA,USD, 2,99) 00202 2,99"
        if (currentSection === 'COMPRAS') {
          const foreignMatch = rest.match(
            /^(.*?)(?:\((.*?)\))?\s*(\d{4,8})\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})$/
          );
          if (foreignMatch) {
            const desc = cleanCell(foreignMatch[1]);
            const amount = moneyToNumber(foreignMatch[4]);
            out.push({
              fecha,
              referencia: desc,
              cuotas: '01/01',
              pesos: null,
              dolares: amount,
            });
            continue;
          }
        }

        // 4. Cuotas del mes con comprobante intermedio:
        // "MERPAGO*TIENDANEXT 13/18 05082 10.255,13"
        const cuotaLineMatch = rest.match(
          /^(.*?)\s+(\d{1,2}\/\d{1,2})\s+(\d{4,8})\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})(?:\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}))?$/
        );
        if (cuotaLineMatch) {
          const [cNum, cDen] = cuotaLineMatch[2].split('/').map(Number);
          const isLikelyCuota =
            currentSection === 'CUOTAS' ||
            (cDen <= 24 && cNum <= cDen);

          if (isLikelyCuota) {
            const desc = cleanCell(cuotaLineMatch[1]);
            const cuotas = normalizeCuotas(cuotaLineMatch[2]);
            const pesos = moneyToNumber(cuotaLineMatch[4]);
            const dolares = cuotaLineMatch[5] ? moneyToNumber(cuotaLineMatch[5]) : null;
            out.push({ fecha, referencia: desc, cuotas, pesos, dolares });
            continue;
          }
        }

        // 5. Detalle del consumo (compras en 1 pago con comprobante):
        // "CP*FACTURAS CLARO 09378 84.255,45"
        // "MERPAGO*MELI 12/25 05263 18.399,00"
        if (currentSection === 'DETALLE') {
          const singlePayMatch = rest.match(
            /^(.*?)\s+(\d{4,8})\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})(?:\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}))?$/
          );
          if (singlePayMatch) {
            const desc = cleanCell(singlePayMatch[1]);
            const pesos = moneyToNumber(singlePayMatch[3]);
            const dolares = singlePayMatch[4] ? moneyToNumber(singlePayMatch[4]) : null;
            out.push({ fecha, referencia: desc, cuotas: '01/01', pesos, dolares });
            continue;
          }
        }

        // 6. Formato genérico / Visa Galicia:
        let cuotas = '01/01';
        const cuotaMatch =
          rest.match(/\bcuota\s*(\d{1,2}\/\d{1,2})\b/i) ||
          rest.match(/\bc\.?\s*(\d{1,2}\/\d{1,2})\b/i) ||
          rest.match(/\b(\d{1,2}\s*de\s*\d{1,2})\b/i) ||
          (currentSection === 'CUOTAS' && rest.match(/\b(\d{1,2}\/\d{1,2})\b/));

        if (cuotaMatch) {
          cuotas = normalizeCuotas(cuotaMatch[1]);
          rest = rest.replace(cuotaMatch[0], '').trim();
        }

        const moneyMatches = Array.from(
          rest.matchAll(/(-?\s*\$?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?|-?\s*\$?\s*[0-9]+,[0-9]{2}-?)/g)
        );

        let pesos: number | null = null;
        let dolares: number | null = null;

        if (moneyMatches.length >= 2) {
          const last1 = moneyMatches[moneyMatches.length - 1];
          const last2 = moneyMatches[moneyMatches.length - 2];
          dolares = moneyToNumber(last1[0]);
          pesos = moneyToNumber(last2[0]);
          rest = rest.slice(0, last2.index).trim();
        } else if (moneyMatches.length === 1) {
          const last = moneyMatches[0];
          pesos = moneyToNumber(last[0]);
          rest = rest.slice(0, last.index).trim();
        }

        rest = rest.replace(/^\d{4,8}\s+/, '').trim();
        rest = rest.replace(/\s+\d{4,8}$/, '').trim();

        const referencia = cleanCell(rest);
        if (referencia || pesos !== null || dolares !== null) {
          out.push({ fecha, referencia, cuotas, pesos, dolares });
        }
        continue;
      }

      // Líneas sin fecha (Impuestos, intereses y cargos en CABECERA)
      if (currentSection === 'HEADER') {
        const taxMatch = line.match(
          /^([A-Za-z0-9\.\%\/\,\-\s]+?)\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})(?:\s+(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}))?$/
        );
        if (taxMatch) {
          const referencia = cleanCell(taxMatch[1]);
          if (!this.isSummaryIgnoredLine(referencia)) {
            const pesos = moneyToNumber(taxMatch[2]);
            const dolares = taxMatch[3] ? moneyToNumber(taxMatch[3]) : null;
            out.push({
              fecha: '',
              referencia,
              cuotas: '01/01',
              pesos,
              dolares,
            });
          }
        }
      }
    }

    return out;
  }

  private isSummaryIgnoredLine(line: string): boolean {
    return (
      /^CONSOLIDADO\b/i.test(line) ||
      /^DETALLE\s+DEL\s+CONSUMO/i.test(line) ||
      /^FECHA\s+(REFERENCIA|COMPROBANTE|DETALLE)/i.test(line) ||
      /^Resumen\s+N[°o]\b/i.test(line) ||
      /^Tarjeta\s+(?:de\s+)?Cr[ée]dito/i.test(line) ||
      /^(?:MASTERCARD|VISA|AMERICAN\s+EXPRESS|AMEX)\b/i.test(line) ||
      /CUIT\s+Banco/i.test(line) ||
      /N[°o]\s+de\s+Socio/i.test(line) ||
      /^P[áa]gina\s+\d+/i.test(line) ||
      /^\d{10,}[A-Za-z0-9]*$/.test(line) ||
      /^SALDO\s+(ANTERIOR|PENDIENTE|ACTUAL)/i.test(line) ||
      /^TOTAL\s+(CONSUMOS|A\s+PAGAR|FINANCIADO)/i.test(line) ||
      /^SUBTOTAL\b/i.test(line) ||
      /^PAGO\s+MINIMO/i.test(line) ||
      /^LIMITES\b/i.test(line)
    );
  }

  private isCardLine(value: string): boolean {
    return /^(?:visa|mastercard|master|amex|american express|tarjeta)\b/i.test(value);
  }

  private isCuotasLine(value: string): boolean {
    return /^\d{1,2}\s*(?:de|\/)\s*\d{1,2}$/i.test(value);
  }

  private isMoneyLine(value: string): boolean {
    const v = value.trim();
    return (
      /^-?\s*\$?\s*[0-9][0-9\.\,]*$/.test(v) ||
      /^-?\s*USD\s*[0-9][0-9\.\,]*$/i.test(v) ||
      /^USD\s*0$/i.test(v)
    );
  }

  private isHeaderOrFooter(value: string): boolean {
    const v = normalizeHeader(value);
    return (
      v === 'fecha' ||
      v === 'tarjeta' ||
      v === 'descripcion' ||
      v === 'cuotas' ||
      v === 'importe en pesos' ||
      v === 'importe en dolares' ||
      v === 'total' ||
      /^usd\s*0$/i.test(v)
    );
  }
}
