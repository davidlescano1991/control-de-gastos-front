type EstimativoRow = {
  id?: string;
  dia?: number;
  fecha: string;
  saldoPesos: number;
  saldoUSD: number;
  deuda: number;
  real: number | null;
  deudaReal: number;
  editando?: boolean;
};
