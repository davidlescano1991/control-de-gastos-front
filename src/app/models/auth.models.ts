export type UserRole = 'ADMIN' | 'LECTOR';

export interface AuthUser {
  id: string;
  email: string;
  nombre?: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface AuthResponse {
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
}
