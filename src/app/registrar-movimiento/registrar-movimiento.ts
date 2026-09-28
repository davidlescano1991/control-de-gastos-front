import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MovimientosService } from '../services/movimientos.service';
import { Movimiento } from '../models/movimiento'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ListaMovimientos } from '../pages/inicio/lista-movimientos/lista-movimientos';
import { ChangeDetectorRef } from '@angular/core';
import { MovimientosStore } from '../stores/movimientos.store';
import { WakeLockService } from '../services/wake-lock.service';

@Component({
  selector: 'app-registrar-movimiento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ListaMovimientos],
  templateUrl: './registrar-movimiento.html',
  styleUrls: ['./registrar-movimiento.scss']
})
export class RegistrarMovimiento {


  @ViewChild(ListaMovimientos) listaMovimientos!: ListaMovimientos;
  movimiento: Movimiento = {
    fecha: new Date().toISOString(),
    monto: 0,
    tipo: '',
    categoria: '',
    descripcion: '',
    deudapesos: 0
  };

  constructor(
    private servicio: MovimientosService,
    private cdr: ChangeDetectorRef,
    private store: MovimientosStore,
    private wakeLockService: WakeLockService
  ) { }

   async ngOnInit(): Promise<void> {
    
    this.wakeLockService.requestWakeLock();
  }

  guardar() {
    this.store.agregar(this.movimiento);

    const fechaISO = new Date(this.movimiento.fecha);
    const fechaFormateada = fechaISO.toISOString().split('T')[0]; // "2025-09-11"
    this.movimiento.fecha = fechaFormateada;
    this.servicio.crearMovimiento(this.movimiento).subscribe(() => {
      alert('Movimiento registrado');
      if (this.listaMovimientos) {
      } else {
        console.warn('ListaMovimientos no está disponible aún');
      }
      /* this.listaMovimientos.actualizarDibujo(); */
      // Limpiar el formulario

    });
  }
}
