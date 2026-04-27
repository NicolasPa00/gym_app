import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

import { AuthService } from '../services/auth.service';
import { PaletteService } from '../theme/palette.service';
import { environment } from '../../../environments/environment';

function applyPaletaSiHay(auth: AuthService, palette: PaletteService): void {
  const p = auth.negocio()?.paleta;
  if (p) palette.apply(p as never);
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const palette = inject(PaletteService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true;

  if (auth.isAuthenticated()) {
    if (auth.session()?.permisos_cargados !== true) {
      const ok = await refreshFromStored(auth);
      if (!ok) { auth.logout(); return false; }
    }
    applyPaletaSiHay(auth, palette);
    return true;
  }

  const stored = auth.getAccessToken();
  if (stored) {
    const ok = await auth.validateAndSetToken(stored);
    if (ok) { applyPaletaSiHay(auth, palette); return true; }
    auth.logout();
    return false;
  }

  // Sin sesión → al admin
  window.location.href = `${environment.adminUrl}/auth/login`;
  return false;
};

export const permissionGuard: CanActivateChildFn = (childRoute, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true;

  const path = childRoute.routeConfig?.path;
  const requested = path && path !== '**'
    ? `/${path.replace(/^\//, '')}`
    : `/${state.url.split('/').filter(Boolean)[0] || 'dashboard'}`;

  if (auth.canAccessRoute(requested)) return true;
  const fallback = auth.getFirstAccessibleRoute();
  if (fallback && fallback !== requested) return router.parseUrl(fallback);
  return router.parseUrl('/sin-acceso');
};

/**
 * Bloquea el acceso a rutas de funcionalidad si el negocio no tiene plan activo.
 * Permite siempre: dashboard, sin-acceso, sin-plan.
 */
export const planGuard: CanActivateFn = (_route, state) => {
  const auth      = inject(AuthService);
  const router    = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true;

  const path = state.url.split('?')[0].replace(/^\//, '');
  if (!path || path === 'dashboard' || path === 'sin-acceso' || path === 'sin-plan') {
    return true;
  }

  if (auth.planActivo()) return true;
  return router.parseUrl('/sin-plan');
};

async function refreshFromStored(auth: AuthService): Promise<boolean> {
  const t = auth.getAccessToken();
  if (!t) return false;
  return auth.validateAndSetToken(t);
}
