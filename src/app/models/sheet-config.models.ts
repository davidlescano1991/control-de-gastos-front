export interface EntityRange {
  inicio: number;
  fin: number;
  headerIndex: number;
}

export interface SheetMetadata {
  pantallas: {
    inicio: boolean;
    estimativos: boolean;
    mensual: boolean;
    anual: boolean;
  };
  rangos: Record<string, EntityRange>;
  mesesExtra: string[];
  filasTablaAnual: number;
  celdaIngresoNeto: string;
}

export interface SheetConfigItem {
  year: number;
  sheetId: string;
  sheetIdMasked: string;
  sheetIdEncrypted?: string;
  descripcion: string | null;
  activo: boolean;
  metadata: SheetMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface SheetConfigPayload {
  year: number;
  sheetId: string;
  descripcion?: string;
  activo?: boolean;
  metadata?: SheetMetadata;
}

export interface RuntimeConfigData {
  coloresEntidades: Record<string, string>;
  rangosEntidadesPorAnio: Record<string, Record<string, EntityRange>>;
  mesesExtraPorAnio: Record<string, string[]>;
  filasTablaAnualPorAnio: Record<string, number>;
  celdaIngresoNetoPorAnio: Record<string, string>;
  aniosInicio: number[];
  aniosEstimativos: number[];
  aniosMensual: number[];
  aniosAnual: number[];
  totalHojasActivas: number;
}
