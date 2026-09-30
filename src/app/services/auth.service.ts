import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';
import { AuthResponse, AuthUser, LoginCredentials } from '../models/auth.models';

const TOKEN_KEY = 'control_gastos_token';
const USER_KEY = 'control_gastos_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Señales reactivas para el estado de autenticación
  public token = signal<string | null>(this.getStoredToken());
  public currentUser = signal<AuthUser | null>(this.getStoredUser());

  // Señales computadas para consulta inmediata en templates y lógica
  public isAuthenticated = computed<boolean>(() => {
    const t = this.token();
    return !!t && !this.isTokenExpired(t);
  });
  public isAdmin = computed<boolean>(() => this.currentUser()?.role === 'ADMIN');

  /**
   * Valida si el token JWT almacenado ha expirado verificando el timestamp 'exp'.
   */
  public isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      if (!decoded.exp) return false;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Verifica si la sesión actual cuenta con permisos de administrador válidos.
   */
  public async ensureAdminAuth(): Promise<boolean> {
    return this.isAuthenticated() && this.isAdmin();
  }

  /**
   * Envía credenciales a la API y almacena la sesión
   */
  public login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          if (response?.data?.token) {
            this.setSession(response.data.token, response.data.user);
          }
        })
      );
  }

  /**
   * Cierra la sesión activa, limpia el almacenamiento y opcionalmente redirige al login
   */
  public logout(redirect: boolean = false, expired: boolean = false): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.token.set(null);
    this.currentUser.set(null);

    if (redirect) {
      this.router.navigate(['/login'], {
        queryParams: expired ? { expired: 'true' } : undefined,
      });
    }
  }

  /**
   * Devuelve el token actual siempre que no haya expirado
   */
  public getToken(): string | null {
    const t = this.token();
    if (t && this.isTokenExpired(t)) {
      this.logout();
      return null;
    }
    return t;
  }

  /**
   * Devuelve los datos del usuario actual
   */
  public getUser(): AuthUser | null {
    if (this.isTokenExpired(this.token())) {
      this.logout();
      return null;
    }
    return this.currentUser();
  }

  private setSession(token: string, user: AuthUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    this.token.set(token);
    this.currentUser.set(user);
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (this.isTokenExpired(token)) {
      console.warn('🔒 [AuthService] El token almacenado expiró. Limpiando almacenamiento.');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return token;
  }

  private getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
