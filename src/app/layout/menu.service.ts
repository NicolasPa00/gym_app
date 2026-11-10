import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CLAVE_COLAPSADO = 'gym_menu_colapsado';

/**
 * Estado del menú lateral, compartido entre el menú (que lo cambia) y el layout (que corre el
 * contenido a la izquierda para ganar ancho). Se recuerda por navegador.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _colapsado = signal(this.leer());

  readonly colapsado = this._colapsado.asReadonly();

  alternar(): void {
    const nuevo = !this._colapsado();
    this._colapsado.set(nuevo);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(CLAVE_COLAPSADO, nuevo ? '1' : '0');
    } catch {
      /* sin almacenamiento: el menú se queda como está en esta visita */
    }
  }

  private leer(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return localStorage.getItem(CLAVE_COLAPSADO) === '1';
    } catch {
      return false;
    }
  }
}
