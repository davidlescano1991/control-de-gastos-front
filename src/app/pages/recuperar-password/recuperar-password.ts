import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.scss',
})
export class RecuperarPasswordComponent {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);

  public recoverForm: FormGroup;
  public isLoading = signal<boolean>(false);
  public isSubmitted = signal<boolean>(false);
  public errorMessage = signal<string>('');

  constructor() {
    this.recoverForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.recoverForm.invalid || this.isLoading()) {
      this.recoverForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const email = this.recoverForm.value.email;

    this.usersService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error al solicitar recuperación de contraseña:', err);
        this.errorMessage.set(
          err.error?.message || 'Ocurrió un error al procesar la solicitud. Por favor intenta de nuevo.'
        );
      },
    });
  }
}
