import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models';

export interface PlanPublico {
  id_plan: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracion_meses: number;
  beneficios: string[];
}

export interface ProductoPublico {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  precio: number;
  foto_url: string | null;
  /** Hay o no hay; el número nunca viaja. */
  disponible: boolean;
}

export interface GimnasioPublico {
  id_negocio: number;
  nombre: string;
  slug: string | null;
  url: string;
  logo_url: string | null;
  banner_url: string | null;
  colores: { primario?: string; acento?: string } | null;
  paleta: { colores: Record<string, string> } | null;
  /** Código ISO de la moneda (COP, CLP…). */
  moneda: string;
  whatsapp: string | null;
  telefono: string | null;
  direccion: string | null;
  mapa_url: string | null;
  redes: { instagram: string | null; facebook: string | null; tiktok: string | null };
  frase: string | null;
  descripcion: string | null;
  horario: string | null;
  servicios: string[];
  planes: PlanPublico[];
  productos: ProductoPublico[];
  creditos_fotos: string | null;
}

/** Lectura de la página pública (sin sesión): por su nombre propio o por id. */
@Injectable({ providedIn: 'root' })
export class PublicoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/publico`;

  porSlug(slug: string) {
    return this.http.get<ApiResponse<GimnasioPublico>>(`${this.base}/dominio/${encodeURIComponent(slug)}`);
  }

  porId(idNegocio: number) {
    return this.http.get<ApiResponse<GimnasioPublico>>(`${this.base}/${idNegocio}/info`);
  }
}
