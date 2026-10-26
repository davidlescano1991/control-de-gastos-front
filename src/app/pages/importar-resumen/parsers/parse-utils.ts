export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function cleanCell(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isDateValue(value: string): boolean {
  const v = value.trim();
  return (
    /^\d{2}\/\d{2}\/\d{4}$/.test(v) ||
    /^\d{2}\/\d{2}\/\d{2}$/.test(v) ||
    /^\d{2}\.\d{2}\.\d{2,4}$/.test(v) ||
    /^\d{2}-[A-Za-z]{3}-\d{2,4}$/i.test(v)
  );
}

export function normalizeCuotas(input?: string | null): string {
  if (!input) return '01/01';
  const t = input.trim();

  // Preservar textos conocidos como Zeta, Deb.Aut., etc.
  if (/^[a-z]/i.test(t) && !/^\d/.test(t) && !/^c\./i.test(t)) {
    return t;
  }

  // Formato Bancor: C.04/04 o C. 04/04
  const cMatch = t.match(/^c\.?\s*(\d{1,2})\/(\d{1,2})$/i);
  if (cMatch) {
    return `${pad2(+cMatch[1])}/${pad2(+cMatch[2])}`;
  }

  // Formato "n de m" (ej: "1 de 3", "02 de 06")
  if (/de/i.test(t)) {
    const [a, b] = t.split(/de/i, 2);
    const na = a.match(/\d+/)?.[0];
    const nb = b.match(/\d+/)?.[0];
    return na && nb ? `${pad2(+na)}/${pad2(+nb)}` : '01/01';
  }

  // Formato "n/m"
  if (t.includes('/')) {
    const [x, y] = t.split('/', 2);
    const na = x.match(/\d+/)?.[0];
    const nb = y.match(/\d+/)?.[0];
    if (na && nb) {
      return `${pad2(+na)}/${pad2(+nb)}`;
    }
  }

  // Busca NN/NN en cualquier parte de la cadena
  const m = t.match(/\b(\d{1,2}\/\d{1,2})\b/);
  if (m) {
    const [x, y] = m[1].split('/', 2);
    return `${pad2(+x)}/${pad2(+y)}`;
  }

  return '01/01';
}

export function moneyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let t = raw.replace(/USD|\$|\s/g, '').trim();
  if (!t) return null;

  let isNegative = false;
  if (t.startsWith('(') && t.endsWith(')')) {
    isNegative = true;
    t = t.slice(1, -1).trim();
  }
  if (t.endsWith('-') || t.startsWith('-')) {
    isNegative = true;
    t = t.replace(/^-+|-+$/g, '').trim();
  }

  // Si tiene formato argentino: 1.234,56 o 1234,56 o 531.000
  // Si no tiene coma pero tiene punto, verificar si es miles (ej 531.000) o decimal
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(/,/g, '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // Ejemplo "531.000" -> miles sin centavos
    t = t.replace(/\./g, '');
  }

  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return isNegative ? -n : n;
}

export function isHTML(s: string): boolean {
  return /<[^>]+>/.test(s) || /<\/(table|tr|td|span|p|div)>/i.test(s);
}

export function extractLastNumber(s: string): string {
  const all = s.match(/-?[0-9][0-9\.\,]*/g) ?? [];
  return all.length ? all[all.length - 1] : '';
}

export function normalizeHeader(value: string): string {
  return cleanCell(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const SPANISH_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function getTargetMonthAndYear(refDate: Date = new Date()): { monthName: string; year: number } {
  const isAfterTen = refDate.getDate() > 10;
  const targetDate = new Date(refDate.getFullYear(), refDate.getMonth() + (isAfterTen ? 1 : 0), 1);
  return {
    monthName: SPANISH_MONTH_NAMES[targetDate.getMonth()],
    year: targetDate.getFullYear(),
  };
}

