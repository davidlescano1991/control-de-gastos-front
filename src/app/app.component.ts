import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from './services/theme.service';
import { MovimientosStoreGoogle } from './stores/movimiento.google';

type AppWindow = Window & { __APP_VERSION__?: string };

export interface Tile {
  color: string;
  cols: number;
  rows: number;
  text: string;
}
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [
    RouterModule,
    MatButtonModule,
    MatToolbarModule,
    MatGridListModule,
    MatCardModule,
    MatMenuModule,
    MatIconModule,
    CommonModule,
  ],
  styleUrls: ['./app.scss'],
})
export class AppComponent {
  isMobile = false;
  readonly appVersion = this.obtenerVersionApp();
  private breakpointObserver = inject(BreakpointObserver);
  private themeService = inject(ThemeService);
  private storeGoogle = inject(MovimientosStoreGoogle);

  constructor() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe((result) => {
      this.isMobile = result.matches;
      console.log('¿Es móvil?', this.isMobile);
    });
  }

  get isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  recargarDatos(): void {
    this.storeGoogle.limpiarStorageYRecargar();
    window.location.reload();
  }

  private obtenerVersionApp(): string {
    if (typeof window === 'undefined') return 'V1.0.dev';

    const version = (window as AppWindow).__APP_VERSION__;
    if (!version || version === '__APP_VERSION__') return 'V1.0.dev';

    return version;
  }
}
