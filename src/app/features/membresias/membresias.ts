import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Membresia, Miembro, Plan } from '../../core/models';

@Component({
  selector: 'gym-membresias',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe, CurrencyPipe],
  templateUrl: './membresias.html',
  styleUrl: './membresias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembresiasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly membresias = signal<Membresia[]>([]);
  readonly cargando = signal(false);
  readonly estadoFiltro = signal('');
  readonly total = signal(0);

  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly miembrosBusqueda = signal<Miembro[]>([]);
  readonly miembroSel = signal<Miembro | null>(null);
  readonly busquedaMiembro = signal('');
  readonly planes = signal<Plan[]>([]);
  readonly planSelId = signal<number | null>(null);

  readonly negocio = computed(() => this.auth.negocio());
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarMembresias({
      idNegocio: id, estado: this.estadoFiltro() || undefined, pageSize: 50,
    }).subscribe({
      next: (res) => {
        this.membresias.set(res?.data?.rows ?? []);
        this.total.set(res?.data?.total ?? 0);
        this.cargando.set(false);
      },
      error: () => { this.cargando.set(false); },
    });
  }

  abrirAsignar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.miembroSel.set(null); this.busquedaMiembro.set(''); this.miembrosBusqueda.set([]);
    this.planSelId.set(null); this.errorForm.set(null);
    this.modalAbierto.set(true);
    this.api.listarPlanes(id).subscribe({ next: (r) => this.planes.set(r?.data ?? []) });
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
  }

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

  asignar(): void {
    const id = this.negocio()?.id_negocio;
    const miembro = this.miembroSel();
    const idPlan = this.planSelId();
    if (!id || !miembro || !idPlan) {
      this.errorForm.set('Selecciona un miembro y un plan.');
      return;
    }
    this.enviando.set(true); this.errorForm.set(null);
    this.api.asignarMembresia({ id_negocio: id, id_miembro: miembro.id_miembro, id_plan: idPlan })
      .subscribe({
        next: () => { this.enviando.set(false); this.modalAbierto.set(false); this.cargar(); },
        error: (e) => { this.enviando.set(false); this.errorForm.set(e?.error?.message || 'No se pudo asignar.'); },
      });
  }

  pausar(m: Membresia): void {
    const id = this.negocio()?.id_negocio;
    if (!id || !confirm('¿Pausar esta membresía? Se reanudará manualmente.')) return;
    this.api.pausarMembresia(m.id_membresia, id).subscribe({ next: () => this.cargar() });
  }
  reanudar(m: Membresia): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.reanudarMembresia(m.id_membresia, id).subscribe({ next: () => this.cargar() });
  }
  cancelar(m: Membresia): void {
    const id = this.negocio()?.id_negocio;
    if (!id || !confirm('¿Cancelar esta membresía? No se puede revertir.')) return;
    this.api.cancelarMembresia(m.id_membresia, id).subscribe({ next: () => this.cargar() });
  }
}
