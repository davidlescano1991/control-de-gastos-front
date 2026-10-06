export interface ItemDesglose {
  nombre: string;
  monto: number;
  cuotas?: number;
}

export interface DeudaTotalMes {
  mes: string;
  subtotalTarjetas: number;
  totalPrestamos: number;
  compensaciones?: number;
  compensacionRaw?: number;
  deudaTotal: number;
  deudaTotalUSD?: number;
  cotizacionUSD?: number;
  desgloseTarjetas?: ItemDesglose[];
  desglosePrestamos?: ItemDesglose[];
}

export interface DeudaTotalHistoricoItem {
  anio: number;
  mes: string;
  label: string;
  deudaTotal: number;
  deudaTotalUSD?: number;
  subtotalTarjetas?: number;
  totalPrestamos?: number;
  compensaciones?: number;
  cotizacionUSD?: number;
}
