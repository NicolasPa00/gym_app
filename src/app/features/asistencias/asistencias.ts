import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { EtiquetaPipe } from '../../core/etiqueta.pipe';
import { GymApiService } from '../../core/services/gym-api.service';
import { Asistencia, MetodoIngreso, Miembro } from '../../core/models';

type ModoIngreso = 'CEDULA' | 'QR';

/**
 * Ingreso — la recepción registra quién entra, por cédula o por código QR, y ve quién está dentro.
 *
 * 2026-11-09: se retiró la «confirmación biométrica» con WebAuthn. Pedía Windows Hello o Touch ID
 * al COMPUTADOR de recepción, así que verificaba al cajero, no al miembro, y aun así guardaba el
 * ingreso como HUELLA. Los métodos HUELLA y FACIAL quedan para el lector del gimnasio, que los
 * registrará a través del programa de EscalApp para PC (docs/gym-biometria.md, en el backend).
 */
@Component({
  selector: 'gym-ingreso',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe, EtiquetaPipe],
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
  readonly dentro = computed(() => this.asistencias().filter((a) => !a.fecha_salida).length);

  ngOnInit(): void {
    this.cargar();
  }

  cambiarModo(m: ModoIngreso): void {
    this.modo.set(m);
    this.inputValor.set('');
    this.mensaje.set(null);
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api
      .listarAsistencias({
        idNegocio: id,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        page: 1,
      })
      .subscribe({
        next: (res) => {
          this.asistencias.set(res?.data?.rows ?? []);
          this.total.set(res?.data?.total ?? 0);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  /** Busca al miembro por cédula o QR y registra la entrada. */
  registrar(): void {
    const valor = this.inputValor().trim();
    const id = this.negocio()?.id_negocio;
    if (!valor || !id) return;

    const porQr = this.modo() === 'QR';
    const noEncontrado = porQr ? `No hay ningún miembro con el código ${valor}.` : `No hay ningún miembro con la cédula ${valor}.`;
    this.procesando.set(true);
    this.mensaje.set(null);
    const buscar$ = porQr ? this.api.getMiembroPorQr(valor, id) : this.api.getMiembroPorIdentificacion(valor, id);

    buscar$.subscribe({
      next: (res) => {
        const m = res?.data;
        if (!m) {
          this.procesando.set(false);
          this.mensaje.set({ tipo: 'err', texto: noEncontrado });
          return;
        }
        this.entrarMiembro(m, porQr ? 'QR' : 'CEDULA');
      },
      error: () => {
        this.procesando.set(false);
        this.mensaje.set({ tipo: 'err', texto: noEncontrado });
      },
    });
  }

  /** Búsqueda por nombre para quien no trae la cédula ni el QR. */
  buscarMiembros(q: string): void {
    this.busquedaMiembro.set(q);
    if (this.debounce) clearTimeout(this.debounce);
    if (q.trim().length < 2) {
      this.miembrosBusqueda.set([]);
      return;
    }
    this.debounce = setTimeout(() => {
      const id = this.negocio()?.id_negocio;
      if (!id) return;
      this.api.listarMiembros({ idNegocio: id, q, pageSize: 8 }).subscribe({
        next: (r) => this.miembrosBusqueda.set(r?.data?.rows ?? []),
      });
    }, 300);
  }

  seleccionarMiembroManual(m: Miembro): void {
    this.busquedaMiembro.set('');
    this.miembrosBusqueda.set([]);
    this.entrarMiembro(m, 'MANUAL');
  }

  private entrarMiembro(m: Miembro, metodo: MetodoIngreso): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.procesando.set(true);
    this.api.registrarEntrada({ id_negocio: id, id_miembro: m.id_miembro, metodo }).subscribe({
      next: (res) => {
        this.procesando.set(false);
        if (res?.data?.ya_estaba_dentro) {
          this.mensaje.set({ tipo: 'warn', texto: `${m.primer_nombre} ya estaba dentro.` });
        } else {
          this.mensaje.set({ tipo: 'ok', texto: `Bienvenido, ${m.primer_nombre} ${m.primer_apellido}.` });
        }
        this.inputValor.set('');
        this.cargar();
      },
      error: (err) => {
        this.procesando.set(false);
        const code = err?.error?.errors?.code;
        let texto = err?.error?.message || 'No se pudo registrar la entrada.';
        if (code === 'MEMBRESIA_VENCIDA') texto = `${m.primer_nombre} no tiene una membresía vigente.`;
        if (code === 'MIEMBRO_BLOQUEADO') texto = `${m.primer_nombre} está suspendido o inactivo.`;
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
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
}
