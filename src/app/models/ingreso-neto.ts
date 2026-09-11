export interface IngresoNetoMes {
  mes: string;
  ingresoNeto: number;
  ingresoNetoUSD?: number;
  cotizacionUSD?: number;
}

export interface IngresoNetoHistoricoItem {
  anio: number;
  mes: string;
  label: string;
  ingresoNeto: number;
  ingresoNetoUSD?: number;
  cotizacionUSD?: number;
}
