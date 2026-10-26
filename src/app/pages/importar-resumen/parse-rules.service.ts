import { Injectable } from '@angular/core';
import { Movement, EntityId, InputMode, EntityConfig } from './models';
import { GaliciaParser } from './parsers/galicia.parser';
import { BancorParser } from './parsers/bancor.parser';
import { GeneralParser } from './parsers/general.parser';
import { normalizeCuotas, moneyToNumber, isHTML } from './parsers/parse-utils';

@Injectable({ providedIn: 'root' })
export class ParseRulesService {
  private galicia = new GaliciaParser();
  private bancor = new BancorParser();
  private general = new GeneralParser();

  readonly entities: EntityConfig[] = [
    {
      id: 'galicia',
      name: 'Banco Galicia',
      shortName: 'Galicia',
      badge: 'Visa & Master',
      icon: '🏦',
      colorVar: '--color-galicia',
      defaultMode: 'movements',
      supportedModes: [
        {
          id: 'movements',
          label: 'Movimientos Web',
          icon: '🌐',
          description:
            'Pegue los movimientos copiados directamente de la página web de Galicia (Visa o Mastercard). Soporta formato vertical o de tabla.',
          placeholder: `Fecha
Tarjeta
Descripción
Cuotas
Importe en pesos
Importe en dólares
19/09/2026

Visa 1564

MERPAGO*CESARNAHUELMADERO

1 de 3

$ 6.829,67


04/09/2026


Pago de tu tarjeta


- $ 531.000...`,
        },
        {
          id: 'summary',
          label: 'Resumen PDF',
          icon: '📄',
          description:
            'Pegue el texto copiado del resumen oficial en PDF de Galicia (Visa o Mastercard).',
          placeholder:
            'Pegue aquí el texto copiado del resumen PDF de Galicia (Visa o Mastercard)...',
        },
      ],
    },
    {
      id: 'bancor',
      name: 'Bancor (Banco de Córdoba)',
      shortName: 'Bancor',
      badge: 'Bancón / Resumen',
      icon: '🏛️',
      colorVar: '--color-bancor',
      defaultMode: 'summary',
      supportedModes: [
        {
          id: 'summary',
          label: 'Resumen PDF / Texto',
          icon: '📄',
          description:
            'Pegue el contenido del resumen de Bancor. Procesa cuotas (C.04/04), pagos en negativo e impuestos automáticos.',
          placeholder: `FECHA     COMPROBANTE           DETALLE DE TRANSACCION                                                                 PESOS                 DOLARES
31.03.26       276181     SUPERMERCADO CORDIEZ        C.04/04                          9.752,66           0,00...`,
        },
        {
          id: 'movements',
          label: 'Movimientos Web (Bancón)',
          icon: '🌐',
          description:
            'Pegue el código HTML o texto de la tabla de Movimientos de Tarjeta copiado desde Bancón.',
          placeholder:
            '<table class="regular-table contextual-table">...\no tabla copiada de los movimientos de Bancón...',
        },
      ],
    },
    {
      id: 'general',
      name: 'General / Otros Bancos',
      shortName: 'General',
      badge: 'Naranja X / Tablas / HTML',
      icon: '💳',
      colorVar: '--color-general',
      defaultMode: 'summary',
      supportedModes: [
        {
          id: 'summary',
          label: 'Resumen / HTML / Naranja X',
          icon: '📄',
          description:
            'Pegue texto o código HTML de resúmenes (Naranja X con cuotas Zeta, compras con ARS/USD, etc.).',
          placeholder:
            'Pegue aquí el texto o código HTML del resumen...',
        },
        {
          id: 'movements',
          label: 'Movimientos Tabla Web',
          icon: '🌐',
          description:
            'Pegue tablas copiadas de cualquier banco con columnas de fecha, descripción, cuotas e importes.',
          placeholder:
            'Fecha\tTarjeta\tDescripción\tCuotas\tImporte en pesos\tImporte en dólares...',
        },
      ],
    },
  ];

  parse(entityId: EntityId, mode: InputMode, text: string): Movement[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    switch (entityId) {
      case 'galicia':
        return mode === 'movements'
          ? this.galicia.parseMovements(trimmed)
          : this.galicia.parseSummary(trimmed);

      case 'bancor':
        return mode === 'summary'
          ? this.bancor.parseSummary(trimmed)
          : this.bancor.parseMovements(trimmed);

      case 'general':
      default:
        return mode === 'movements'
          ? this.general.parseMovements(trimmed)
          : this.general.parseSummary(trimmed);
    }
  }

  // Retrocompatibilidad
  normalizeCuotas(input?: string | null): string {
    return normalizeCuotas(input);
  }

  moneyToNumber(raw?: string | null): number | null {
    return moneyToNumber(raw);
  }

  isHTML(s: string): boolean {
    return isHTML(s);
  }

  parseHTML(html: string): Movement[] {
    return this.general.parseHTML(html);
  }

  parseBancor(text: string): Movement[] {
    return this.bancor.parseSummary(text);
  }

  parseMovementsTable(input: string): Movement[] {
    return this.general.parseMovements(input);
  }

  parseText(text: string): Movement[] {
    return this.general.parseText(text);
  }
}
