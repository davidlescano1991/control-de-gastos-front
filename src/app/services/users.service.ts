import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { AuthUser, UserRole } from '../models/auth.models';

export interface CreateUserPayload {
  nombre?: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private http = inject(HttpClient);

  /**
   * Obtiene la lista de usuarios (Solo para ADMIN)
   */
  getUsers(): Observable<ApiResponse<AuthUser[]>> {
    return this.http.get<ApiResponse<AuthUser[]>>(`${environment.apiUrl}/users`);
  }

  /**
   * Da de alta un nuevo usuario con contraseña cifrada (Solo para ADMIN)
   */
  createUser(payload: CreateUserPayload): Observable<ApiResponse<AuthUser>> {
    return this.http.post<ApiResponse<AuthUser>>(`${environment.apiUrl}/users`, payload);
  }

  /**
   * Elimina un usuario por su identificador (Solo para ADMIN)
   */
  deleteUser(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/users/${id}`);
  }

  /**
   * Solicita el envío del token de recuperación al correo especificado
   */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  /**
   * Restablece la contraseña enviando el token y la nueva clave
   */
  resetPassword(token: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${environment.apiUrl}/auth/reset-password`, {
      token,
      newPassword,
    });
  }
}
