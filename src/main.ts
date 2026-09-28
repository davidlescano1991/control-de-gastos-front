import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';

registerLocaleData(localeEsAr);

/* bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err)); */
bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []), // 👈 conserva tus otros providers
    provideCharts(withDefaultRegisterables()) // 👈 registra Chart.js
  ]
}).catch((err) => console.error(err));


