export interface Cotizacion {
  fecha: string;
  total: number;
  diferencia: number;
  deudaPesos: number;
  totalUSD?: number | undefined;
  diferenciaUSD?: number | undefined;
  deudaUSD?: number | undefined;
}
