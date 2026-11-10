import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface PaletaColor {
  id_paleta: number;
  nombre: string;
  descripcion: string | null;
  /** clave = nombre del CSS custom property sin `--` */
  colores: Record<string, string>;
  es_default: boolean;
  estado: 'A' | 'I';
}

/** Clave vieja: guardaba la paleta COMPLETA (fondo, texto, éxito…). Se borra al arrancar. */
const PALETTE_CACHE_KEY = 'gym_palette';

/**
 * Paletas por negocio APAGADAS (2026-11-09), igual que en `restaurante_app` desde 2026-10-29.
 *
 * Con la identidad de EscalApp el gimnasio se ve como el panel y el restaurante: fondo lavanda,
 * barra azul noche, acento violeta. Antes, la paleta del negocio reescribía TODO —fondo, texto,
 * bordes, éxito, error— y dejaba la vertical con colores que no eran de la marca ni del negocio.
 *
 * Volver a encenderlas = poner esto en `true`: el selector de Configuración vuelve solo y la
 * paleta pinta únicamente el acento (`TOKENS_DEL_NEGOCIO`).
 */
export const PALETAS_NEGOCIO_ACTIVAS = false;

/** En BD una paleta corta es `{ primario, acento }`; el tema lee `--color-primary(-hover)`. */
const TOKENS_ALIAS: Record<string, string[]> = {
  primario: ['color-primary'],
  acento: ['color-primary-hover'],
};

/** Lo ÚNICO que una paleta puede cambiar: el acento del negocio. Lo demás es la marca. */
const TOKENS_DEL_NEGOCIO = new Set([
  'color-primary',
  'color-primary-hover',
  'color-on-primary',
  'color-focus',
]);

function tokensDe(clave: string): string[] {
  return [clave, ...(TOKENS_ALIAS[clave] ?? [])].filter((t) => TOKENS_DEL_NEGOCIO.has(t));
}

/**
 * Paleta del negocio activo. Hoy no pinta nada (ver `PALETAS_NEGOCIO_ACTIVAS`); se conserva
 * para listar y guardar la elección, que el backend sigue aceptando.
 */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);

  readonly paletas = signal<PaletaColor[]>([]);
  readonly active = signal<PaletaColor | null>(null);

  constructor() {
    // Quien entró antes de la identidad tiene la paleta completa en caché: se descarta.
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(PALETTE_CACHE_KEY);
      } catch {
        /* almacenamiento bloqueado: no hay nada que limpiar */
      }
    }
  }

  async loadPaletas(): Promise<PaletaColor[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: PaletaColor[] }>(`${environment.apiUrl}/paletas`),
      );
      const list = res?.data ?? [];
      this.paletas.set(list);
      return list;
    } catch {
      return [];
    }
  }

  apply(p: PaletaColor | null): void {
    this.active.set(p);
    if (!isPlatformBrowser(this.platformId) || !PALETAS_NEGOCIO_ACTIVAS) return;

    const root = this.document.documentElement;
    for (const token of TOKENS_DEL_NEGOCIO) root.style.removeProperty(`--${token}`);
    if (!p) return;
    Object.entries(p.colores ?? {}).forEach(([clave, valor]) => {
      if (!valor) return;
      for (const token of tokensDe(clave)) root.style.setProperty(`--${token}`, valor);
    });
  }

  savePaletaParaNegocio(idNegocio: number, idPaleta: number | null): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/negocios/${idNegocio}/paleta`, {
      id_paleta: idPaleta,
    });
  }
}
