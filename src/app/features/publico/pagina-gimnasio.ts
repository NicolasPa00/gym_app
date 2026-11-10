import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, LocationStrategy, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';

import { GimnasioPublico, PlanPublico, ProductoPublico, PublicoService } from './publico.service';
import { colorDelGimnasio, legibleConBlanco } from './colores';
import { estadoAhora, leerHorario, lineaDelDia } from './horario';
import { urlRecurso } from '../../core/url-recurso';
import { RevelarDirective } from './revelar.directive';

/** Un plan tal como lo pinta la página: con lo que sale al mes y lo que se ahorra. */
export interface PlanVista extends PlanPublico {
  /** «Por un mes», «3 meses». */
  duracion: string;
  /** Precio dividido por los meses; null si es de un mes. */
  porMes: number | null;
  /** Frente a pagar el plan mensual tantas veces; null si no ahorra. */
  ahorro: number | null;
  /** El que más ahorra. Es un dato, no un «el más vendido» inventado. */
  destacado: boolean;
}

/**
 * Los planes con su cuenta hecha. La referencia para el ahorro es el plan de un mes MÁS CARO
 * (una tiquetera de un mes suele ser más barata y no sirve de comparación: da ahorros negativos).
 */
export function planesConCuenta(planes: PlanPublico[]): PlanVista[] {
  const mensual = Math.max(0, ...planes.filter((p) => p.duracion_meses === 1).map((p) => p.precio));
  const vistas = planes.map((p): PlanVista => {
    const meses = Math.max(1, p.duracion_meses);
    const ahorro = mensual && meses > 1 ? Math.round(mensual * meses - p.precio) : 0;
    return {
      ...p,
      duracion: meses === 1 ? 'Por un mes' : `${meses} meses`,
      porMes: meses > 1 ? Math.round(p.precio / meses) : null,
      ahorro: ahorro > 0 ? ahorro : null,
      destacado: false,
    };
  });
  const mejor = vistas.reduce<PlanVista | null>((m, p) => (p.ahorro && (!m || p.ahorro > (m.ahorro ?? 0)) ? p : m), null);
  if (mejor) mejor.destacado = true;
  return vistas;
}

/**
 * Página pública del gimnasio: `/t/:slug` o `/p/:id_negocio`.
 *
 * Dirección elegida por el dueño el 2026-11-09 (tercera, después de «Colour chapters» y «Split
 * stage», ambas descartadas por exageradas): una FICHA DE NEGOCIO. Portada con la tarjeta del
 * gimnasio montada encima (nombre, dirección, si está abierto, desde cuánto cuestan los planes),
 * los planes en tarjetas a todo el ancho y debajo dos columnas: lo que se lee (el gimnasio, la
 * tienda) y lo que se consulta (horario, ubicación, WhatsApp), que en escritorio se queda fijo.
 *
 * La FORMA es la de EscalApp (la misma familia que el menú digital y Celulares); los COLORES son
 * del gimnasio: todo sale de `--c` con `color-mix` (fondo, textos, la tarjeta oscura). Sin color
 * propio queda el violeta de EscalApp. Todo lleva a WhatsApp con el mensaje ya escrito, y nunca
 * muestra miembros ni datos internos (paginaService.infoPublica).
 */
@Component({
  selector: 'gym-pagina-gimnasio',
  standalone: true,
  imports: [LucideAngularModule, CurrencyPipe, RevelarDirective],
  templateUrl: './pagina-gimnasio.html',
  styleUrl: './pagina-gimnasio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--c]': 'color()' },
})
export class PaginaGimnasioComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicoService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly locationStrategy = inject(LocationStrategy);

  readonly info = signal<GimnasioPublico | null>(null);
  readonly cargando = signal(true);
  readonly noDisponible = signal(false);
  readonly categoriaSel = signal<string | null>(null);
  readonly seccionActiva = signal<string | null>(null);

  /**
   * La hora del visitante. Solo existe en el navegador: en el servidor no se sabe a qué hora se
   * va a mirar la página, y pintar «Abierto» desde el prerender sería mentir más tarde.
   */
  private readonly ahora = signal<Date | null>(null);

  readonly sitioEscalapp = 'https://escalapp.cloud/';
  readonly anio = new Date().getFullYear();

  constructor() {
    afterNextRender(() => {
      this.ahora.set(new Date());
      const reloj = setInterval(() => this.ahora.set(new Date()), 60_000);
      this.destroyRef.onDestroy(() => clearInterval(reloj));
    });
  }

  readonly color = computed(() => {
    const i = this.info();
    return legibleConBlanco(colorDelGimnasio(i?.colores, i?.paleta));
  });

  readonly logo = computed(() => urlRecurso(this.info()?.logo_url));
  readonly portada = computed(() => urlRecurso(this.info()?.banner_url));

  readonly iniciales = computed(() =>
    (this.info()?.nombre ?? '')
      .split(/\s+/)
      .filter((p) => /^[\p{L}\p{N}]/u.test(p))
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join(''),
  );

  readonly planes = computed(() => planesConCuenta(this.info()?.planes ?? []));

  /** «Planes desde $X al mes»: el plan que menos cuesta al mes. */
  readonly desdeAlMes = computed(() => {
    const planes = this.info()?.planes ?? [];
    if (!planes.length) return null;
    return Math.min(...planes.map((p) => p.precio / Math.max(1, p.duracion_meses)));
  });

  readonly nombreMoneda = computed(() => {
    const m = this.info()?.moneda || 'COP';
    return m === 'USD' ? 'dólares' : m === 'EUR' ? 'euros' : 'pesos';
  });

  readonly horario = computed(() => leerHorario(this.info()?.horario));

  readonly lineaHoy = computed(() => {
    const ahora = this.ahora();
    if (!ahora) return -1;
    const l = lineaDelDia(this.horario(), ahora.getDay());
    return l ? this.horario().indexOf(l) : -1;
  });

  readonly estado = computed(() => {
    const ahora = this.ahora();
    return ahora ? estadoAhora(this.horario(), ahora) : null;
  });

  readonly secciones = computed(() => {
    const g = this.info();
    if (!g) return [];
    return [
      g.planes.length ? { id: 'planes', nombre: 'Planes' } : null,
      g.descripcion || g.servicios.length ? { id: 'gimnasio', nombre: 'El gimnasio' } : null,
      g.productos.length ? { id: 'tienda', nombre: 'Tienda' } : null,
      // En el celular solo «Horario», para que las cuatro quepan sin cortarse en el borde.
      g.horario || g.direccion ? { id: 'horario', nombre: g.horario ? 'Horario' : 'Ubicación', resto: g.horario && g.direccion ? ' y ubicación' : '' } : null,
    ].filter((s): s is { id: string; nombre: string; resto?: string } => !!s);
  });

  readonly categorias = computed(() => [...new Set((this.info()?.productos ?? []).map((p) => p.categoria))]);

  readonly productos = computed(() => {
    const todos = this.info()?.productos ?? [];
    const cat = this.categoriaSel();
    const lista = cat ? todos.filter((p) => p.categoria === cat) : todos;
    // Primero lo que tiene foto y está disponible: es lo que vende; lo agotado va al final.
    const peso = (p: ProductoPublico) => (p.disponible ? 0 : 2) + (p.foto_url ? 0 : 1);
    return [...lista].sort((x, y) => peso(x) - peso(y));
  });

  readonly numeroWhatsapp = computed(() => {
    const wa = this.info()?.whatsapp;
    const m = wa ? /wa\.me\/(\d+)/.exec(wa) : null;
    if (!m) return null;
    const d = m[1];
    // +57 300 123 4567 (Colombia); otros países se muestran con su prefijo, sin más formato.
    return d.startsWith('57') && d.length === 12 ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`;
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const id = Number(this.route.snapshot.paramMap.get('id_negocio'));
    const peticion = slug ? this.api.porSlug(slug) : id ? this.api.porId(id) : null;
    if (!peticion) {
      this.cargando.set(false);
      this.noDisponible.set(true);
      return;
    }
    peticion.subscribe({
      next: (r) => {
        const i = r?.data ?? null;
        this.info.set(i);
        this.noDisponible.set(!i);
        this.cargando.set(false);
        if (i) {
          this.ponerMeta(i);
          this.seguirSecciones();
        }
      },
      error: () => {
        this.noDisponible.set(true);
        this.cargando.set(false);
        this.title.setTitle('Página no disponible');
      },
    });
  }

  /** El índice marca la sección que ocupa la franja central de la pantalla. */
  private seguirSecciones(): void {
    if (!this.navegador || !('IntersectionObserver' in window)) return;
    // Las secciones existen después del siguiente pintado.
    requestAnimationFrame(() => {
      const nodos = document.querySelectorAll<HTMLElement>('[data-seccion]');
      if (!nodos.length) return;
      const obs = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) if (e.isIntersecting) this.seccionActiva.set(e.target.id);
        },
        { rootMargin: '-35% 0px -55% 0px' },
      );
      nodos.forEach((n) => obs.observe(n));
      this.destroyRef.onDestroy(() => obs.disconnect());
    });
  }

  private ponerMeta(i: GimnasioPublico): void {
    const titulo = i.frase ? `${i.nombre} · ${i.frase}` : i.nombre;
    const descripcion = i.descripcion || i.frase || `Planes, tienda, horario y ubicación de ${i.nombre}. Escríbenos por WhatsApp.`;
    this.title.setTitle(titulo);
    this.meta.updateTag({ name: 'description', content: descripcion });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descripcion });
    this.meta.updateTag({ name: 'theme-color', content: legibleConBlanco(colorDelGimnasio(i.colores, i.paleta)) });
    const imagen = urlRecurso(i.banner_url || i.logo_url);
    if (imagen) this.meta.updateTag({ property: 'og:image', content: imagen });
  }

  /**
   * Enlace a una sección de ESTA página. Un `href="#tienda"` suelto se resuelve contra
   * `<base href="/gym/">` y lleva a `/gym/#tienda`, o sea al panel: hay que escribir la ruta entera.
   */
  enlaceSeccion(id: string): string {
    // `prepareExternalUrl` añade la base (/gym/ en producción), también en el render del servidor.
    return `${this.locationStrategy.prepareExternalUrl(this.router.url.split('#')[0])}#${id}`;
  }

  /** Baja hasta la sección sin pasar por el router. */
  irA(evento: MouseEvent, id: string): void {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    const destino = document.getElementById(id);
    if (!destino) return;
    evento.preventDefault();
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${id}`);
  }

  elegirCategoria(c: string | null): void {
    this.categoriaSel.set(c);
  }

  /** Enlace a WhatsApp con el mensaje ya escrito. */
  whatsapp(mensaje: string): string | null {
    const base = this.info()?.whatsapp;
    return base ? `${base}?text=${encodeURIComponent(mensaje)}` : null;
  }

  mensajeGeneral(): string {
    return `Hola, vi la página de ${this.info()?.nombre ?? 'su gimnasio'} y quiero información para inscribirme.`;
  }

  mensajePlan(p: PlanPublico): string {
    return `Hola, quiero inscribirme en el plan ${p.nombre} de ${this.info()?.nombre ?? 'su gimnasio'}.`;
  }

  mensajeProducto(p: ProductoPublico): string {
    return `Hola, quiero pedir ${p.nombre} en ${this.info()?.nombre ?? 'el gimnasio'}. ¿Lo tienen disponible?`;
  }

  fotoProducto(p: ProductoPublico): string | null {
    return urlRecurso(p.foto_url);
  }

  /** Ícono de respaldo cuando el producto no tiene foto. */
  iconoCategoria(c: string): string {
    const t = c.toLowerCase();
    if (/bebid|agua|hidrat/.test(t)) return 'droplet';
    if (/suplement|prote|creatin|nutri/.test(t)) return 'flask';
    if (/casa|equipo|pesa|disco/.test(t)) return 'barbell';
    return 'shopping-bag';
  }
}
