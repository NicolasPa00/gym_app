import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Asistencia, Membresia, PaginaConfig, ResumenDashboard } from '../../core/models';

const DIA = 86_400_000;

/**
 * Dashboard del gimnasio: las cifras del día y, debajo, lo que hay que atender — quién está
 * entrenando ahora, qué membresías vencen esta semana (para llamar antes de que se vayan) y si la
 * página pública está publicada. Todo sale de los endpoints que ya usan Ingreso, Membresías y
 * Configuración: no hay cifras inventadas.
 */
@Component({
  selector: 'gym-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, LucideAngularModule, RouterLink],
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
  readonly planActivo = computed(() => this.auth.planActivo());

  readonly asistencias = signal<Asistencia[]>([]);
  readonly membresias = signal<Membresia[]>([]);
  readonly pagina = signal<PaginaConfig | null>(null);
  private readonly ahora = signal(Date.now());

  readonly dentro = computed(() => this.asistencias().filter((a) => !a.fecha_salida));

  /** Activas que vencen en los próximos 7 días, la más próxima primero. */
  readonly vencen = computed(() => {
    const hoy = new Date(this.ahora());
    hoy.setHours(0, 0, 0, 0);
    const limite = hoy.getTime() + 7 * DIA;
    return this.membresias()
      .filter((m) => {
        const fin = new Date(`${m.fecha_fin}T00:00:00`).getTime();
        return fin >= hoy.getTime() && fin <= limite;
      })
      .sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin));
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.error.set(null);
    this.ahora.set(Date.now());
    this.api.getResumen(id).subscribe({
      next: (res) => {
        this.resumen.set(res?.data ?? null);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.message || 'No se pudo cargar el resumen.');
        this.cargando.set(false);
      },
    });
    this.api.listarAsistencias({ idNegocio: id, page: 1 }).subscribe({
      next: (r) => this.asistencias.set(r?.data?.rows ?? []),
    });
    this.api.listarMembresias({ idNegocio: id, estado: 'ACTIVA', pageSize: 200 }).subscribe({
      next: (r) => this.membresias.set(r?.data?.rows ?? []),
    });
    this.api.obtenerPagina(id).subscribe({
      next: (r) => this.pagina.set(r?.data ?? null),
    });
  }

  /** «hace 25 min», «hace 1 h 10 min». */
  haceCuanto(fecha: string): string {
    const min = Math.max(0, Math.round((this.ahora() - new Date(fecha).getTime()) / 60000));
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
  }

  /** «hoy», «mañana», «en 3 días». */
  enCuanto(fechaFin: string): string {
    const hoy = new Date(this.ahora());
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(`${fechaFin}T00:00:00`).getTime() - hoy.getTime()) / DIA);
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'mañana';
    return `en ${dias} días`;
  }

  iniciales(nombre?: string, apellido?: string): string {
    return `${nombre?.charAt(0) ?? ''}${apellido?.charAt(0) ?? ''}`.toUpperCase();
  }
}
