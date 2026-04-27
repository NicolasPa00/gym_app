import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Asistencia, Miembro } from '../../core/models';

type ModoIngreso = 'CEDULA' | 'QR';

/**
 * Vista "Ingreso" — antes "Asistencias". Identifica al miembro por:
 *   1. Cédula (num_identificacion) — modo principal.
 *   2. Código QR — alternativo.
 *
 * Si el navegador soporta WebAuthn (Windows Hello / Touch ID en el dispositivo
 * del operador), pide confirmación biométrica antes de registrar la entrada.
 * Esto autentica al OPERADOR, no al miembro — para identificación biométrica
 * del miembro hace falta hardware dedicado integrado vía agente nativo.
 */
@Component({
  selector: 'gym-ingreso',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe],
  templateUrl: './asistencias.html',
  styleUrl: './asistencias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsistenciasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly asistencias = signal<Asistencia[]>([]);
  readonly cargando = signal(false);
  readonly total = signal(0);
  readonly desde = signal('');
  readonly hasta = signal('');

  readonly modo = signal<ModoIngreso>('CEDULA');
  readonly inputValor = signal('');
  readonly procesando = signal(false);
  readonly mensaje = signal<{ tipo: 'ok' | 'warn' | 'err'; texto: string } | null>(null);

  readonly miembrosBusqueda = signal<Miembro[]>([]);
  readonly busquedaMiembro = signal('');
  private debounce?: ReturnType<typeof setTimeout>;

  readonly negocio = computed(() => this.auth.negocio());
  readonly soportaBiometria = signal(false);

  ngOnInit(): void {
    this.detectarBiometria();
    this.cargar();
  }

  private async detectarBiometria(): Promise<void> {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return;
    try {
      const Pkc = (window as unknown as { PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
      const supported = await Pkc.isUserVerifyingPlatformAuthenticatorAvailable?.();
      this.soportaBiometria.set(Boolean(supported));
    } catch {
      this.soportaBiometria.set(false);
    }
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarAsistencias({
      idNegocio: id,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
      page: 1,
    }).subscribe({
      next: (res) => {
        this.asistencias.set(res?.data?.rows ?? []);
        this.total.set(res?.data?.total ?? 0);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Busca miembro por modo (cédula o QR) y registra entrada. */
  registrar(): void {
    const valor = this.inputValor().trim();
    if (!valor) return;
    const id = this.negocio()?.id_negocio;
    if (!id) return;

    this.procesando.set(true); this.mensaje.set(null);
    const buscar$ = this.modo() === 'QR'
      ? this.api.getMiembroPorQr(valor, id)
      : this.api.getMiembroPorIdentificacion(valor, id);

    buscar$.subscribe({
      next: (res) => {
        const m = res?.data;
        if (!m) {
          this.procesando.set(false);
          this.mensaje.set({ tipo: 'err', texto: this.modo() === 'QR'
            ? `Código no encontrado: ${valor}`
            : `Cédula no encontrada: ${valor}` });
          return;
        }
        void this.confirmarYRegistrar(m);
      },
      error: () => {
        this.procesando.set(false);
        this.mensaje.set({ tipo: 'err', texto: this.modo() === 'QR'
          ? `Código no encontrado: ${valor}`
          : `Cédula no encontrada: ${valor}` });
      },
    });
  }

  /** Búsqueda libre como fallback (autocompletar). */
  buscarMiembros(q: string): void {
    this.busquedaMiembro.set(q);
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

  seleccionarMiembroManual(m: Miembro): void {
    this.busquedaMiembro.set(''); this.miembrosBusqueda.set([]);
    void this.confirmarYRegistrar(m);
  }

  /** Si hay biometría, pide WebAuthn antes de registrar. */
  private async confirmarYRegistrar(m: Miembro): Promise<void> {
    let metodo: 'QR' | 'MANUAL' | 'HUELLA' = this.modo() === 'QR' ? 'QR' : 'MANUAL';
    if (this.soportaBiometria()) {
      const okBio = await this.confirmarConHuella(m);
      if (okBio === false) {
        this.procesando.set(false);
        this.mensaje.set({ tipo: 'warn', texto: 'Confirmación biométrica cancelada.' });
        return;
      }
      if (okBio === true) metodo = 'HUELLA';
    }
    this.entrarMiembro(m, metodo);
  }

  /**
   * Reta una credencial de plataforma (Windows Hello / Touch ID).
   * Devuelve true si el operador confirmó, false si canceló, null si no se puede usar.
   */
  private async confirmarConHuella(_m: Miembro): Promise<boolean | null> {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 30_000,
          userVerification: 'preferred',
          rpId: window.location.hostname,
        },
        mediation: 'optional',
      } as CredentialRequestOptions);
      return Boolean(cred);
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === 'NotAllowedError') return false;
      return null;
    }
  }

  private entrarMiembro(m: Miembro, metodo: 'QR' | 'MANUAL' | 'HUELLA'): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.procesando.set(true);
    this.api.registrarEntrada({ id_negocio: id, id_miembro: m.id_miembro, metodo }).subscribe({
      next: (res) => {
        this.procesando.set(false);
        const data = res?.data;
        if (data?.ya_estaba_dentro) {
          this.mensaje.set({ tipo: 'warn', texto: `${m.primer_nombre} ya estaba dentro.` });
        } else {
          this.mensaje.set({ tipo: 'ok', texto: `Bienvenido, ${m.primer_nombre} ${m.primer_apellido} (${metodo})` });
        }
        this.inputValor.set('');
        this.cargar();
      },
      error: (err) => {
        this.procesando.set(false);
        const code = err?.error?.errors?.code;
        let texto = err?.error?.message || 'No se pudo registrar la entrada.';
        if (code === 'MEMBRESIA_VENCIDA') texto = `${m.primer_nombre} no tiene una membresía vigente.`;
        if (code === 'MIEMBRO_BLOQUEADO') texto = `${m.primer_nombre} está bloqueado.`;
        this.mensaje.set({ tipo: 'err', texto });
        this.inputValor.set('');
      },
    });
  }

  cerrarAsistencia(a: Asistencia): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.registrarSalida(a.id_asistencia, id).subscribe({ next: () => this.cargar() });
  }

  formatDuracion(min: number | null): string {
    if (min == null) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60); const m = min % 60;
    return `${h}h ${m}m`;
  }
}
