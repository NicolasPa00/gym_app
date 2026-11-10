import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { EtiquetaPipe } from '../../core/etiqueta.pipe';
import { GymApiService } from '../../core/services/gym-api.service';
import {
  AutorizacionesMiembro,
  Miembro,
  NuevoMiembro,
  TextoAutorizacion,
  TipoAutorizacion,
} from '../../core/models';

/**
 * Miembros del gimnasio.
 *
 * Datos sensibles (2026-11-09): la huella para entrar y las condiciones médicas / alergias se
 * guardan solo con autorización explícita del miembro (Ley 1581 de 2012). El formulario muestra
 * el texto exacto que se registra como prueba y el backend rechaza datos de salud sin permiso
 * (`AUTORIZACION_SALUD_REQUERIDA`). Nada aquí es obligatorio: sin huella se entra con cédula o QR.
 */
@Component({
  selector: 'gym-miembros',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe, EtiquetaPipe],
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

  // Nuevo miembro
  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly form = signal<Partial<Miembro>>(this.formVacio());
  readonly autorizaSalud = signal(false);
  readonly autorizaBiometria = signal(false);

  // Textos legales (los mismos que guarda el backend como prueba)
  readonly textos = signal<Record<TipoAutorizacion, TextoAutorizacion> | null>(null);

  // Ventana de autorizaciones de un miembro existente
  readonly fichaAut = signal<Miembro | null>(null);
  readonly autorizaciones = signal<AutorizacionesMiembro | null>(null);
  readonly cargandoAut = signal(false);
  readonly guardandoAut = signal<TipoAutorizacion | null>(null);
  readonly errorAut = signal<string | null>(null);
  /** Revocar pide un segundo toque: revocar SALUD borra datos de la ficha. */
  readonly confirmarRevocar = signal<TipoAutorizacion | null>(null);

  readonly negocio = computed(() => this.auth.negocio());
  readonly tiposAut: TipoAutorizacion[] = ['BIOMETRIA', 'SALUD'];
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar();
    this.cargarTextos();
  }

  private formVacio(): Partial<Miembro> {
    return {
      primer_nombre: '',
      primer_apellido: '',
      num_identificacion: '',
      email: '',
      telefono: '',
      fecha_nacimiento: null,
      sexo: null,
      peso_kg: null,
      altura_cm: null,
      direccion: '',
      ciudad: '',
      contacto_emergencia_nombre: '',
      contacto_emergencia_telefono: '',
      condiciones_medicas: '',
      alergias: '',
    };
  }

  private cargarTextos(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.textosAutorizacion(id).subscribe({
      next: (r) => this.textos.set(r?.data ?? null),
      error: () => this.textos.set(null),
    });
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api
      .listarMiembros({
        idNegocio: id,
        q: this.busqueda() || undefined,
        estado: this.estadoFiltro() || undefined,
        pageSize: 50,
      })
      .subscribe({
        next: (res) => {
          this.miembros.set(res?.data?.rows ?? []);
          this.total.set(res?.data?.total ?? 0);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.miembros.set([]);
        },
      });
  }

  onBusquedaChange(v: string): void {
    this.busqueda.set(v);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.cargar(), 300);
  }

  iniciales(m: Pick<Miembro, 'primer_nombre' | 'primer_apellido'>): string {
    return `${m.primer_nombre?.charAt(0) ?? ''}${m.primer_apellido?.charAt(0) ?? ''}`.toUpperCase();
  }

  // ── Nuevo miembro ──

  abrirNuevo(): void {
    this.form.set(this.formVacio());
    this.autorizaSalud.set(false);
    this.autorizaBiometria.set(false);
    this.errorForm.set(null);
    if (!this.textos()) this.cargarTextos();
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modalAbierto.set(false);
  }

  actualizarCampo<K extends keyof Miembro>(key: K, value: Miembro[K] | null): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  /** Quitar el permiso de salud en el formulario vacía esos campos: no se envían. */
  cambiarAutorizaSalud(v: boolean): void {
    this.autorizaSalud.set(v);
    if (!v) this.form.update((f) => ({ ...f, condiciones_medicas: '', alergias: '' }));
  }

  guardar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    const f = this.form();
    if (!f.primer_nombre?.trim() || !f.primer_apellido?.trim()) {
      this.errorForm.set('Nombre y apellido son obligatorios.');
      return;
    }
    const salud = this.autorizaSalud();
    const autorizaciones: NuevoMiembro['autorizaciones'] = [];
    if (salud) autorizaciones.push({ tipo: 'SALUD', otorgada: true });
    if (this.autorizaBiometria()) autorizaciones.push({ tipo: 'BIOMETRIA', otorgada: true });

    const payload: NuevoMiembro = {
      ...f,
      id_negocio: id,
      num_identificacion: f.num_identificacion?.trim() || null,
      email: f.email?.trim() || null,
      telefono: f.telefono?.trim() || null,
      fecha_nacimiento: f.fecha_nacimiento || null,
      peso_kg: f.peso_kg ? Number(f.peso_kg) : null,
      altura_cm: f.altura_cm ? Number(f.altura_cm) : null,
      // Sin autorización, los datos de salud ni siquiera viajan.
      condiciones_medicas: salud ? f.condiciones_medicas?.trim() || null : null,
      alergias: salud ? f.alergias?.trim() || null : null,
      autorizaciones,
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

  // ── Autorizaciones de un miembro existente ──

  abrirAutorizaciones(m: Miembro): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.fichaAut.set(m);
    this.autorizaciones.set(null);
    this.errorAut.set(null);
    this.confirmarRevocar.set(null);
    if (!this.textos()) this.cargarTextos();
    this.cargandoAut.set(true);
    this.api.listarAutorizaciones(m.id_miembro, id).subscribe({
      next: (r) => {
        this.autorizaciones.set(r?.data ?? null);
        this.cargandoAut.set(false);
      },
      error: (e) => {
        this.cargandoAut.set(false);
        this.errorAut.set(e?.error?.message || 'No se pudieron cargar las autorizaciones.');
      },
    });
  }

  cerrarAutorizaciones(): void {
    if (this.guardandoAut()) return;
    this.fichaAut.set(null);
  }

  vigente(tipo: TipoAutorizacion): boolean {
    const a = this.autorizaciones();
    if (!a) return false;
    return tipo === 'BIOMETRIA' ? a.autoriza_biometria : a.autoriza_datos_salud;
  }

  cambiarAutorizacion(tipo: TipoAutorizacion, otorgada: boolean): void {
    const m = this.fichaAut();
    const id = this.negocio()?.id_negocio;
    if (!m || !id) return;
    if (!otorgada && this.confirmarRevocar() !== tipo) {
      this.confirmarRevocar.set(tipo);
      return;
    }
    this.confirmarRevocar.set(null);
    this.guardandoAut.set(tipo);
    this.errorAut.set(null);
    this.api.registrarAutorizacion(m.id_miembro, id, tipo, otorgada).subscribe({
      next: () => {
        this.guardandoAut.set(null);
        this.abrirAutorizaciones(m);
        this.cargar();
      },
      error: (e) => {
        this.guardandoAut.set(null);
        this.errorAut.set(e?.error?.message || 'No se pudo guardar.');
      },
    });
  }
}
