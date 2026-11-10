import { Directive, ElementRef, OnDestroy, OnInit, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Hace que una pieza de la página aparezca al entrar en pantalla (una sola vez).
 *
 * El estado oculto solo existe si el navegador lo puede deshacer: la clase `rv` la pone el propio
 * script, así que sin JavaScript, en el render del servidor o con «reducir movimiento» el contenido
 * se ve desde el principio. `revelar` = orden dentro de la sección (escalona 70 ms por paso).
 */
@Directive({ selector: '[revelar]', standalone: true })
export class RevelarDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly revelar = input<number | string>(0);
  private observador?: IntersectionObserver;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const nodo = this.el.nativeElement;
    const paso = Number(this.revelar()) || 0;
    nodo.style.setProperty('--rv-i', String(paso));
    nodo.classList.add('rv');
    this.observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          nodo.classList.add('rv-in');
          this.observador?.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    this.observador.observe(nodo);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }
}
