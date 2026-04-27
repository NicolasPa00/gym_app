import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Miembro, Pago, Plan } from '../../core/models';

@Component({
  selector: 'gym-pagos',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe, CurrencyPipe],
  templateUrl: './pagos.html',
  styleUrl: './pagos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly pagos = signal<Pago[]>([]);
  readonly cargando = signal(false);
  readonly total = signal(0);
  readonly desde = signal('');
  readonly hasta = signal('');

  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);

  readonly miembrosBusqueda = signal<Miembro[]>([]);
  readonly miembroSel = signal<Miembro | null>(null);
  readonly busquedaMiembro = signal('');
  readonly planes = signal<Plan[]>([]);
  readonly planSelId = signal<number | null>(null);
  readonly monto = signal<number | null>(null);
  readonly metodo = signal<Pago['metodo']>('EFECTIVO');
  readonly concepto = signal('');

  readonly negocio = computed(() => this.auth.negocio());
  readonly planSeleccionado = computed(() => {
    const id = this.planSelId();
    return id ? this.planes().find(p => p.id_plan === id) ?? null : null;
  });

  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarPagos({
      idNegocio: id,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
      page: 1,
    }).subscribe({
      next: (res) => {
        this.pagos.set(res?.data?.rows ?? []);
        this.total.set(res?.data?.total ?? 0);
        this.cargando.set(false);
      },
      error: () => { this.cargando.set(false); },
    });
  }

  abrirRegistrar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.miembroSel.set(null); this.busquedaMiembro.set(''); this.miembrosBusqueda.set([]);
    this.planSelId.set(null); this.monto.set(null);
    this.metodo.set('EFECTIVO'); this.concepto.set(''); this.errorForm.set(null);
    this.modalAbierto.set(true);
    this.api.listarPlanes(id).subscribe({ next: (r) => this.planes.set(r?.data ?? []) });
  }

  cerrarModal(): void { if (!this.enviando()) this.modalAbierto.set(false); }

  buscarMiembros(q: string): void {
    this.busquedaMiembro.set(q);
    this.miembroSel.set(null);
    if (this.debounce) clearTimeout(this.debounce);
    if (q.trim().length < 2) { this.miembrosBusqueda.set([]); return; }
    this.debounce = setTimeout(() => {
      const id = this.negocio()?.id_negocio;
      if (!id) return;
      this.api.listarMiembros({ idNegocio: id, q, pageSize: 8 }).subscribe({
        next: (r) => this.miembrosBusqueda.set(r?.data?.rows ?? []),
      });
    }, 300);
  }

  seleccionarMiembro(m: Miembro): void {
    this.miembroSel.set(m);
    this.busquedaMiembro.set(`${m.primer_nombre} ${m.primer_apellido}`);
    this.miembrosBusqueda.set([]);
  }

  /** Auto-rellena el monto cuando se selecciona un plan. */
  onPlanChange(idPlan: number | null): void {
    this.planSelId.set(idPlan);
    const p = this.planSeleccionado();
    if (p) this.monto.set(Number(p.precio));
  }

  registrar(): void {
    const id = this.negocio()?.id_negocio;
    const miembro = this.miembroSel();
    if (!id || !miembro) { this.errorForm.set('Selecciona un miembro.'); return; }
    if (!(Number(this.monto()) > 0)) { this.errorForm.set('Monto inválido.'); return; }

    this.enviando.set(true); this.errorForm.set(null);
    this.api.registrarPago({
      id_negocio: id,
      id_miembro: miembro.id_miembro,
      id_plan:    this.planSelId() || null,
      monto:      Number(this.monto()),
      metodo:     this.metodo(),
      concepto:   this.concepto().trim() || null,
    }).subscribe({
      next: () => { this.enviando.set(false); this.modalAbierto.set(false); this.cargar(); },
      error: (e) => { this.enviando.set(false); this.errorForm.set(e?.error?.message || 'No se pudo registrar.'); },
    });
  }

  anular(p: Pago): void {
    const id = this.negocio()?.id_negocio;
    if (!id || !confirm('¿Anular este pago? No se reversa la membresía generada.')) return;
    this.api.anularPago(p.id_pago, id).subscribe({ next: () => this.cargar() });
  }
}
