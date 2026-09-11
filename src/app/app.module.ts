import { NgModule, APP_INITIALIZER } from '@angular/core';
import { AppComponent } from './app.component';
// ListaMovimientos removed: import unused and caused ESLint error
import { RegistrarMovimiento } from './registrar-movimiento/registrar-movimiento';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { routes } from './app.routes';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { HttpClientModule } from '@angular/common/http';
import { AppConfigService } from './services/app-config.service';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { Inicio } from './pages/inicio/inicio';
// BreakpointObserver/Breakpoints removed: imports unused

@NgModule({
  imports: [
    HttpClientModule,
    BrowserModule,
    RouterModule.forRoot(routes),
    //ListaMovimientos,
    Inicio,
    RegistrarMovimiento,
    AppComponent,
    MatToolbarModule,
    MatButtonModule,
  ],
  providers: [
    provideCharts(withDefaultRegisterables()),
    {
      provide: APP_INITIALIZER,
      useFactory: (appConfig: AppConfigService) => () => appConfig.load(),
      deps: [AppConfigService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
