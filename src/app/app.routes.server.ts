import { RenderMode, ServerRoute } from '@angular/ssr';

// App de gestión interna: CSR para todo.
// Las rutas protegidas dependen del token/sesión en localStorage del browser
// y `/auth/callback?code=…` consume un código de un solo uso (no aplica SSR).
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Client },
];
