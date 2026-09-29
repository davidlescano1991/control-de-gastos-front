
export interface Movimiento {
  fecha: string;
  monto: number;
  tipo: string;
  categoria: string;
  descripcion: string;
  deudapesos?: number;
}


export interface Movimiento2 {
  fecha: Date;
  tipo: string;
  monto: number;
  deudapesos?: number | null;
}