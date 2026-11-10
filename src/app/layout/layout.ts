import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { SidebarComponent } from './sidebar/sidebar';
import { MenuService } from './menu.service';
import { AuthService } from '../core/services/auth.service';

/**
 * Shell del gimnasio (identidad 2026-11-09), con el mismo patrón que el restaurante:
 * altura de la ventana (100dvh) y `.content` como ÚNICO desplazamiento, así la cabecera queda fija.
 * El margen de página lo pone `.content`: ninguna pantalla añade relleno ni ancho máximo propio.
 */
@Component({
  selector: 'gym-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, LucideAngularModule],
  template: `
    <gym-sidebar />
    <div class="main" [class.is-colapsado]="menu.colapsado()">
      <header class="topbar">
        <span class="topbar__fecha">
          <lucide-icon name="calendar" [size]="14" aria-hidden="true" />
          {{ fecha }}
        </span>
        @if (auth.usuario(); as u) {
          <div class="user-chip" [title]="u.nombre_completo">
            <span class="user-chip__avatar" aria-hidden="true">{{ initials() }}</span>
            <span class="user-chip__name">{{ u.nombre_completo }}</span>
          </div>
        }
      </header>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        background: var(--color-bg);
      }

      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        margin-left: 240px;
        transition: margin-left var(--transition-normal);
      }

      .content {
        flex: 1;
        min-height: 0;
        min-width: 0;
        padding: var(--spacing-xl);
        overflow-y: auto;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-md);
        height: 64px;
        padding: 0 var(--spacing-xl);
        flex-shrink: 0;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
      }

      .topbar__fecha {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
      }

      .user-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        height: 40px;
        max-width: 240px;
        padding: 0 0.75rem 0 5px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-surface);
      }

      .user-chip__avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        border-radius: var(--radius-full);
        background: var(--color-sidebar-bg);
        color: #fff;
        font-size: var(--font-size-xs);
        font-weight: 700;
      }

      .user-chip__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--color-text-primary);
      }

      @media (min-width: 1024px) {
        .main.is-colapsado {
          margin-left: 64px;
        }
      }

      @media (max-width: 1023px) and (min-width: 768px) {
        .main {
          margin-left: 64px;
        }
      }

      @media (max-width: 767px) {
        .main {
          margin-left: 0;
          padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
        }

        .content {
          padding: var(--spacing-md);
        }

        .topbar {
          height: 56px;
          padding: 0 var(--spacing-md);
        }

        .user-chip__name {
          display: none;
        }

        .user-chip {
          padding-right: 5px;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menu = inject(MenuService);

  /** «Lunes, 9 de noviembre»: solo la primera palabra en mayúscula. */
  protected readonly fecha = (() => {
    const t = new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Bogota',
    }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  protected readonly initials = computed(() => {
    const nombre = this.auth.usuario()?.nombre_completo?.trim();
    if (!nombre) return 'U';
    const partes = nombre.split(/\s+/);
    return `${partes[0]?.charAt(0) ?? ''}${partes[1]?.charAt(0) ?? ''}`.toUpperCase();
  });
}
