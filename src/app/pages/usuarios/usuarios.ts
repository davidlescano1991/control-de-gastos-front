import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UsersService, CreateUserPayload } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { AuthUser, UserRole } from '../../models/auth.models';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class UsuariosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  public authService = inject(AuthService);

  public userForm: FormGroup;
  public users = signal<AuthUser[]>([]);
  public isLoadingUsers = signal<boolean>(false);
  public isCreatingUser = signal<boolean>(false);
  public deletingUserId = signal<string | null>(null);

  public successMessage = signal<string>('');
  public errorMessage = signal<string>('');
  public hidePassword = signal<boolean>(true);

  constructor() {
    this.userForm = this.fb.group({
      nombre: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['LECTOR' as UserRole, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.isLoadingUsers.set(true);
    this.usersService.getUsers().subscribe({
      next: (res) => {
        this.users.set(res.data || []);
        this.isLoadingUsers.set(false);
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.errorMessage.set('No se pudieron cargar los usuarios. Verifica tu conexión.');
        this.isLoadingUsers.set(false);
      },
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  crearUsuario(): void {
    if (this.userForm.invalid || this.isCreatingUser()) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isCreatingUser.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload: CreateUserPayload = this.userForm.value;

    this.usersService.createUser(payload).subscribe({
      next: (res) => {
        this.isCreatingUser.set(false);
        this.successMessage.set(`Usuario ${res.data.email} creado exitosamente con rol ${res.data.role}.`);
        this.userForm.reset({ role: 'LECTOR' });
        this.cargarUsuarios();
      },
      error: (err) => {
        this.isCreatingUser.set(false);
        console.error('Error al crear usuario:', err);
        this.errorMessage.set(
          err.error?.message || 'Ocurrió un error al registrar el usuario. Comprueba los datos.'
        );
      },
    });
  }

  eliminarUsuario(user: AuthUser): void {
    if (user.id === this.authService.currentUser()?.id) {
      alert('No puedes eliminar tu propia cuenta activa.');
      return;
    }

    const confirmar = confirm(`¿Estás seguro de que deseas eliminar al usuario "${user.nombre || user.email}"?`);
    if (!confirmar) return;

    this.deletingUserId.set(user.id);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.usersService.deleteUser(user.id).subscribe({
      next: () => {
        this.deletingUserId.set(null);
        this.successMessage.set(`Usuario "${user.email}" eliminado correctamente.`);
        this.cargarUsuarios();
      },
      error: (err) => {
        this.deletingUserId.set(null);
        console.error('Error al eliminar usuario:', err);
        this.errorMessage.set(err.error?.message || 'No se pudo eliminar el usuario.');
      },
    });
  }
}
