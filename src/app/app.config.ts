import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
// Iconografía Phosphor, igual que el panel y el restaurante (ver scripts/iconos/generar.mjs).
// Se registra el pack entero: lo genera scripts/iconos/generar.mjs solo para esta app.
import * as icons from './core/icons/phosphor';

// Fechas y pesos en español de Colombia («9 nov 2026», «$ 50.000»), como el restaurante.
registerLocaleData(localeEsCO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideClientHydration(withEventReplay()),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider({ ...icons }) },
  ],
};
