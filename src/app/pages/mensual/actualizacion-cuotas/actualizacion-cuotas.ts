import { Component, Input, signal, OnChanges } from '@angular/core';
import { CurrencyPipe, NgIf } from '@angular/common';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { Entidad } from '../../../models/entidad';

@Component({
  selector: 'app-novedades-cuotas',
  standalone: true,
  imports: [MatCard, MatCardContent, MatCardHeader, MatCardTitle, CurrencyPipe, NgIf],
  templateUrl: './actualizacion-cuotas.html',

  styleUrls: ['./actualizacion-cuotas.scss'],
})
export class NovedadesCuotas implements OnChanges {
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

  nuevasCuotas = signal(0);
  ultimasCuotas = signal(0);
  compensaciones = signal(0);

  ngOnChanges() {
    this.calcularTotales();
  }

  private calcularTotales() {
    let totalNuevas = 0;
    let totalUltimas = 0;
    let totalCompensaciones = 0;

    const todas = [
      ...(this.visa ?? []),
      ...(this.master ?? []),
      ...(this.naranja ?? []),
      ...(this.bancor ?? []),
      ...(this.otros ?? []),
    ];

    for (const item of todas) {
      const descripcion = item['descripcion'];
      const montoValor = item['monto'];
      const desc = typeof descripcion === 'string' ? descripcion.toLowerCase() : '';
      const monto = this.parseMoneda(typeof montoValor === 'string' ? montoValor : undefined);

      if (this.normalizar(desc).includes('compensaciones')) {
        totalCompensaciones += monto;
      }

      // Nuevas cuotas: "1/x" con x > 1
      const matchNueva = desc.match(/\b1\/(\d+)\b/);
      if (matchNueva && parseInt(matchNueva[1]) > 1) {
        totalNuevas += monto;
      }

      // Últimas cuotas: "x/x"
      const matchUltima = desc.match(/\b(\d+|x)\/\1\b/);
      if (matchUltima) {
        totalUltimas += monto;
      }
    }

    this.nuevasCuotas.set(totalNuevas);
    this.ultimasCuotas.set(totalUltimas);
    this.compensaciones.set(totalCompensaciones);
  }

  getColorPorValor(valor: number): string {
    if (valor < 0) return 'red';
    if (valor > 0) return 'green';
    return 'black';
  }

  private normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private parseMoneda(valor: string | undefined): number {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, '').replace(',', '.').replace('$', '')) || 0;
  }
}
