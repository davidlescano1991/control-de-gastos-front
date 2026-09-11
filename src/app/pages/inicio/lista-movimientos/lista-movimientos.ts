import { Component, Input, inject, signal } from '@angular/core';
import { Movimiento2 } from '../../../models/movimiento';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { MovimientosStoreGoogle } from '../../../stores/movimiento.google';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-lista-movimientos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CurrencyPipe,
    DatePipe,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './lista-movimientos.html',
  styleUrls: ['./lista-movimientos.scss'],
  providers: [provideCharts(withDefaultRegisterables())],
})
export class ListaMovimientos {
  private storeGoogle = inject(MovimientosStoreGoogle);

  private _anio = signal<number>(2025);
  @Input() set anio(value: number) {
    this._anio.set(value);
    this.cargarMovimientosPorAnio(value);
  }

  movimientos = signal<Movimiento2[]>([]);
  paginaActual = signal<Movimiento2[]>([]);
  pageSize = 17;
  pageIndex = 0;
  isCargando = signal(true);

  async cargarMovimientosPorAnio(anio: number) {
    this.isCargando.set(true);
    await this.storeGoogle.cargarDesdeSheetsPorAnio(anio);
    const lista = this.storeGoogle.getMovimientosPorAnio(anio);
    console.log(`...cargarMovimientosPorAnio(${anio}) lista: `, JSON.stringify(lista));
    this.movimientos.set(lista);
    this.actualizarPagina();
    this.isCargando.set(false);
  }

  /* cargarMovimientos() {
    console.log('Recargando movimientos...');
    this.servicio.listarMovimientos().subscribe(data => {
      this.movimientos.set(data);
      //this.actualizarGrafico();
    });
  } */

  onPageChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.actualizarPagina();
  }
  actualizarPagina() {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.paginaActual.set(this.movimientos().slice(start, end));
  }
}
