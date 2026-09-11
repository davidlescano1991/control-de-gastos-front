import { parseFechaEsAR } from './grafico.utils';

// Mapa dinámico de feriados cargados desde archivo del servidor (formato DD/MM/YYYY o DD/MM)
const feriadosServidor = new Map<string, string>();

/**
 * Carga o actualiza los feriados en memoria a partir de los datos recibidos desde el servidor/JSON.
 */
export function setFeriadosDesdeServidor(
  feriadosObj: Record<string, string> | { feriados?: Record<string, string> } | null | undefined,
): void {
  if (!feriadosObj) return;

  const data: Record<string, string> =
    'feriados' in feriadosObj && typeof feriadosObj.feriados === 'object' && feriadosObj.feriados !== null
      ? feriadosObj.feriados
      : (feriadosObj as Record<string, string>);

  feriadosServidor.clear();
  for (const [fechaKey, descripcion] of Object.entries(data)) {
    if (typeof descripcion === 'string') {
      feriadosServidor.set(fechaKey.trim(), descripcion.trim());
    }
  }
  console.log(`✅ Feriados cargados desde servidor: ${feriadosServidor.size} registros`);
}

/**
 * Retorna todos los feriados cargados actualmente.
 */
export function getFeriadosCargados(): Map<string, string> {
  return new Map(feriadosServidor);
}

/**
 * Retorna si una fecha es sábado (6) o domingo (0).
 */
export function esFinDeSemana(fechaInput: string | Date | undefined | null): boolean {
  if (!fechaInput) return false;
  const d = parseFechaEsAR(fechaInput);
  const diaSemana = d.getDay();
  return diaSemana === 0 || diaSemana === 6;
}

/**
 * Retorna el nombre del feriado o null si no es feriado según el archivo del servidor.
 */
export function obtenerMotivoFeriado(fechaInput: string | Date | undefined | null): string | null {
  if (!fechaInput) return null;
  const d = parseFechaEsAR(fechaInput);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();

  // 1. Coincidencia exacta por fecha completa (DD/MM/YYYY)
  const fechaCompletaKey = `${dia}/${mes}/${anio}`;
  if (feriadosServidor.has(fechaCompletaKey)) {
    return feriadosServidor.get(fechaCompletaKey)!;
  }

  // 2. Coincidencia por día/mes (DD/MM) si fue configurado como feriado recurrente
  const fechaCortaKey = `${dia}/${mes}`;
  if (feriadosServidor.has(fechaCortaKey)) {
    return feriadosServidor.get(fechaCortaKey)!;
  }

  return null;
}

/**
 * Retorna si la fecha dada es feriado según el archivo del servidor.
 */
export function esFeriadoNacional(fechaInput: string | Date | undefined | null): boolean {
  return obtenerMotivoFeriado(fechaInput) !== null;
}

/**
 * Retorna si la fecha es no laborable (fin de semana o feriado).
 */
export function esDiaNoLaborable(fechaInput: string | Date | undefined | null): boolean {
  return esFinDeSemana(fechaInput) || esFeriadoNacional(fechaInput);
}

/**
 * Retorna el detalle completo de un día (para tooltip o clase CSS).
 */
export function obtenerInfoDia(fechaInput: string | Date | undefined | null): {
  esFinDeSemana: boolean;
  esFeriado: boolean;
  esNoLaborable: boolean;
  nombreDia: string;
  motivo?: string;
} {
  const d = parseFechaEsAR(fechaInput);
  const diaSemana = d.getDay();
  const esFds = diaSemana === 0 || diaSemana === 6;
  const motivoFeriado = obtenerMotivoFeriado(d);
  const esFer = motivoFeriado !== null;

  const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const nombreDia = nombresDias[diaSemana] ?? '';

  let motivo: string | undefined = undefined;
  if (esFer) {
    motivo = motivoFeriado!;
  } else if (esFds) {
    motivo = nombreDia;
  }

  return {
    esFinDeSemana: esFds,
    esFeriado: esFer,
    esNoLaborable: esFds || esFer,
    nombreDia,
    motivo,
  };
}
