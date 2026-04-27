import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Miembro } from '../../core/models';

@Component({
  selector: 'gym-miembros',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe],
  templateUrl: './miembros.html',
  styleUrl: './miembros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiembrosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly miembros = signal<Miembro[]>([]);
  readonly cargando = signal(false);
  readonly busqueda = signal('');
  readonly estadoFiltro = signal('');
  readonly total = signal(0);

  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly form = signal<Partial<Miembro>>(this.formVacio());

  readonly negocio = computed(() => this.auth.negocio());
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { this.cargar(); }

  private formVacio(): Partial<Miembro> {
    return {
      primer_nombre: '', primer_apellido: '',
      email: '', telefono: '',
      fecha_nacimiento: null, sexo: null,
      peso_kg: null, altura_cm: null,
      direccion: '', ciudad: '',
      contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
      condiciones_medicas: '', alergias: '',
    };
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarMiembros({
      idNegocio: id,
      q: this.busqueda() || undefined,
      estado: this.estadoFiltro() || undefined,
      pageSize: 50,
    }).subscribe({
      next: (res) => {
        this.miembros.set(res?.data?.rows ?? []);
        this.total.set(res?.data?.total ?? 0);
        this.cargando.set(false);
      },
      error: () => { this.cargando.set(false); this.miembros.set([]); },
    });
  }

  onBusquedaChange(v: string): void {
    this.busqueda.set(v);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.cargar(), 300);
  }

  abrirNuevo(): void {
    this.form.set(this.formVacio());
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
  }

  actualizarCampo<K extends keyof Miembro>(key: K, value: Miembro[K] | null): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  guardar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    const f = this.form();
    if (!f.primer_nombre?.trim() || !f.primer_apellido?.trim()) {
      this.errorForm.set('Nombre y apellido son obligatorios.');
      return;
    }
    const payload: Partial<Miembro> = {
      ...f,
      id_negocio: id,
      email: f.email?.trim() || null,
      telefono: f.telefono?.trim() || null,
      fecha_nacimiento: f.fecha_nacimiento || null,
      peso_kg: f.peso_kg ? Number(f.peso_kg) : null,
      altura_cm: f.altura_cm ? Number(f.altura_cm) : null,
    };
    this.enviando.set(true);
    this.errorForm.set(null);
    this.api.crearMiembro(payload).subscribe({
      next: () => {
        this.enviando.set(false);
        this.modalAbierto.set(false);
        this.cargar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorForm.set(e?.error?.message || 'No se pudo crear el miembro.');
      },
    });
  }

  cambiarEstado(m: Miembro, estado: Miembro['estado']): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.cambiarEstadoMiembro(m.id_miembro, id, estado).subscribe({
      next: () => this.cargar(),
    });
  }

  vencimientoMembresia(m: Miembro): string | null {
    return m.membresias?.[0]?.fecha_fin || null;
  }
}
