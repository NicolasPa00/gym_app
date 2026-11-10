import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../menu.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  seccion: 'principal' | 'gestion';
}

/** Íconos con variante rellena en el pack (`CON_FILL` de scripts/iconos/generar.mjs). */
const CON_RELLENO = new Set([
  'layout-dashboard', 'door-open', 'users', 'badge-percent', 'id-card', 'package',
  'shopping-cart', 'banknote', 'settings',
]);

/** Accesos que caben en la barra inferior del celular; el resto va en «Más». */
const EN_BARRA = 4;

/**
 * Menú del gimnasio con la identidad de EscalApp (2026-11-09), el mismo patrón que el restaurante:
 * barra azul noche con el logo blanco, ítem activo en lavanda y su ícono relleno, riel de íconos
 * en tableta (o plegado a mano en escritorio) y barra inferior con «Más» en el celular.
 */
@Component({
  selector: 'gym-sidebar',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly items: NavItem[] = [
    { icon: 'layout-dashboard', label: 'Dashboard', route: '/dashboard', seccion: 'principal' },
    { icon: 'door-open', label: 'Ingreso', route: '/ingreso', seccion: 'principal' },
    { icon: 'users', label: 'Miembros', route: '/miembros', seccion: 'principal' },
    { icon: 'id-card', label: 'Membresías', route: '/membresias', seccion: 'principal' },
    { icon: 'banknote', label: 'Pagos', route: '/pagos', seccion: 'principal' },
    { icon: 'badge-percent', label: 'Planes', route: '/planes', seccion: 'gestion' },
    { icon: 'package', label: 'Productos', route: '/productos', seccion: 'gestion' },
    { icon: 'shopping-cart', label: 'Ventas', route: '/ventas', seccion: 'gestion' },
    { icon: 'settings', label: 'Configuración', route: '/configuracion', seccion: 'gestion' },
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly permitidos = computed(() => this.items.filter((i) => this.auth.canAccessRoute(i.route)));
  readonly principales = computed(() => this.permitidos().filter((i) => i.seccion === 'principal'));
  readonly gestion = computed(() => this.permitidos().filter((i) => i.seccion === 'gestion'));
  readonly enBarra = computed(() => this.permitidos().slice(0, EN_BARRA));
  readonly enMas = computed(() => this.permitidos().slice(EN_BARRA));

  private readonly menu = inject(MenuService);
  readonly colapsado = this.menu.colapsado;
  readonly masAbierto = signal(false);
  /** «Administrador», no «ADMINISTRADOR»: los roles se guardan en mayúsculas. */
  readonly rol = computed(() => {
    const r = this.auth.rolPrincipal() || '';
    return r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : '';
  });

  estaActivo(item: NavItem): boolean {
    const url = (this.url() ?? '').split('?')[0];
    return url === item.route || url.startsWith(`${item.route}/`);
  }

  iconoDe(item: NavItem): string {
    return this.estaActivo(item) && CON_RELLENO.has(item.icon) ? `${item.icon}-fill` : item.icon;
  }

  alternarColapso(): void {
    this.menu.alternar();
  }

  alternarMas(): void {
    this.masAbierto.update((v) => !v);
  }

  cerrarMas(): void {
    this.masAbierto.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
