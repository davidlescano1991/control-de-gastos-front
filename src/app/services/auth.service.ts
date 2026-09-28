import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  // Señales reactivas para el estado de autenticación
  public token = signal<string | null>(this.getStoredToken());
  public currentUser = signal<AuthUser | null>(this.getStoredUser());

  // Señales computadas para consulta inmediata en templates y lógica
  public isAuthenticated = computed<boolean>(() => !!this.token());
  public isAdmin = computed<boolean>(() => this.currentUser()?.role === 'ADMIN');

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
   * Cierra la sesión activa y limpia el almacenamiento
   */
  public logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.token.set(null);
    this.currentUser.set(null);
  }

  /**
   * Devuelve el token actual
   */
  public getToken(): string | null {
    return this.token();
  }

  /**
   * Devuelve los datos del usuario actual
   */
  public getUser(): AuthUser | null {
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
    return localStorage.getItem(TOKEN_KEY);
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
