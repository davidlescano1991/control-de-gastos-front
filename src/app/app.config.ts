import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { RegistrarMovimiento } from './registrar-movimiento/registrar-movimiento';
import { Mensual } from './pages/mensual/mensual';
import { Inicio } from './pages/inicio/inicio';
import { HomeEstimativo } from './pages/estimativos/home';
import { Anual } from './pages/anual/anual/anual';
import { AppConfigService } from './services/app-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideAppInitializer(() => inject(AppConfigService).load()),
    provideRouter([
      { path: '', component: Inicio },
      { path: 'mensual', component: Mensual },
      { path: 'nuevo', component: RegistrarMovimiento },
      { path: 'estimativo', component: HomeEstimativo },
      { path: 'anual', component: Anual },
    ]),
  ],
};
