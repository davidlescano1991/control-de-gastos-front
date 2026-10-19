import { Injectable, signal, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private router = inject(Router);
  private isBrowser: boolean;

  public isOnline = signal<boolean>(true);
  public isChecking = signal<boolean>(false);
  public simulatedOffline = signal<boolean>(false);
  public lastActiveUrl = '/';

  private pingInterval: any = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // Estado inicial
      this.isOnline.set(navigator.onLine);

      // Escuchar eventos nativos de red del navegador
      window.addEventListener('online', () => {
        this.checkConnection();
      });

      window.addEventListener('offline', () => {
        this.triggerOffline();
      });

      // Verificación inicial de internet real
      this.checkConnection();

      // Sondeo periódico ligero cada 6 segundos para detectar caídas de Wi-Fi instantáneamente
      this.pingInterval = setInterval(() => {
        if (!this.simulatedOffline()) {
          this.checkConnection(true);
        }
      }, 6000);
    }
  }

  public setSimulatedOffline(offline: boolean): void {
    this.simulatedOffline.set(offline);
    if (offline) {
      this.triggerOffline();
    } else {
      this.checkConnection();
    }
  }

  private triggerOffline(): void {
    this.isOnline.set(false);
    if (this.isBrowser) {
      const currentUrl = this.router.url;
      if (currentUrl && !currentUrl.includes('/offline')) {
        this.lastActiveUrl = currentUrl;
      }
      // Redirección automática inmediata al minijuego
      if (this.router.url !== '/offline') {
        this.router.navigate(['/offline']);
      }
    }
  }

  /**
   * Comprueba la conexión real a Internet haciendo un probe hacia un endpoint externo público.
   * Evita consultar localhost ya que el backend local responde aunque no haya Wi-Fi/Internet.
   */
  public async checkConnection(silent = false): Promise<boolean> {
    if (this.simulatedOffline()) {
      this.triggerOffline();
      return false;
    }

    if (!this.isBrowser) {
      return true;
    }

    if (!silent) {
      this.isChecking.set(true);
    }

    // Si el navegador ya reporta offline de forma nativa
    if (!navigator.onLine) {
      this.triggerOffline();
      if (!silent) this.isChecking.set(false);
      return false;
    }

    try {
      // Probe externo con timeout estricto de 2.2 segundos (no-cors para permitir probe sin problemas de CORS)
      const probeUrl = `https://www.google.com/generate_204?t=${Date.now()}`;
      await fetch(probeUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(2200),
      });

      // Si llegó aquí, hay conexión a Internet real
      const wasOffline = !this.isOnline();
      this.isOnline.set(true);
      if (!silent) this.isChecking.set(false);

      return true;
    } catch {
      // Fallback a segundo probe si el primero falló por timeout
      try {
        const fallbackUrl = `https://cloudflare.com/cdn-cgi/trace?t=${Date.now()}`;
        await fetch(fallbackUrl, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: AbortSignal.timeout(2000),
        });

        this.isOnline.set(true);
        if (!silent) this.isChecking.set(false);
        return true;
      } catch {
        // Definitivamente sin Internet
        this.triggerOffline();
        if (!silent) this.isChecking.set(false);
        return false;
      }
    }
  }
}
