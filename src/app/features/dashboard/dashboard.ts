import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { ResumenDashboard } from '../../core/models';

@Component({
  selector: 'gym-dashboard',
  standalone: true,
  imports: [CurrencyPipe, LucideAngularModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly resumen = signal<ResumenDashboard | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly negocio = computed(() => this.auth.negocio());

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.error.set(null);
    this.api.getResumen(id).subscribe({
      next: (res) => { this.resumen.set(res?.data ?? null); this.cargando.set(false); },
      error: (e) => { this.error.set(e?.error?.message || 'Error al cargar el dashboard.'); this.cargando.set(false); },
    });
  }
}
