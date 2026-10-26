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

export class GeneralParser implements EntityParserStrategy {
  parseSummary(input: string): Movement[] {
    if (isHTML(input)) {
      return this.parseHTML(input);
    }
    return this.parseText(input);
  }

  parseMovements(input: string): Movement[] {
    if (isHTML(input)) {
      return this.parseMovementsTableHTML(input);
    }

    const textResult = this.parseMovementsTableText(input);
    if (textResult.length) {
      return textResult;
    }

    return this.parseMovementsVerticalText(input);
  }

  parseHTML(html: string): Movement[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const trs = Array.from(doc.querySelectorAll('tbody tr, table tr'));
    const out: Movement[] = [];

    trs.forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (!tds.length) return;

      let detalle = (tr.querySelector('p.bold-text')?.textContent ?? tds[0]?.textContent ?? '').trim();
      const fecha = (tr.querySelector('span')?.textContent ?? '').trim();

      const amountCell = (tds[1]?.textContent ?? '').trim();
      const usdInCell = /USD/i.test(amountCell);
      const amountRaw = extractLastNumber(amountCell);
      let pesos: number | null = null;
      let dolares: number | null = null;
      if (usdInCell) dolares = moneyToNumber(amountRaw);
      else pesos = moneyToNumber(amountRaw);

      const m = detalle.match(/(\d{2}\/\d{2})$/);
      let cuotas = '01/01';
      if (m) {
        cuotas = normalizeCuotas(m[1]);
        detalle = detalle.slice(0, -m[1].length).trim();
      }

      if (detalle || fecha || pesos !== null || dolares !== null) {
        out.push({ fecha, referencia: detalle, cuotas, pesos, dolares });
      }
    });

    return out;
  }

  parseText(text: string): Movement[] {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const out: Movement[] = [];
    let section: 'COMPRAS' | 'DETALLE' | 'CUOTAS' | 'CABECERA' | null = 'CABECERA';

    const dateRe = /^(\d{2}[./-][A-Za-z]{3}[./-]\d{2}|\d{2}[./-]\d{2}[./-]\d{4}|\d{2}[./-]\d{2}[./-]\d{2})\s+(.+)$/i;

    for (const ln of lines) {
      if (/^COMPRAS DEL MES$/i.test(ln)) {
        section = 'COMPRAS';
        continue;
      }
      if (/^DETALLE DEL CONSUMO/i.test(ln)) {
        section = 'DETALLE';
        continue;
      }
      if (/^CUOTAS?\s+DEL\s+MES$/i.test(ln)) {
        section = 'CUOTAS';
        continue;
      }

      if (/^(Resumen N°|Tarjeta Crédito|MASTERCARD|VISA|LESCANO|MANZANA|Página|TOTAL A PAGAR|SUBTOTAL|FECHA\s+REFERENCIA)/i.test(ln)) {
        continue;
      }

      if (section === 'CABECERA' && /[0-9]/.test(ln) && !dateRe.test(ln)) {
        const m = ln.match(/^(.+?)\s+([0-9\.\,]+)(?:\s+([0-9\.\,]+))?$/);
        if (m) {
          const referencia = m[1].trim();
          if (/^\$+$/.test(referencia)) continue;
          const pesos = moneyToNumber(m[2]);
          const dolares = moneyToNumber(m[3] ?? '');
          out.push({ fecha: '', referencia, cuotas: '01/01', pesos, dolares });
        }
        continue;
      }

      const dm = ln.match(dateRe);
      if (dm) {
        const fecha = dm[1];
        let rest = dm[2];

        if (section === 'COMPRAS') {
          const usd = /USD/i.test(rest);
          const ars = /ARS/i.test(rest);

          let pesos: number | null = null;
          if (ars) {
            const arsNum = rest.match(/ARS[^0-9]*([0-9\.\,]+)/i)?.[1] ?? '';
            pesos = moneyToNumber(arsNum);
          }

          let dolares: number | null = null;
          if (usd) {
            const lastNum = extractLastNumber(rest);
            dolares = moneyToNumber(lastNum);
          }

          let referencia = rest.replace(/\(.*?\)/g, '').trim();
          referencia = referencia.replace(/\s\d{3,6}\s[0-9\.\,]+$/, '').trim();

          out.push({ fecha, referencia, cuotas: '01/01', pesos, dolares });
          continue;
        }

        const textCuota = rest.match(/\b(Zeta|Deb\.?Aut\.?)\b/i)?.[1] ?? '';
        const cuotaMatch =
          textCuota ||
          rest.match(/Cuota\s+(\d{1,2}\s*\/\s*\d{1,2})/i)?.[1] ||
          rest.match(/\b(\d{1,2}\s*de\s*\d{1,2})\b/i)?.[1] ||
          rest.match(/\b(\d{1,2}\s*\/\s*\d{1,2})\b/)?.[1];

        const cuotas = textCuota ? textCuota : normalizeCuotas(cuotaMatch ?? '');

        const lastNum = extractLastNumber(rest);
        const pesos = moneyToNumber(lastNum);
        let referencia = rest;

        referencia = referencia.replace(/Cuota\s+\d{1,2}\s*\/\s*\d{1,2}/i, '');
        referencia = referencia.replace(/\b\d{1,2}\s*de\s*\d{1,2}\b/i, '');
        referencia = referencia.replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, '');
        referencia = referencia.replace(/\b(Zeta|Deb\.?Aut\.?)\b/gi, '');
        referencia = referencia.replace(/\s+[0-9\.\,]+$/, '');
        referencia = referencia.replace(/^Naranja\s+X\s+\d{1,10}\s+/i, '');
        referencia = referencia.replace(/\s+\d{3,6}\*?$/, '');
        referencia = cleanCell(referencia);

        out.push({ fecha, referencia, cuotas, pesos, dolares: null });
        continue;
      }
    }

    return out;
  }

  private parseMovementsTableHTML(html: string): Movement[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll('th')).map(th => normalizeHeader(th.textContent ?? ''));
      if (!this.looksLikeMovementsTableHeader(headerCells)) continue;

      const rows = Array.from(table.querySelectorAll('tr'));
      const out = rows
        .map(row => Array.from(row.querySelectorAll('td')).map(cell => cleanCell(cell.textContent ?? '')))
        .map(cells => this.parseMovementsRow(cells))
        .filter((movement): movement is Movement => movement !== null);

      if (out.length) return out;
    }

    return [];
  }

  private parseMovementsTableText(text: string): Movement[] {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const out: Movement[] = [];
    let headerFound = false;

    for (const line of lines) {
      const tabCells = line.split(/\t+/).map(cell => cleanCell(cell));
      const normalizedTabCells = tabCells.map(cell => normalizeHeader(cell));

      if (!headerFound && this.looksLikeMovementsTableHeader(normalizedTabCells)) {
        headerFound = true;
        continue;
      }

      if (!headerFound && /^FECHA\s+.*CUOTA/i.test(line)) {
        headerFound = true;
        continue;
      }

      if (tabCells.length > 1) {
        const movement = this.parseMovementsRow(tabCells);
        if (movement) {
          out.push(movement);
        }
        continue;
      }

      if (!headerFound) continue;

      if (line.match(/^\d{2}\/\d{2}\/\d{2}\s+Naranja/i)) {
        const naranjaMovement = this.parseNaranjaRow(line);
        if (naranjaMovement) {
          out.push(naranjaMovement);
          continue;
        }
      }

      const fallbackMovement = this.parseMovementsRowFromPlainLine(line);
      if (fallbackMovement) {
        out.push(fallbackMovement);
      }
    }

    return out;
  }

  private parseMovementsVerticalText(text: string): Movement[] {
    const lines = text.split(/\r?\n/).map(line => line.trim());
    const out: Movement[] = [];
    let currentBlock: string[] = [];

    const flushBlock = () => {
      const movement = this.parseVerticalMovementBlock(currentBlock);
      if (movement) {
        out.push(movement);
      }
      currentBlock = [];
    };

    for (const line of lines) {
      if (isDateValue(line)) {
        if (currentBlock.length) {
          flushBlock();
        }
        currentBlock = [line];
        continue;
      }

      if (!line) continue;

      if (currentBlock.length) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length) {
      flushBlock();
    }

    return out;
  }

  private looksLikeMovementsTableHeader(cells: string[]): boolean {
    const joined = cells.join(' | ');
    return joined.includes('fecha') && joined.includes('descripcion') && joined.includes('importe en pesos');
  }

  private parseMovementsRow(cells: string[]): Movement | null {
    const cleaned = cells.map(cell => cleanCell(cell));
    if (!cleaned.length) return null;

    const fecha = cleaned[0] ?? '';
    if (!isDateValue(fecha)) return null;

    const referencia = cleaned[2] ?? '';
    const cuotasRaw = cleaned[3] ?? '';
    const pesosRaw = cleaned[4] ?? '';
    const dolaresRaw = cleaned[5] ?? '';

    return {
      fecha,
      referencia,
      cuotas: normalizeCuotas(cuotasRaw),
      pesos: moneyToNumber(pesosRaw),
      dolares: moneyToNumber(dolaresRaw),
    };
  }

  private parseNaranjaRow(line: string): Movement | null {
    const pattern = /^(\d{2}\/\d{2}\/\d{2})\s+Naranja\s+X\s+(\d{3,6})\s+(.+?)\s{2,}(.+?)\s{2,}([0-9.\,]+)$/i;
    const match = line.match(pattern);
    if (!match) return null;

    const fecha = match[1];
    const descripcion = match[3].trim();
    const cuotasRaw = match[4].trim();
    const monto = match[5];
    const cuotas = /^[a-z]/i.test(cuotasRaw) ? cuotasRaw : normalizeCuotas(cuotasRaw);

    return {
      fecha,
      referencia: descripcion,
      cuotas,
      pesos: moneyToNumber(monto),
      dolares: null,
    };
  }

  private parseMovementsRowFromPlainLine(line: string): Movement | null {
    const compact = cleanCell(line);
    const match = compact.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(-?\s*\$?\s*[0-9\.\,]+)?\s{2,}(-?\s*\$?\s*[0-9\.\,]+)?$/
    );
    if (!match) return null;

    return {
      fecha: match[1],
      referencia: match[3],
      cuotas: normalizeCuotas(match[4]),
      pesos: moneyToNumber(match[5] ?? ''),
      dolares: moneyToNumber(match[6] ?? ''),
    };
  }

  private parseVerticalMovementBlock(block: string[]): Movement | null {
    if (!block.length) return null;

    const [fecha, ...rawFields] = block;
    if (!isDateValue(fecha)) return null;

    const fields = rawFields.map(field => cleanCell(field)).filter(Boolean);
    if (!fields.length) return null;

    const amountIndex = fields.findIndex(field => /^-?\s*(?:USD\s*)?\$?\s*[0-9][0-9\.\,]*$/.test(field));
    if (amountIndex === -1) return null;

    const amountRaw = fields[amountIndex];
    const beforeAmount = fields.slice(0, amountIndex);
    const afterAmount = fields.slice(amountIndex + 1);

    const cuotaIndex = beforeAmount.findIndex(field => /(\d{1,2}\s*de\s*\d{1,2}|\d{1,2}\s*\/\s*\d{1,2})/i.test(field));
    const cuotasRaw = cuotaIndex >= 0 ? beforeAmount[cuotaIndex] : '';

    const referenceParts = beforeAmount.filter((field, index) => {
      if (index === cuotaIndex) return false;
      if (/^(visa|mastercard|amex|american express)\b/i.test(field)) return false;
      return true;
    });

    const referencia = referenceParts.join(' ').trim();
    const isDollarAmount = /USD/i.test(amountRaw) || afterAmount.some(field => /USD/i.test(field));

    if (!referencia) return null;

    return {
      fecha,
      referencia,
      cuotas: normalizeCuotas(cuotasRaw),
      pesos: isDollarAmount ? null : moneyToNumber(amountRaw),
      dolares: isDollarAmount ? moneyToNumber(amountRaw) : null,
    };
  }
}
