export interface Movement {
  fecha: string;            // cadena tal cual viene (dd/mm/aaaa, dd-Mmm-aa, etc.)
  referencia: string;       // comercio / descripción
  cuotas: string;           // NN/MM (si falta -> 01/01)
  pesos: number | null;     // número real (sin miles, con punto decimal)
  dolares: number | null;   // número real
}

export type EntityId = 'galicia' | 'bancor' | 'general';
export type InputMode = 'movements' | 'summary';

export interface ModeOption {
  id: InputMode;
  label: string;
  icon: string;
  description: string;
  placeholder: string;
}

export interface EntityConfig {
  id: EntityId;
  name: string;
  shortName: string;
  badge: string;
  icon: string;
  colorVar: string;
  supportedModes: ModeOption[];
  defaultMode: InputMode;
}

export interface EntityParserStrategy {
  parseMovements?(text: string): Movement[];
  parseSummary?(text: string): Movement[];
}
