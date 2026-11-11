import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { MarcaGimnasio, PaginaConfig, TextoAutorizacion, TipoAutorizacion } from '../../core/models';
import { urlRecurso } from '../../core/url-recurso';
import {
  PALETAS_NEGOCIO_ACTIVAS,
  PaletaColor,
  PaletteService,
} from '../../core/theme/palette.service';
import { LectoresComponent } from './lectores/lectores';
import { reducirImagen } from './reducir-imagen';

type Seccion = 'pagina' | 'datos' | 'lectores';
type Aviso = { tipo: 'ok' | 'err'; texto: string } | null;

/**
 * Configuración del gimnasio:
 *  · «Mi página»: la página pública (`/t/:slug`), con su logo, portada, color, textos y contacto.
 *  · «Datos sensibles»: los textos de autorización que firma cada miembro (Ley 1581).
 *  · «Lectores»: los lectores de huella de la puerta (lectores/).
 */
@Component({
  selector: 'gym-configuracion',
  standalone: true,
  imports: [LucideAngularModule, FormsModule, LectoresComponent],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);
  readonly palette = inject(PaletteService);

  readonly paletasActivas = PALETAS_NEGOCIO_ACTIVAS;
  readonly seccion = signal<Seccion>('pagina');
  readonly negocio = computed(() => this.auth.negocio());

  // ── Mi página ──
  readonly pagina = signal<PaginaConfig | null>(null);
  readonly marca = signal<MarcaGimnasio | null>(null);
  readonly form = signal<Partial<PaginaConfig>>({});
  readonly slugForm = signal('');
  readonly colorForm = signal('#5d5497');
  readonly cargandoPagina = signal(true);
  readonly guardando = signal(false);
  readonly subiendo = signal<'logo' | 'banner' | null>(null);
  readonly aviso = signal<Aviso>(null);
  readonly copiado = signal(false);

  readonly logo = computed(() => urlRecurso(this.marca()?.logo_url));
  readonly portada = computed(() => urlRecurso(this.marca()?.banner_url));
  readonly hayCambios = computed(() => {
    const p = this.pagina();
    const f = this.form();
    if (!p) return false;
    return (Object.keys(f) as (keyof PaginaConfig)[]).some((k) => f[k] !== p[k]);
  });

  // ── Datos sensibles ──
  readonly textos = signal<TextoAutorizacion[]>([]);
  readonly errorTextos = signal(false);

  // ── Paletas (apagadas) ──
  readonly cargandoPaletas = signal(false);
  readonly guardandoPaleta = signal<number | null>(null);

  ngOnInit(): void {
    this.cargarPagina();
    this.cargarTextos();
    if (this.paletasActivas && this.palette.paletas().length === 0) {
      this.cargandoPaletas.set(true);
      void this.palette.loadPaletas().finally(() => this.cargandoPaletas.set(false));
    }
  }

  private get idNegocio(): number | null {
    return this.negocio()?.id_negocio ?? null;
  }

  private cargarPagina(): void {
    const id = this.idNegocio;
    if (!id) return;
    this.cargandoPagina.set(true);
    this.api.obtenerPagina(id).subscribe({
      next: (r) => {
        const p = r?.data ?? null;
        this.pagina.set(p);
        this.form.set(p ? this.editable(p) : {});
        this.slugForm.set(p?.slug ?? '');
        this.cargandoPagina.set(false);
      },
      error: (e) => {
        this.cargandoPagina.set(false);
        this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo cargar la página.' });
      },
    });
    this.api.obtenerMarca(id).subscribe({
      next: (r) => {
        const m = r?.data ?? null;
        this.marca.set(m);
        if (m?.colores?.primario) this.colorForm.set(m.colores.primario.toLowerCase());
      },
    });
  }

  /** Solo los campos de texto que se editan en el formulario (la URL y los avisos no). */
  private editable(p: PaginaConfig): Partial<PaginaConfig> {
    const { frase, descripcion, horario_texto, servicios, mapa_url, whatsapp, direccion,
      url_instagram, url_facebook, url_tiktok, creditos_fotos } = p;
    return { frase, descripcion, horario_texto, servicios, mapa_url, whatsapp, direccion,
      url_instagram, url_facebook, url_tiktok, creditos_fotos };
  }

  campo<K extends keyof PaginaConfig>(k: K, v: PaginaConfig[K]): void {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  guardar(): void {
    const id = this.idNegocio;
    if (!id) return;
    this.guardando.set(true);
    this.aviso.set(null);
    this.api.guardarPagina(id, this.form()).subscribe({
      next: (r) => {
        const p = r?.data ?? null;
        this.pagina.set(p);
        if (p) this.form.set(this.editable(p));
        this.guardando.set(false);
        this.aviso.set({ tipo: 'ok', texto: 'Cambios guardados.' });
      },
      error: (e) => {
        this.guardando.set(false);
        this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo guardar.' });
      },
    });
  }

  /** Publicar o despublicar se guarda al tocarlo (con los cambios que haya en el formulario). */
  alternarPublicada(activa: boolean): void {
    const id = this.idNegocio;
    if (!id) return;
    this.guardando.set(true);
    this.aviso.set(null);
    this.api.guardarPagina(id, { ...this.form(), pagina_activa: activa }).subscribe({
      next: (r) => {
        const p = r?.data ?? null;
        this.pagina.set(p);
        if (p) this.form.set(this.editable(p));
        this.guardando.set(false);
        this.aviso.set({ tipo: 'ok', texto: activa ? 'Tu página ya está publicada.' : 'Tu página quedó oculta.' });
      },
      error: (e) => {
        this.guardando.set(false);
        this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo cambiar.' });
      },
    });
  }

  guardarSlug(): void {
    const id = this.idNegocio;
    const slug = this.slugForm().trim().toLowerCase();
    if (!id || !slug) return;
    this.aviso.set(null);
    this.api.guardarSlug(id, slug).subscribe({
      next: () => {
        this.aviso.set({ tipo: 'ok', texto: 'Dirección de la página guardada.' });
        this.cargarPagina();
      },
      error: (e) => this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo guardar la dirección.' }),
    });
  }

  guardarColor(): void {
    const id = this.idNegocio;
    if (!id) return;
    this.aviso.set(null);
    this.api.guardarColor(id, this.colorForm()).subscribe({
      next: () => {
        this.aviso.set({ tipo: 'ok', texto: 'Color guardado.' });
        this.marca.update((m) => (m ? { ...m, colores: { primario: this.colorForm(), acento: this.colorForm() } } : m));
      },
      error: (e) => this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo guardar el color.' }),
    });
  }

  async elegirImagen(tipo: 'logo' | 'banner', evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    const id = this.idNegocio;
    if (!archivo || !id) return;
    this.subiendo.set(tipo);
    this.aviso.set(null);
    try {
      const blob = tipo === 'logo' ? await reducirImagen(archivo, 512, 512) : await reducirImagen(archivo, 1600, 900);
      this.api.subirImagen(id, tipo, blob).subscribe({
        next: (r) => {
          const url = r?.data?.[`${tipo}_url`] ?? null;
          this.marca.update((m) => (m ? { ...m, [`${tipo}_url`]: url } : m));
          this.subiendo.set(null);
          this.aviso.set({ tipo: 'ok', texto: tipo === 'logo' ? 'Logo actualizado.' : 'Portada actualizada.' });
        },
        error: (e) => {
          this.subiendo.set(null);
          this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo subir la imagen.' });
        },
      });
    } catch (e) {
      this.subiendo.set(null);
      this.aviso.set({ tipo: 'err', texto: (e as Error).message || 'No se pudo leer la imagen.' });
    }
  }

  quitarImagen(tipo: 'logo' | 'banner'): void {
    const id = this.idNegocio;
    if (!id) return;
    this.api.eliminarImagen(id, tipo).subscribe({
      next: () => this.marca.update((m) => (m ? { ...m, [`${tipo}_url`]: null } : m)),
      error: (e) => this.aviso.set({ tipo: 'err', texto: e?.error?.message || 'No se pudo quitar la imagen.' }),
    });
  }

  async copiarEnlace(): Promise<void> {
    const url = this.pagina()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.aviso.set({ tipo: 'err', texto: 'No se pudo copiar. Selecciona el enlace y cópialo a mano.' });
    }
  }

  // ── Datos sensibles ──
  private cargarTextos(): void {
    const id = this.idNegocio;
    if (!id) return;
    this.api.textosAutorizacion(id).subscribe({
      next: (r) => {
        const d = r?.data;
        const orden: TipoAutorizacion[] = ['BIOMETRIA', 'SALUD'];
        this.textos.set(d ? orden.map((t) => d[t]).filter(Boolean) : []);
      },
      error: () => this.errorTextos.set(true),
    });
  }

  // ── Paletas (solo si se vuelven a encender) ──
  esActiva(p: PaletaColor): boolean {
    const neg = this.negocio();
    if (!neg) return false;
    const idActual = this.palette.active()?.id_paleta ?? (neg.paleta as PaletaColor | null)?.id_paleta;
    return idActual === p.id_paleta;
  }

  seleccionarPaleta(p: PaletaColor): void {
    const id = this.idNegocio;
    if (!id) return;
    this.guardandoPaleta.set(p.id_paleta);
    this.palette.savePaletaParaNegocio(id, p.id_paleta).subscribe({
      next: () => {
        this.palette.apply(p);
        this.guardandoPaleta.set(null);
      },
      error: () => this.guardandoPaleta.set(null),
    });
  }
}
