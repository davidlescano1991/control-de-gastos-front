import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  public loginForm: FormGroup;
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string>('');
  public sessionExpired = signal<boolean>(false);
  public hidePassword = signal<boolean>(true);
  public turnstileToken = signal<string>('');
  private turnstileWidgetId: string | null = null;

  private returnUrl: string = '/';

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
  }

  ngOnInit(): void {
    // Si ya existe sesión válida activa, redirigir directo al dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    // Comprobar parámetros de URL (expirado o url de retorno)
    this.route.queryParams.subscribe((params) => {
      if (params['expired'] === 'true') {
        this.sessionExpired.set(true);
      }
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
    });

    this.initTurnstile();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.turnstileWidgetId && (window as any).turnstile) {
      try {
        (window as any).turnstile.remove(this.turnstileWidgetId);
      } catch (e) {
        // noop
      }
    }
  }

  private initTurnstile(): void {
    if (typeof window === 'undefined') return;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      const container = document.getElementById('turnstile-container');
      if (turnstile && container) {
        try {
          container.innerHTML = '';
          this.turnstileWidgetId = turnstile.render('#turnstile-container', {
            sitekey: environment.turnstileSiteKey || '0x4AAAAAAFJxWCo26CCsf8A2',
            callback: (token: string) => {
              this.turnstileToken.set(token);
            },
            'expired-callback': () => {
              this.turnstileToken.set('');
            },
            theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light',
          });
        } catch (e) {
          console.warn('⚠️ [Turnstile] No se pudo renderizar widget:', e);
        }
      }
    };

    if (!(window as any).turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => setTimeout(renderWidget, 150);
      document.head.appendChild(script);
    } else {
      setTimeout(renderWidget, 150);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.sessionExpired.set(false);
    this.isLoading.set(true);

    const { email, password } = this.loginForm.value;
    const tokenCaptcha = this.turnstileToken();

    this.authService.login({ email, password, turnstileToken: tokenCaptcha }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        console.log('✅ [Login] Sesión iniciada con éxito:', res.data.user.email);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('❌ [Login] Error de autenticación:', err);

        if (err.status === 401) {
          this.errorMessage.set('Correo electrónico o contraseña incorrectos.');
        } else if (err.status === 0) {
          this.errorMessage.set('No se pudo contactar con la API. Verifica tu conexión o servidor.');
        } else {
          this.errorMessage.set(
            err.error?.message || 'Ocurrió un error al procesar el inicio de sesión. Inténtalo de nuevo.'
          );
        }
      },
    });
  }
}
