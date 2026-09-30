import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Guard para proteger rutas privadas del sistema.
 * Si el usuario no tiene token o expiró, lo redirige a /login guardando la URL intentada.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  console.warn(`🔒 [AuthGuard] Acceso no autorizado a "${state.url}". Redirigiendo a /login`);
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url !== '/' ? state.url : undefined },
  });
};

/**
 * Guard para la pantalla de Login.
 * Si el usuario ya cuenta con una sesión válida, lo redirige directamente al inicio.
 */
export const publicOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};

/**
 * Guard para rutas de administración exclusiva (ej. /usuarios).
 * Solo permite el acceso a usuarios autenticados con rol ADMIN.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  console.warn('⛔ [AdminGuard] Acceso denegado: Se requiere rol ADMIN');
  return router.createUrlTree(['/']);
};

