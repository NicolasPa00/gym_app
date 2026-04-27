import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import {
  LUCIDE_ICONS, LucideIconProvider,
  Activity, TriangleAlert, BadgeCheck, BadgePercent, Banknote, Check, Dumbbell,
  FingerprintPattern, IdCard, LayoutDashboard, LogIn, LogOut, Monitor, Moon,
  Package, Pause, Pencil, Play, Plus, RefreshCw, ScanLine, Search, Settings,
  ShoppingCart, Sun, TrendingUp, Users, X, CreditCard, ArrowLeft,
} from 'lucide-angular';

const icons = {
  Activity, TriangleAlert, BadgeCheck, BadgePercent, Banknote, Check, Dumbbell,
  FingerprintPattern, IdCard, LayoutDashboard, LogIn, LogOut, Monitor, Moon,
  Package, Pause, Pencil, Play, Plus, RefreshCw, ScanLine, Search, Settings,
  ShoppingCart, Sun, TrendingUp, Users, X, CreditCard, ArrowLeft,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideClientHydration(withEventReplay()),
    { provide: LUCIDE_ICONS, multi: true, useValue: new LucideIconProvider(icons) },
  ],
};
