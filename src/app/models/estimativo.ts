type EstimativoRow = {
  id?: string;
  dia?: number;
  fecha: string;
  saldoPesos: number;
  saldoUSD: number;
  deuda: number;
  real: number | null;
  deudaReal: number;
  evento?: string | null;
  color?: string | null;
  editando?: boolean;
};
