import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Plan } from '../../core/models';

@Component({
  selector: 'gym-planes',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, CurrencyPipe],
  templateUrl: './planes.html',
  styleUrl: './planes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly planes = signal<Plan[]>([]);
  readonly cargando = signal(false);
  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly form = signal<Partial<Plan>>(this.formVacio());
  readonly editandoId = signal<number | null>(null);

  readonly negocio = computed(() => this.auth.negocio());

  ngOnInit(): void { this.cargar(); }

  private formVacio(): Partial<Plan> {
    return { nombre: '', descripcion: '', precio: 0, duracion_meses: 1, beneficios: '' };
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarPlanes(id, true).subscribe({
      next: (res) => { this.planes.set(res?.data ?? []); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.planes.set([]); },
    });
  }

  abrirNuevo(): void {
    this.form.set(this.formVacio());
    this.editandoId.set(null);
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }

  abrirEdicion(p: Plan): void {
    this.form.set({ ...p });
    this.editandoId.set(p.id_plan);
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
  }

  actualizarCampo<K extends keyof Plan>(key: K, value: Plan[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  guardar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    const f = this.form();
    if (!f.nombre?.trim()) { this.errorForm.set('El nombre es requerido.'); return; }
    if (!(Number(f.precio) >= 0)) { this.errorForm.set('Precio inválido.'); return; }
    if (!(Number(f.duracion_meses) > 0)) { this.errorForm.set('Duración inválida.'); return; }

    this.enviando.set(true);
    this.errorForm.set(null);
    const payload = { ...f, id_negocio: id, precio: Number(f.precio), duracion_meses: Number(f.duracion_meses) };
    const editando = this.editandoId();
    const obs$ = editando
      ? this.api.actualizarPlan(editando, payload)
      : this.api.crearPlan(payload);
    obs$.subscribe({
      next: () => { this.enviando.set(false); this.modalAbierto.set(false); this.cargar(); },
      error: (e) => { this.enviando.set(false); this.errorForm.set(e?.error?.message || 'No se pudo guardar.'); },
    });
  }

  inactivar(p: Plan): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    if (!confirm(`¿Inactivar el plan "${p.nombre}"? Los miembros con membresías existentes no se ven afectados.`)) return;
    this.api.inactivarPlan(p.id_plan, id).subscribe({ next: () => this.cargar() });
  }
}
