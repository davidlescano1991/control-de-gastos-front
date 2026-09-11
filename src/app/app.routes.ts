import { Routes } from '@angular/router';
import { RegistrarMovimiento } from './registrar-movimiento/registrar-movimiento';
import { Inicio } from './pages/inicio/inicio';

export const routes: Routes = [
  { path: '', component: Inicio },
  { path: 'nuevo', component: RegistrarMovimiento}
];
