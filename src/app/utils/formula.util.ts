export interface ResultadoFormula {
  esFormula: boolean;
  monto: number;
  error?: string;
  expresionLimpia?: string;
}

/**
 * Evalúa de forma interactiva y segura fórmulas aritméticas en campos de monto.
 * Acepta tanto números directos como expresiones con o sin '=' (ej: '=100000+50000', '150000*0.5', '200000 - 50000').
 * Maneja comas o puntos decimales, suma, resta, multiplicación, división y paréntesis.
 */
export function evaluarFormula(input: string | number | null | undefined): ResultadoFormula {
  if (input === null || input === undefined || input === '') {
    return { esFormula: false, monto: 0 };
  }
  if (typeof input === 'number') {
    return { esFormula: false, monto: isNaN(input) ? 0 : input };
  }

  const str = String(input).trim();
  const esFormula = str.startsWith('=');
  let exp = esFormula ? str.substring(1).trim() : str;

  // Si es un número directo (ej: "150000", "150000.50", "150.000,50")
  if (!esFormula && !/[+\-*/()]/.test(exp)) {
    // Si contiene puntos como separadores de miles y coma decimal: "150.000,50" -> "150000.50"
    let limpio = exp;
    if (limpio.includes(',') && limpio.includes('.')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else if (limpio.includes(',')) {
      limpio = limpio.replace(',', '.');
    }
    limpio = limpio.replace(/[^0-9.-]/g, '');
    const num = parseFloat(limpio);
    return { esFormula: false, monto: isNaN(num) ? 0 : num };
  }

  // Normalizar comas decimales (ej: 12,5 -> 12.5) pero sin romper comas separadoras
  exp = exp.replace(/(\d+),(\d+)/g, '$1.$2');

  // Validar caracteres seguros (solo dígitos, espacios, +, -, *, /, (, ) y .)
  if (!/^[\d\s+\-*/().]+$/.test(exp)) {
    return { esFormula: true, monto: 0, error: 'Caracteres no permitidos (solo números y +, -, *, /)' };
  }

  try {
    const resultado = evaluarExpresionAritmetica(exp);
    const redondeado = Math.round((resultado + Number.EPSILON) * 100) / 100;
    return {
      esFormula: true,
      monto: isNaN(redondeado) ? 0 : redondeado,
      expresionLimpia: exp,
    };
  } catch (e: any) {
    return {
      esFormula: true,
      monto: 0,
      error: e?.message || 'Expresión aritmética incompleta',
    };
  }
}

function evaluarExpresionAritmetica(expr: string): number {
  let pos = 0;
  const peek = () => expr[pos] || '';
  const consume = () => expr[pos++];
  const skipWs = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };

  const parseNum = (): number => {
    skipWs();
    let s = '';
    while (pos < expr.length && /[\d.]/.test(expr[pos])) s += consume();
    if (!s) throw new Error('Número esperado');
    return parseFloat(s);
  };

  const parseFactor = (): number => {
    skipWs();
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    if (peek() === '(') {
      consume();
      const r = parseExp();
      skipWs();
      if (peek() !== ')') throw new Error('Falta paréntesis ")"');
      consume();
      return r;
    }
    return parseNum();
  };

  const parseTerm = (): number => {
    let r = parseFactor();
    skipWs();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const next = parseFactor();
      if (op === '*') {
        r *= next;
      } else {
        if (next === 0) throw new Error('División por cero');
        r /= next;
      }
      skipWs();
    }
    return r;
  };

  const parseExp = (): number => {
    let r = parseTerm();
    skipWs();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const next = parseTerm();
      if (op === '+') {
        r += next;
      } else {
        r -= next;
      }
      skipWs();
    }
    return r;
  };

  const res = parseExp();
  skipWs();
  if (pos < expr.length) throw new Error('Expresión incompleta');
  return res;
}
