import { Component, Input, OnChanges, signal } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Entidad } from '../../../../models/entidad';

export interface ItemCuotaSubtotal {
  key: string;
  itemLabel: string;
  subtotal: number;
  esNuevo: boolean;
  esUltima: boolean;
}

@Component({
  selector: 'app-tabla-cuotas-coincidentes',
  standalone: true,
  imports: [NgFor, NgIf, CurrencyPipe, MatCardModule],
  providers: [CurrencyPipe],
  templateUrl: './tabla-cuotas-coincidentes.html',
  styleUrls: ['./tabla-cuotas-coincidentes.scss'],
})
export class TablaCuotasCoincidentes implements OnChanges {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() mesSeleccionado = '';
  @Input() visa: Entidad[] = [];
  @Input() master: Entidad[] = [];
  @Input() naranja: Entidad[] = [];
  @Input() bancor: Entidad[] = [];
  @Input() otros: Entidad[] = [];
  @Input() ml: Entidad[] = [];

  items = signal<ItemCuotaSubtotal[]>([]);
  totalGlobal = signal<number>(0);

  ngOnChanges(): void {
    this.calcularSubtotales();
  }

  private calcularSubtotales(): void {
    const todas = [
      ...(this.visa ?? []),
      ...(this.master ?? []),
      ...(this.naranja ?? []),
      ...(this.bancor ?? []),
      ...(this.otros ?? []),
      ...(this.ml ?? []),
    ];

    const mapaSubtotales = new Map<string, ItemCuotaSubtotal>();

    for (const item of todas) {
      const descripcionRaw = item['descripcion'];
      const montoRaw = item['monto'];
      if (!descripcionRaw) continue;

      const desc = typeof descripcionRaw === 'string' ? descripcionRaw.trim() : String(descripcionRaw);
      const montoCuota = this.parseMoneda(typeof montoRaw === 'string' ? montoRaw : String(montoRaw ?? 0));

      const matchCuota = desc.match(/(\d+)\/(\d+)/);
      if (!matchCuota) continue; // Solo procesar ítems con formato de cuotas X/Y

      const actual = parseInt(matchCuota[1], 10);
      const total = parseInt(matchCuota[2], 10);

      // Multiplicar el valor mensual por la cantidad de cuotas restantes por pagar (mes actual + futuras)
      const cuotasRestantes = total - actual + 1;
      const subtotalRestante = montoCuota * cuotasRestantes;

      const ratioStr = `${actual}/${total}`;
      const label = `Cuota ${ratioStr}`;
      const key = `cuota_${actual}_${total}`;

      let esNuevo = false;
      let esUltima = false;

      if (actual === 1 && total > 1) {
        esNuevo = true;
      } else if (actual === total) {
        esUltima = true;
      }

      if (mapaSubtotales.has(key)) {
        const existente = mapaSubtotales.get(key)!;
        existente.subtotal += subtotalRestante;
      } else {
        mapaSubtotales.set(key, {
          key,
          itemLabel: label,
          subtotal: subtotalRestante,
          esNuevo,
          esUltima,
        });
      }
    }

    const resultadoItems = Array.from(mapaSubtotales.values());
    const sumaTotal = resultadoItems.reduce((acc, item) => acc + item.subtotal, 0);

    this.items.set(resultadoItems);
    this.totalGlobal.set(sumaTotal);
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    const num = Number(valor.replace(/\./g, '').replace(',', '.').replace('$', ''));
    return isNaN(num) ? 0 : num;
  }
}
