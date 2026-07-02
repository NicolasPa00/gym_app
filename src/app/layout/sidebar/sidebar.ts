import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  icon: string; label: string; route: string;
}

@Component({
  selector: 'gym-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly auth = inject(AuthService);

  readonly items: NavItem[] = [
    { icon: 'layout-dashboard', label: 'Dashboard',     route: '/dashboard' },
    { icon: 'log-in',           label: 'Ingreso',       route: '/ingreso' },
    { icon: 'users',            label: 'Miembros',      route: '/miembros' },
    { icon: 'badge-percent',    label: 'Planes',        route: '/planes' },
    { icon: 'id-card',          label: 'Membresías',    route: '/membresias' },
    { icon: 'package',          label: 'Productos',     route: '/productos' },
    { icon: 'shopping-cart',    label: 'Ventas',        route: '/ventas' },
    { icon: 'banknote',         label: 'Pagos',         route: '/pagos' },
    { icon: 'settings',         label: 'Configuración', route: '/configuracion' },
  ];

  readonly itemsPermitidos = computed(() =>
    this.items.filter(i => this.auth.canAccessRoute(i.route))
  );

  logout(): void { this.auth.logout(); }
}
