import { environment } from '../../environments/environment';

/**
 * Las imágenes subidas (logo, portada) las sirve el BACKEND en `/uploads/...`, no esta app. El
 * backend las devuelve como ruta relativa, así que hay que pegarles su origen
 * (`https://api.escalapp.cloud` en producción, `http://localhost:3000` en desarrollo).
 */
const ORIGEN_API = new URL(environment.apiUrl).origin;

export function urlRecurso(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return /^https?:\/\//i.test(ruta) ? ruta : `${ORIGEN_API}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}
