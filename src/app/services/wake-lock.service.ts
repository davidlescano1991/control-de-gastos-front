import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class WakeLockService {
  private wakeLock: any = null;
  private isBrowser: boolean;
  private autoMaintain = true;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // Re-adquirir WakeLock automáticamente cuando el usuario regresa a la pestaña
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.autoMaintain && !this.wakeLock) {
          this.requestWakeLock();
        }
      });
    }
  }

  async requestWakeLock() {
    if (!this.isBrowser) return;

    try {
      if ('wakeLock' in navigator) {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
            console.log('⚡ [WakeLock] Liberado temporalmente');
          });
          console.log('⚡ [WakeLock] Pantalla activa y prevenida de apagado');
        }
      } else {
        console.warn('⚠️ [WakeLock] API no soportada en este navegador');
      }
    } catch (err) {
      if (err instanceof Error) {
        console.warn(`[WakeLock] No se pudo activar: ${err.message}`);
      }
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }
}