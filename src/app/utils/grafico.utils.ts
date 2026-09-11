import { Movimiento, Movimiento2 } from '../models/movimiento';
import { Cotizacion } from '../models/cotizacion';

export function parseFechaEsAR(fechaInput: string | Date | undefined | null): Date {
  if (!fechaInput) return new Date(0);
  if (fechaInput instanceof Date) {
    return new Date(fechaInput.getFullYear(), fechaInput.getMonth(), fechaInput.getDate());
  }
  const str = String(fechaInput).trim();
  if (str.includes('T')) {
    const d = new Date(str);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const partes = str.split(/[\/-]/);
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    } else {
      return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    }
  }
  const d = new Date(str);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatFechaEsAR(dateInput: Date | string): string {
  const d = parseFechaEsAR(dateInput);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function parseCellCoordinates(cell: string): { row: number; col: number } {
  const match = (cell || '').trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return { row: 20, col: 10 }; // Default K21 (0-based: col 10, row 20)

  const colStr = match[1];
  const rowNum = parseInt(match[2], 10);

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return {
    row: Math.max(0, rowNum - 1),
    col: Math.max(0, col - 1),
  };
}

export function generarDatosGrafico(movimientos: Movimiento[]) {
  const movimientosPorFecha = new Map<string, number>();
  const deudaPorFecha = new Map<string, number>();
  console.log('function generarDatosGrafico()');
  for (const mov of movimientos) {
    const fecha = formatFechaEsAR(mov.fecha);
    const monto = mov.monto;
    const deuda = mov.deudapesos;
    console.log('gráfico deuda --> ', JSON.stringify(deuda));
    if (movimientosPorFecha.has(fecha)) {
      movimientosPorFecha.set(fecha, movimientosPorFecha.get(fecha)! + monto);
    } else {
      movimientosPorFecha.set(fecha, monto);
    }
    if (deudaPorFecha.has(fecha)) {
      if (deuda != null) deudaPorFecha.set(fecha, deudaPorFecha.get(fecha)! + deuda);
    } else {
      if (deuda != null) deudaPorFecha.set(fecha, deuda);
    }
  }

  const fechas = Array.from(movimientosPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });
  const fechasDeudas = Array.from(deudaPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });

  const saldos = fechas.map((fecha) => movimientosPorFecha.get(fecha)!);
  const deudas = fechasDeudas.map((fecha) => deudaPorFecha.get(fecha)!);
  console.log(
    'fin function generarDatosGrafico() fecha %f saldo %s deudas %d',
    fechas,
    saldos,
    deudas,
  );
  return { fechas, saldos, deudas };
}
export function generarDatosGrafico2(movimientos: Movimiento2[]) {
  if (!movimientos || movimientos.length === 0) {
    return { fechas: [], saldos: [], deudas: [] };
  }
  const movimientosPorFecha = new Map<string, number>();
  const deudaPorFecha = new Map<string, number>();
  console.log('function generarDatosGrafico2()');
  for (const mov of movimientos) {
    const fecha = formatFechaEsAR(mov.fecha);
    const monto = mov.monto;
    const deuda = mov.deudapesos;

    if (movimientosPorFecha.has(fecha)) {
      movimientosPorFecha.set(fecha, movimientosPorFecha.get(fecha)! + monto);
    } else {
      movimientosPorFecha.set(fecha, monto);
    }
    if (deudaPorFecha.has(fecha)) {
      if (deuda != null) deudaPorFecha.set(fecha, deudaPorFecha.get(fecha)! + deuda);
    } else {
      if (deuda != null) deudaPorFecha.set(fecha, deuda);
    }
  }

  const fechas = Array.from(movimientosPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });
  const fechasDeudas = Array.from(deudaPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });

  const saldos = fechas.map((fecha) => movimientosPorFecha.get(fecha)!);
  const deudas = fechasDeudas.map((fecha) => deudaPorFecha.get(fecha)!);
  console.log(`fin function generarDatosGrafico() registros ${fechas.length} `);
  return { fechas, saldos, deudas };
}
export function generarDatosDeudaGrafico(movimientos: Movimiento[]) {
  const movimientosPorFecha = new Map<string, number>();
  console.log('function generarDatosGrafico()');
  for (const mov of movimientos) {
    const fecha = formatFechaEsAR(mov.fecha);
    const monto = mov.monto;

    if (movimientosPorFecha.has(fecha)) {
      movimientosPorFecha.set(fecha, movimientosPorFecha.get(fecha)! + monto);
    } else {
      movimientosPorFecha.set(fecha, monto);
    }
  }

  const fechas = Array.from(movimientosPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });

  const saldos = fechas.map((fecha) => movimientosPorFecha.get(fecha)!);
  return { fechas, saldos };
}

export function calcularTendencia(data: (number | null | undefined)[]): number[] {
  const puntosValidos = data
    .map((val, idx) => ({ x: idx, y: val }))
    .filter(
      (pt): pt is { x: number; y: number } =>
        pt.y !== null && pt.y !== undefined && !isNaN(pt.y as number),
    );

  const n = puntosValidos.length;
  if (n < 2) {
    return data.map(() => 0);
  }

  const sumX = puntosValidos.reduce((sum, pt) => sum + pt.x, 0);
  const sumY = puntosValidos.reduce((sum, pt) => sum + pt.y, 0);
  const sumXY = puntosValidos.reduce((sum, pt) => sum + pt.x * pt.y, 0);
  const sumX2 = puntosValidos.reduce((sum, pt) => sum + pt.x * pt.x, 0);

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  return data.map((_, i) => m * i + b);
}

export function generarDatosGraficoUSD(movimientos: Cotizacion[]) {
  console.log(`inicia grafico.utls.ts.generarDatosGraficoUSD()`);
  const movimientosPorFecha = new Map<string, number>();
  const deudaPorFecha = new Map<string, number>();
  for (const mov of movimientos) {
    const fecha = formatFechaEsAR(mov.fecha);
    const monto = mov.totalUSD ?? 0;
    const deuda = mov.deudaUSD ?? 0;
    if (movimientosPorFecha.has(fecha)) {
      movimientosPorFecha.set(fecha, movimientosPorFecha.get(fecha)! + monto);
    } else {
      movimientosPorFecha.set(fecha, monto);
    }
    if (deudaPorFecha.has(fecha)) {
      deudaPorFecha.set(fecha, deudaPorFecha.get(fecha)! + deuda);
    } else {
      deudaPorFecha.set(fecha, deuda);
    }
  }

  const fechas = Array.from(movimientosPorFecha.keys()).sort((a, b) => {
    return parseFechaEsAR(a).getTime() - parseFechaEsAR(b).getTime();
  });
  const saldos = fechas.map((fecha) => movimientosPorFecha.get(fecha)!);
  const deudas = fechas.map((fecha) => deudaPorFecha.get(fecha)!);
  return { fechas, saldos, deudas };
}

export function filtrarUltimosMeses<T extends { fecha: string | Date }>(
  movimientos: T[],
  cantidadMeses = 6,
): T[] {
  if (!movimientos || movimientos.length === 0) return [];

  const parseFecha = (f: string | Date) => {
    if (f instanceof Date) return new Date(f.getFullYear(), f.getMonth(), f.getDate());
    // esperado dd/MM/yyyy o ISO yyyy-MM-dd — intentamos detectar ambos
    if (/^\d{2}\/\d{1,2}\/\d{4}$/.test(f)) {
      const [d, m, y] = f.split('/');
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    // fallback: Date constructor (ISO, etc.)
    return new Date(f);
  };

  // ordenar descendente por fecha
  const ordenados = movimientos
    .slice()
    .sort((a, b) => parseFecha(b.fecha).getTime() - parseFecha(a.fecha).getTime());

  const mesesUnicos = new Set<string>();
  const filtrados: T[] = [];

  for (const mov of ordenados) {
    const fecha = parseFecha(mov.fecha);
    const claveMes = `${fecha.getFullYear()}-${fecha.getMonth()}`; // month index 0..11
    if (!mesesUnicos.has(claveMes)) mesesUnicos.add(claveMes);

    if (mesesUnicos.size <= cantidadMeses) filtrados.push(mov);
    else break;
  }

  return filtrados.reverse(); // ascendente cronológico
}

export function getGridColor(ctx: any): string {
  const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
  const isYZero = ctx && ctx.tick && ctx.tick.value === 0 && (!ctx.scale || ctx.scale.axis === 'y' || ctx.scale.id === 'y');
  if (isYZero) {
    return isDark ? '#ffffff' : '#000000';
  }
  return isDark ? 'rgba(255, 255, 255, 0.15)' : '#e0e0e0';
}

export function getLineWidth(ctx: any): number {
  const isYZero = ctx && ctx.tick && ctx.tick.value === 0 && (!ctx.scale || ctx.scale.axis === 'y' || ctx.scale.id === 'y');
  if (isYZero) {
    return 2.5;
  }
  return 1;
}

import type { Plugin } from 'chart.js';

export const yearBackgroundPlugin: Plugin<'line' | 'bar'> = {
  id: 'yearBackgroundPlugin',
  beforeDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales['x']) return;

    const { top, bottom, left, right } = chartArea;
    const xScale = scales['x'];
    const labels = chart.data.labels as (string | undefined)[];
    if (!labels || labels.length === 0) return;

    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');

    // Alternating background and separator colors
    const bgEven = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(100, 116, 139, 0.12)';
    const separatorColor = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(71, 85, 105, 0.40)';

    let currentYear: number | null = null;
    let yearStartIndex = 0;
    const yearGroups: { year: number; startIdx: number; endIdx: number }[] = [];

    for (let i = 0; i < labels.length; i++) {
      const match = String(labels[i] ?? '').match(/\b(20\d{2})\b/);
      const yr = match ? parseInt(match[1], 10) : null;

      if (yr !== null) {
        if (currentYear === null) {
          currentYear = yr;
          yearStartIndex = i;
        } else if (yr !== currentYear) {
          yearGroups.push({ year: currentYear, startIdx: yearStartIndex, endIdx: i - 1 });
          currentYear = yr;
          yearStartIndex = i;
        }
      }
    }

    if (currentYear !== null) {
      yearGroups.push({ year: currentYear, startIdx: yearStartIndex, endIdx: labels.length - 1 });
    }

    if (yearGroups.length <= 1) return;

    ctx.save();
    const anioActual = new Date().getFullYear();

    yearGroups.forEach((group, index) => {
      // Calculate start and end X pixels
      const startX = index === 0
        ? left
        : (xScale.getPixelForValue(group.startIdx) + xScale.getPixelForValue(group.startIdx - 1)) / 2;

      const endX = index === yearGroups.length - 1
        ? right
        : (xScale.getPixelForValue(group.endIdx) + xScale.getPixelForValue(group.endIdx + 1)) / 2;

      // El año actual siempre queda en fondo blanco (transparente), alternando los años anteriores
      const debeTenerFondoGris = Math.abs(anioActual - group.year) % 2 === 1;
      if (debeTenerFondoGris) {
        ctx.fillStyle = bgEven;
        ctx.fillRect(startX, top, endX - startX, bottom - top);
      }

      // Draw vertical separator line between years
      if (index > 0) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]); // Linea punteada elegante
        ctx.strokeStyle = separatorColor;
        ctx.lineWidth = 1.5;
        ctx.moveTo(startX, top);
        ctx.lineTo(startX, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw year indicator badge at the top of each year division
      const badgeText = String(group.year);
      ctx.font = 'bold 11px Inter, system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 10;
      const badgeHeight = 18;
      const badgeX = index === 0 ? startX + 6 : startX + 4;
      const badgeY = top + 6;

      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;

      if ((ctx as any).roundRect) {
        ctx.beginPath();
        (ctx as any).roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
      }

      ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
    });

    ctx.restore();
  },
};
