import { Component, effect, Inject, Input, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { MovimientosStoreGoogle } from '../../../../stores/movimiento.google';
import { CurrencyPipe, isPlatformBrowser, NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { Console } from 'console';

@Component({
  selector: 'app-otros',
  imports: [NgFor, NgIf, CurrencyPipe, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './otros.html',
  styleUrl: './otros.scss',
  providers: [CurrencyPipe]
})
export class Otros {
  isCollapsed = signal(false);

  @Input() set forceCollapsed(val: boolean) {
    this.isCollapsed.set(val);
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
  }

  /* datosMes = signal<any[]>([]);
  totalMes = signal<number>(0);
  headers = signal<string[]>([]);
  mesSeleccionado = ''; // si querés mostrar el mes
  isCargando = signal(false);

  constructor(private storeGoogle: MovimientosStoreGoogle) {
    effect(() => {
       this.isCargando.set(true);
      console.log('Esta cargando Otros⏳');

      const datos = this.storeGoogle.entidadOtros(); // ya filtrado por mes
       console.log('Datos en Otros ',JSON.stringify(datos));
      this.datosMes.set(datos);

      const total = datos.reduce((acc, fila) => {
        const valores = Object.values(fila);
        const montoCrudo = valores[1];
        //console.log("mONTO EN OTROS ",JSON.stringify(valores[0]));
        const monto = typeof montoCrudo === 'string'
          ? parseFloat(montoCrudo.replace(/\./g, '').replace(',', '.').replace('$', ''))
          : typeof montoCrudo === 'number'
            ? montoCrudo
            : 0;
        
        return acc + monto;
      }, 0);
      console.log('Total en Otros: ',JSON.stringify(total));
      this.totalMes.set(total);
      this.isCargando.set(false);
      console.log('Fin de la carga Otros⏳');
    });
  }

  normalizar(texto: string | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[áéíóú]/g, c =>
        ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c)
      );
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
    if (match) {
      const cuota = match[0]; // por ejemplo "6/6", mas adelanto seriviria para tomar el valor
    }
    return !!match;
  }
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  } */
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
    console.log(`calcularTotal() de OtrosComponet --> registros:  `, JSON.stringify(registros));
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
