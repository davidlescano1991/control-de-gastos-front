import { Component, Input, signal } from '@angular/core';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-visa',
  templateUrl: './visa.html',
  styleUrls: ['./visa.scss'],
  providers: [CurrencyPipe],
  standalone: true,
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule],
})
export class VisaComponent {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  @Input() anio!: number;

  @Input() mes!: string;
  @Input() entidad: string = '';
  @Input() isCargando: boolean = false;

  @Input() set datos(value: any[]) {
  const claveActual = JSON.stringify(value);
  if (claveActual === this.ultimaClave) return;

  this.ultimaClave = claveActual;
  this.datosMes.set(value ?? []);
  this.totalMes.set(this.calcularTotal(value ?? []));
}
private ultimaClave = '';
  datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);

  private calcularTotal(registros: any[]): number {
    console.log(`calcularTotal() de VisaComponet --> registros:  `, JSON.stringify(registros));
    return registros.reduce((acc, fila) => {
      const montoCrudo = fila['monto'];
      const monto = typeof montoCrudo === 'string'
        ? parseFloat(montoCrudo.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'))
        : typeof montoCrudo === 'number' ? montoCrudo : 0;
      return acc + (isNaN(monto) ? 0 : monto);
    }, 0);
  }

  esNuevo(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b1\/(\d+)\b/);
    return !!match && match[1] !== '1';
  }

  esUltima(valor: string | undefined): boolean {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim().toLowerCase();
    const match = limpio.match(/\b(\d+|x)\/\1\b/);
    return !!match;
  }
}
