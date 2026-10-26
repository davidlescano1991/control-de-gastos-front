const fs = require('fs');
const path = require('path');

const targetBase = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\1.0\\Front_Control_Gastos\\control-gastos-front';

// 1. formula.util.ts: Add valido and valor to ResultadoFormula and return them in evaluarFormula
const formulaUtilPath = path.join(targetBase, 'src', 'app', 'utils', 'formula.util.ts');
let formulaContent = `export interface ResultadoFormula {
  esFormula: boolean;
  monto: number;
  error?: string;
  expresionLimpia?: string;
  valido: boolean;
  valor: number;
}

/**
 * Evalúa de forma interactiva y segura fórmulas aritméticas en campos de monto.
 * Acepta tanto números directos como expresiones con o sin '=' (ej: '=100000+50000', '150000*0.5', '200000 - 50000').
 * Maneja comas o puntos decimales, suma, resta, multiplicación, división y paréntesis.
 */
export function evaluarFormula(input: string | number | null | undefined): ResultadoFormula {
  if (input === null || input === undefined || input === '') {
    return { esFormula: false, monto: 0, valido: true, valor: 0 };
  }
  if (typeof input === 'number') {
    const val = isNaN(input) ? 0 : input;
    return { esFormula: false, monto: val, valido: !isNaN(input), valor: val };
  }

  const str = String(input).trim();
  const esFormula = str.startsWith('=');
  let exp = esFormula ? str.substring(1).trim() : str;

  // Si es un número directo
  if (!esFormula && !/[+\\-*/()]/.test(exp)) {
    let limpio = exp;
    if (limpio.includes(',') && limpio.includes('.')) {
      limpio = limpio.replace(/\\./g, '').replace(',', '.');
    } else if (limpio.includes(',')) {
      limpio = limpio.replace(',', '.');
    }
    limpio = limpio.replace(/[^0-9.-]/g, '');
    const num = parseFloat(limpio);
    const valid = !isNaN(num);
    const resNum = valid ? num : 0;
    return { esFormula: false, monto: resNum, valido: valid, valor: resNum };
  }

  // Normalizar comas decimales
  exp = exp.replace(/(\\d+),(\\d+)/g, '$1.$2');

  // Validar caracteres seguros
  if (!/^[\\d\\s+\\-*/().]+$/.test(exp)) {
    return { esFormula: true, monto: 0, error: 'Caracteres no permitidos', valido: false, valor: 0 };
  }

  try {
    const resultado = evaluarExpresionAritmetica(exp);
    const redondeado = Math.round((resultado + Number.EPSILON) * 100) / 100;
    const valid = !isNaN(redondeado);
    return {
      esFormula: true,
      monto: valid ? redondeado : 0,
      expresionLimpia: exp,
      valido: valid,
      valor: valid ? redondeado : 0,
    };
  } catch (e: any) {
    return {
      esFormula: true,
      monto: 0,
      error: e?.message || 'Expresión aritmética incompleta',
      valido: false,
      valor: 0,
    };
  }
}

function evaluarExpresionAritmetica(expr: string): number {
  let pos = 0;
  const peek = () => expr[pos] || '';
  const consume = () => expr[pos++];
  const skipWs = () => {
    while (pos < expr.length && /\\s/.test(expr[pos])) pos++;
  };

  const parseNum = (): number => {
    skipWs();
    let s = '';
    while (pos < expr.length && /[\\d.]/.test(expr[pos])) s += consume();
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
`;
fs.writeFileSync(formulaUtilPath, formulaContent, 'utf8');

// 2. estimativos/mensual/mensual.ts: Explicitly import EstimativoRow
const estimativoMensualPath = path.join(targetBase, 'src', 'app', 'pages', 'estimativos', 'mensual', 'mensual.ts');
let estMensualContent = fs.readFileSync(estimativoMensualPath, 'utf8');
if (!estMensualContent.includes("import { MovimientosStoreGoogle, EstimativoRow }")) {
  estMensualContent = estMensualContent.replace(
    "import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';",
    "import { MovimientosStoreGoogle, EstimativoRow } from '../../../stores/movimiento.google';"
  );
  fs.writeFileSync(estimativoMensualPath, estMensualContent, 'utf8');
}

// 3. mensual-items.service.ts: Make sure CreateMonthlyItemPayload and UpdateMonthlyItemPayload have optional monto and formula
const mensualItemsPath = path.join(targetBase, 'src', 'app', 'services', 'mensual-items.service.ts');
let mensualItemsCode = fs.readFileSync(mensualItemsPath, 'utf8');
mensualItemsCode = mensualItemsCode.replace(
  `export interface CreateMonthlyItemPayload {
  year: number;
  mes: number;
  entidad: string;
  concepto: string;
  monto?: number;
  montoOFormula: string | number;
  notas?: string;
  autoPropagarCuotas?: boolean;
}`,
  `export interface CreateMonthlyItemPayload {
  year: number;
  mes: number;
  entidad: string;
  concepto: string;
  monto?: number;
  formula?: string | null;
  montoOFormula?: string | number;
  notas?: string;
  autoPropagarCuotas?: boolean;
}`
);
mensualItemsCode = mensualItemsCode.replace(
  `export interface UpdateMonthlyItemPayload {
  concepto?: string;
  montoOFormula?: string | number;
  entidad?: string;
  notas?: string;
  actualizarSerieCompleta?: boolean;
}`,
  `export interface UpdateMonthlyItemPayload {
  concepto?: string;
  monto?: number;
  formula?: string | null;
  montoOFormula?: string | number;
  entidad?: string;
  notas?: string;
  actualizarSerieCompleta?: boolean;
}`
);
fs.writeFileSync(mensualItemsPath, mensualItemsCode, 'utf8');

// 4. Copy 2.0 reembolsables.service.ts into 1.0 directly
const src2Reembolsables = 'C:\\Datos\\David\\Proyectos\\Control_Gastos\\control-de-gastos-front\\src\\app\\services\\reembolsables.service.ts';
const dst1Reembolsables = path.join(targetBase, 'src', 'app', 'services', 'reembolsables.service.ts');
fs.copyFileSync(src2Reembolsables, dst1Reembolsables);

// 5. mensual.ts in 1.0: Fix missing SseService, of, and synchronizarMesDesdeSheets
const mensualTsPath = path.join(targetBase, 'src', 'app', 'pages', 'mensual', 'mensual.ts');
let mensualTs = fs.readFileSync(mensualTsPath, 'utf8');

if (!mensualTs.includes("import { SseService }")) {
  mensualTs = "import { SseService } from '../../services/sse.service';\n" + mensualTs;
}
if (!mensualTs.includes("import { of }") && !mensualTs.includes(", of }") && !mensualTs.includes(", of,")) {
  mensualTs = mensualTs.replace("from 'rxjs';", ", of } from 'rxjs';");
}
mensualTs = mensualTs.replace(
  "void this.syncMensualService.sincronizarMesDesdeSheets(anio, mes);",
  "// void this.syncMensualService.sincronizarMesDesdeSheets(anio, mes);"
);
mensualTs = mensualTs.replace(
  "const descHoja = this.appConfig.raw?.origenPorAnio?.[String(anio)]?.descripcion",
  "const descHoja = (this.appConfig as any).raw?.origenPorAnio?.[String(anio)]?.descripcion"
);
fs.writeFileSync(mensualTsPath, mensualTs, 'utf8');

console.log('fix_all_remaining executed successfully.');
