export interface Prestamo {
    nombreFila: string; // Ej: "Enero", "Febrero", "cultura", etc.
    valores: { [categoria: string]: number }; // Ej: { "M-65": 123456, "M-72": 7890, ... }
    valoresPrestamo: { [prestamo: string]: number }; // Ej: { "M-65": 123456, "M-72": 7890, ... }
    colores: { [categoria: string]: string }; // 👈 esta línea es la clave
    
}