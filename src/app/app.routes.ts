import { Routes } from '@angular/router';
import { RegistrarMovimiento } from './registrar-movimiento/registrar-movimiento';
import { Inicio } from './pages/inicio/inicio';
import { Mensual } from './pages/mensual/mensual';
import { HomeEstimativo } from './pages/estimativos/home';
import { Anual } from './pages/anual/anual/anual';
import { LoginComponent } from './pages/login/login';
import { UsuariosComponent } from './pages/usuarios/usuarios';
import { HojasComponent } from './pages/hojas/hojas';
import { RecuperarPasswordComponent } from './pages/recuperar-password/recuperar-password';
import { RestablecerPasswordComponent } from './pages/restablecer-password/restablecer-password';
import { authGuard, publicOnlyGuard, adminGuard } from './common/guards/auth.guard';

export const routes: Routes = [
  // Rutas públicas (solo sin sesión activa)
  { path: 'login', component: LoginComponent, canActivate: [publicOnlyGuard] },
  { path: 'recuperar-password', component: RecuperarPasswordComponent, canActivate: [publicOnlyGuard] },
  { path: 'restablecer-password', component: RestablecerPasswordComponent, canActivate: [publicOnlyGuard] },

  // Rutas protegidas para cualquier usuario autenticado
  { path: '', component: Inicio, canActivate: [authGuard] },
  { path: 'nuevo', component: RegistrarMovimiento, canActivate: [authGuard] },
  { path: 'mensual', component: Mensual, canActivate: [authGuard] },
  { path: 'estimativo', component: HomeEstimativo, canActivate: [authGuard] },
  { path: 'anual', component: Anual, canActivate: [authGuard] },

  // Rutas exclusivas para rol ADMIN
  { path: 'usuarios', component: UsuariosComponent, canActivate: [authGuard, adminGuard] },
  { path: 'hojas', component: HojasComponent, canActivate: [authGuard, adminGuard] },

  // Redirección por defecto
  { path: '**', redirectTo: '' },
];
