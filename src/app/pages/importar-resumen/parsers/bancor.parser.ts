import { Movement, EntityParserStrategy } from '../models';
import {
  cleanCell,
  extractLastNumber,
  isDateValue,
  isHTML,
  moneyToNumber,
  normalizeCuotas,
  normalizeHeader,
} from './parse-utils';

export class BancorParser implements EntityParserStrategy {
  /**
   * Parsea resumen de tarjeta de crédito Bancor (Banco de Córdoba).
   * Procesa cuotas (C.04/04), pagos negativos (380.000,00-), comprobantes e impuestos.
   */
  parseSummary(text: string): Movement[] {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const out: Movement[] = [];

    // Coincide con fechas como 13.07.26, 13/07/26, 31.03.2026, 31/03/2026
    const dateRe = /^(\d{2}[./]\d{2}[./]\d{2,4})\s+(.+)$/;

    for (const line of lines) {
      // Ignorar divisores, totales, cabeceras del resumen de Bancor
      if (/^[_=\-]{3,}$/.test(line)) continue;
      if (
        /^(FECHA\s+COMPROBANTE|SALDO\s+ANTERIOR|SALDO\s+ACTUAL|PAGO\s+MINIMO|TARJETA\s+\d+.*Total|Total\s+Consumos|Página\s+\d+|TITULAR\s+DE|CIERRE\s+ACTUAL|VTO\.\s+ANTERIOR|LIMITES:|Cuotas\s+a\s+vencer|Abone\s+su|Ud\.?\s*también|\*\s*El\s+valor)/i.test(
          line
        )
      ) {
        continue;
      }

      const dm = line.match(dateRe);
      if (!dm) continue;

      const fecha = dm[1];
      let rest = dm[2].trim();

      // Extraer cuotas (en Bancor vienen como C.04/04, C. 04/04, C.01/03)
      let cuotas = '01/01';
      const cuotaMatch = rest.match(/\bC\.?\s*(\d{1,2}\/\d{1,2})\b/i);
      if (cuotaMatch) {
        cuotas = normalizeCuotas(cuotaMatch[1]);
        rest = rest.replace(cuotaMatch[0], '').trim();
      } else {
        const genericCuota = rest.match(/\b(\d{1,2}\/\d{1,2})\b/);
        if (genericCuota) {
          cuotas = normalizeCuotas(genericCuota[1]);
          rest = rest.replace(genericCuota[0], '').trim();
        }
      }

      // Buscar importes al final de la línea (pesos y dólares)
      const moneyRegex = /(-?\s*[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}-?)\s*/g;
      const matches = Array.from(rest.matchAll(moneyRegex));

      if (!matches.length) continue;

      let pesos: number | null = null;
      let dolares: number | null = null;

      // Extraer números contiguos al final de la línea
      const tailMatches: { raw: string; index: number }[] = [];
      let expectedEnd = rest.length;

      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const mStart = m.index ?? 0;
        const mEnd = mStart + m[0].length;
        if (mEnd >= expectedEnd - 2) {
          tailMatches.unshift({ raw: m[1], index: mStart });
          expectedEnd = mStart;
        } else {
          break;
        }
      }

      if (tailMatches.length >= 2) {
        dolares = moneyToNumber(tailMatches[tailMatches.length - 1].raw);
        pesos = moneyToNumber(tailMatches[tailMatches.length - 2].raw);
        rest = rest.substring(0, tailMatches[tailMatches.length - 2].index).trim();
      } else if (tailMatches.length === 1) {
        pesos = moneyToNumber(tailMatches[0].raw);
        rest = rest.substring(0, tailMatches[0].index).trim();
      } else {
        const lastMatch = matches[matches.length - 1];
        pesos = moneyToNumber(lastMatch[1]);
        rest = rest.substring(0, lastMatch.index).trim();
      }

      // Eliminar número de comprobante inicial (4 a 8 dígitos justo después de la fecha)
      rest = rest.replace(/^(\d{4,8})\s+/, '').trim();

      const referencia = cleanCell(rest);

      if (referencia || pesos !== null || dolares !== null) {
        out.push({ fecha, referencia, cuotas, pesos, dolares });
      }
    }

    return out;
  }

  /**
   * Parsea movimientos copiados de la web de Bancón / Bancor.
   * Soporta tanto código HTML (tabla de acordión de movimientos) como texto plano / copiado de tabla.
   */
  parseMovements(text: string): Movement[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    if (isHTML(trimmed)) {
      return this.parseMovementsHTML(trimmed);
    }

    return this.parseMovementsText(trimmed);
  }

  /**
   * Parsea el HTML del acordión de movimientos de Bancón:
   * <table class="regular-table contextual-table">
   *   <p class="bold-text">BUENOS DIAS 01/04</p>
   *   <p class="light-text"><span ...>04/09/2026</span></p>
   *   <td>$ 7.439,49</td>
   */
  private parseMovementsHTML(html: string): Movement[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const trs = Array.from(doc.querySelectorAll('tbody tr, table tr'));
    const out: Movement[] = [];

    for (const tr of trs) {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (!tds.length) continue;

      // 1. Detalle / Comercio: suele estar en p.bold-text o en tds[0]
      const boldEl = tr.querySelector('p.bold-text');
      let detalle = cleanCell(boldEl?.textContent ?? tds[0]?.textContent ?? '');

      // 2. Fecha: buscar en span de p.light-text o dentro del td
      let fecha = '';
      const dateEl = tr.querySelector('p.light-text span, td span');
      if (dateEl && isDateValue(dateEl.textContent ?? '')) {
        fecha = cleanCell(dateEl.textContent ?? '');
      } else {
        const dateMatch = (tds[0]?.textContent ?? '').match(/\b(\d{2}[./]\d{2}[./]\d{2,4})\b/);
        if (dateMatch) {
          fecha = dateMatch[1];
        }
      }

      // Si el detalle incluye la fecha (por no haber encontrado p.bold-text), removerla
      if (fecha && detalle.includes(fecha)) {
        detalle = cleanCell(detalle.replace(fecha, ''));
      }

      // 3. Importes: td[1]
      const amountCell = cleanCell(tds[1]?.textContent ?? '');
      const isUsd = /USD/i.test(amountCell);
      const pesos = isUsd ? null : moneyToNumber(amountCell);
      const dolares = isUsd ? moneyToNumber(amountCell) : null;

      // 4. Cuotas: buscar al final del detalle o formato "01/04", "01 de 04", "C.01/04"
      let cuotas = '01/01';
      const isPayment = /pago/i.test(detalle);

      const cuotaMatch =
        detalle.match(/\b(?:c\.?\s*)?(\d{1,2}\/\d{1,2})\b/i) ||
        detalle.match(/\b(\d{1,2}\s*de\s*\d{1,2})\b/i);

      if (cuotaMatch) {
        cuotas = normalizeCuotas(cuotaMatch[0]);
        // Quitar la cuota del texto de la referencia para que quede limpia
        detalle = detalle.replace(cuotaMatch[0], '').trim();
      } else if (isPayment) {
        // Los pagos no llevan cuotas para no distorsionar el resumen
        cuotas = '';
      }

      const referencia = cleanCell(detalle);
      if (referencia || pesos !== null || dolares !== null) {
        out.push({ fecha, referencia, cuotas, pesos, dolares });
      }
    }

    return out;
  }

  /**
   * Parsea movimientos copiados como texto plano o celdas separadas por tabulaciones.
   */
  private parseMovementsText(text: string): Movement[] {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const out: Movement[] = [];

    for (const line of lines) {
      if (this.looksLikeHeader(line)) continue;

      const tabCells = line.split('\t').map(c => cleanCell(c));
      if (tabCells.length > 1) {
        const mov = this.parseMovementRow(tabCells);
        if (mov) out.push(mov);
        continue;
      }

      const spaceParts = line.split(/\s{2,}/).map(c => cleanCell(c));
      if (spaceParts.length > 1) {
        const mov = this.parseMovementRow(spaceParts);
        if (mov) out.push(mov);
      }
    }

    return out;
  }

  private looksLikeHeader(line: string): boolean {
    const n = normalizeHeader(line);
    return n.includes('fecha') && (n.includes('descripcion') || n.includes('detalle') || n.includes('importe'));
  }

  private parseMovementRow(cells: string[]): Movement | null {
    const dateIdx = cells.findIndex(c => isDateValue(c));
    if (dateIdx === -1) return null;

    const fecha = cells[dateIdx];
    const rest = cells.filter((_, idx) => idx !== dateIdx);

    let cuotas = '01/01';
    let pesos: number | null = null;
    let dolares: number | null = null;
    const descParts: string[] = [];

    for (const cell of rest) {
      if (/^c\.?\s*\d{1,2}\/\d{1,2}$/i.test(cell) || /^\d{1,2}\s*(?:de|\/)\s*\d{1,2}$/i.test(cell)) {
        cuotas = normalizeCuotas(cell);
        continue;
      }
      if (/^-?\s*(?:USD\s*)?\$?\s*[0-9][0-9\.\,]*$/.test(cell)) {
        const isUsd = /USD/i.test(cell);
        const amt = moneyToNumber(cell);
        if (amt !== null) {
          if (isUsd) dolares = amt;
          else if (pesos === null) pesos = amt;
          else dolares = amt;
        }
        continue;
      }
      descParts.push(cell);
    }

    let detalle = descParts.join(' ').trim();
    const cuotaMatch = detalle.match(/\b(?:c\.?\s*)?(\d{1,2}\/\d{1,2})\b/i);
    if (cuotaMatch && cuotas === '01/01') {
      cuotas = normalizeCuotas(cuotaMatch[0]);
      detalle = detalle.replace(cuotaMatch[0], '').trim();
    }

    if (/pago/i.test(detalle)) {
      cuotas = '';
    }

    const referencia = cleanCell(detalle);
    if (!referencia && pesos === null && dolares === null) return null;

    return { fecha, referencia, cuotas, pesos, dolares };
  }
}
