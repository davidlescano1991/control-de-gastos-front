// wake-lock.service.ts
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class WakeLockService {
    private wakeLock: any = null;

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock liberado');
                });
                console.log('Wake Lock activado');
            } else {
                console.warn('Wake Lock API no está disponible en este navegador');
            }
        } catch (err) {
            if (err instanceof Error) {
                console.error(`${err.name}, ${err.message}`);
            } else {
                console.error('Error desconocido', err);
            }
        }
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    }
}