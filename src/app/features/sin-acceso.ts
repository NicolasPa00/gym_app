import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'gym-sin-acceso',
  standalone: true,
  template: `
    <section class="page">
      <h1>Sin acceso</h1>
      <p>Tu rol actual no tiene permisos para abrir ninguna vista del gimnasio.</p>
      <button class="btn btn-primary" type="button" (click)="auth.logout()">Volver al admin</button>
    </section>
  `,
  styles: [`
    .page { max-width: 480px; margin: 4rem auto; padding: 2rem; text-align: center;
      background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    h1 { margin: 0 0 .5rem; }
    p { color: var(--color-text-muted); margin: 0 0 1.25rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SinAccesoComponent {
  readonly auth = inject(AuthService);
}
