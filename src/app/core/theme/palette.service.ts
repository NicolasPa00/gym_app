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

const PALETTE_CACHE_KEY = 'gym_palette';

/**
 * Aplica la paleta del negocio activo a través de CSS custom properties en <html>.
 * Permite listar paletas disponibles y persistir la seleccionada en backend.
 */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);

  readonly paletas = signal<PaletaColor[]>([]);
  readonly active = signal<PaletaColor | null>(null);

  async loadPaletas(): Promise<PaletaColor[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: PaletaColor[] }>(`${environment.apiUrl}/paletas`)
      );
      const list = res?.data ?? [];
      this.paletas.set(list);
      return list;
    } catch {
      return [];
    }
  }

  apply(p: PaletaColor | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const root = this.document.documentElement;
    // Limpia la paleta anterior
    const prev = this.active();
    if (prev) {
      Object.keys(prev.colores).forEach(k => root.style.removeProperty(`--${k}`));
    }
    if (p) {
      Object.entries(p.colores).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
      localStorage.setItem(PALETTE_CACHE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(PALETTE_CACHE_KEY);
    }
    this.active.set(p);
  }

  /** Restaura la última paleta cacheada para evitar flash al iniciar. */
  restoreFromCache(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = localStorage.getItem(PALETTE_CACHE_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as PaletaColor;
      this.apply(p);
    } catch { /* ignore */ }
  }

  savePaletaParaNegocio(idNegocio: number, idPaleta: number | null): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/negocios/${idNegocio}/paleta`, { id_paleta: idPaleta });
  }
}
