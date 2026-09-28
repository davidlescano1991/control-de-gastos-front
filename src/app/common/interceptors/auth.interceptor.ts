import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../config/environment';

/**
 * Interceptor HTTP funcional para Angular 21+.
 * Adjunta automáticamente el token JWT en las peticiones a la API
 * y captura respuestas 401 (No autorizado) para limpiar la sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Verificamos si la petición se dirige a nuestra API
  const esUrlApi = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');

  let peticionClonada = req;

  // Si existe un token y es para nuestra API, adjuntamos la cabecera Authorization: Bearer <token>
  if (token && esUrlApi) {
    peticionClonada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(peticionClonada).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && esUrlApi) {
        console.warn('🔒 [AuthInterceptor] 401 Unauthorized recibido de la API. Sesión cerrada.');
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
