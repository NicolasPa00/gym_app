import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** La página pública del gimnasio no lleva sesión: no se le manda el token del personal. */
const RUTA_PUBLICA = /\/publico\//;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (RUTA_PUBLICA.test(req.url)) return next(req);
  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  if (token && !req.headers.has('Authorization')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
