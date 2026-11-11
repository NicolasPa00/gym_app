import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../../core/services/auth.service';
import { GymApiService } from '../../../core/services/gym-api.service';
import {
  Capacidad,
  CodigoEmparejamiento,
  CatalogoLectores,
  ComandoLector,
  Lector,
  MarcacionLector,
} from '../../../core/models';
import { AgregarLectorComponent, textoDeError } from './agregar-lector';
import { codigoEnGrupos, nombreMarca } from './asistente';
import {
  conexionEnPalabras,
  estadoComandoEnPalabras,
  estadoEnPalabras,
  haceCuanto,
  parseFecha,
  puertaDisponible,
  resultadoEnPalabras,
  tipoComandoEnPalabras,
  vencimientoEnPalabras,
  verificacionEnPalabras,
} from './textos';

type Aviso = { tipo: 'ok' | 'err'; texto: string } | null;

/** Configuración → pestaña «Lectores»: lista, acciones, detalle y el asistente para agregar uno. */
@Component({
  selector: 'gym-lectores',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, DatePipe, AgregarLectorComponent],
  templateUrl: './lectores.html',
  styleUrl: './lectores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LectoresComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly lectores = signal<Lector[]>([]);
  readonly catalogo = signal<CatalogoLectores | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<Aviso>(null);
  readonly ahora = signal(Date.now());

  readonly asistente = signal(false);
  readonly detalle = signal<Lector | null>(null);
  readonly marcaciones = signal<MarcacionLector[]>([]);
  readonly comandos = signal<ComandoLector[]>([]);
  readonly cargandoDetalle = signal(false);

  readonly editando = signal<Lector | null>(null);
  readonly formEdicion = signal({ nombre: '', serie: '', ip: '', puerto: '', usuario: '', clave: '' });
  readonly guardandoEdicion = signal(false);
  readonly errorEdicion = signal<string | null>(null);

  /** Quitar y abrir la puerta piden un segundo toque, sin ventanas del navegador. */
  readonly confirmarQuitar = signal<number | null>(null);
  readonly confirmarPuerta = signal<number | null>(null);
  readonly ocupado = signal<number | null>(null);
  /** Código de emparejamiento recién generado para un lector con puente. */
  readonly nombreMarca = nombreMarca;
  readonly codigoDe = signal<{ id: number; codigo: CodigoEmparejamiento } | null>(null);
  readonly grupos = codigoEnGrupos;
  vence = vencimientoEnPalabras;

  readonly idNegocio = computed(() => this.auth.negocio()?.id_negocio ?? null);
  readonly activos = computed(() => this.lectores().filter((l) => l.estado !== 'INACTIVO'));

  ngOnInit(): void {
    this.cargar();
    const id = this.idNegocio();
    if (id) {
      this.api.catalogoLectores(id).subscribe({
        next: (r) => this.catalogo.set(r?.data ?? null),
        error: () => this.catalogo.set(null),
      });
    }
    if (isPlatformBrowser(this.platformId)) {
      const t = setInterval(() => {
        this.ahora.set(Date.now());
        if (!this.asistente() && !this.editando()) this.cargar(true);
      }, 15000);
      this.destroyRef.onDestroy(() => clearInterval(t));
    }
  }

  cargar(silencioso = false): void {
    const id = this.idNegocio();
    if (!id) return;
    if (!silencioso) this.cargando.set(true);
    this.api.listarLectores(id).subscribe({
      next: (r) => {
        this.lectores.set(r?.data ?? []);
        this.error.set(null);
        this.cargando.set(false);
        this.ahora.set(Date.now());
        const d = this.detalle();
        if (d) this.detalle.set(this.lectores().find((l) => l.id_lector === d.id_lector) ?? null);
      },
      error: (e) => {
        this.cargando.set(false);
        if (!silencioso) this.error.set(textoDeError(e, 'No se pudieron cargar los lectores.'));
      },
    });
  }

  // ── Palabras ──
  estado(l: Lector) {
    return estadoEnPalabras(l, this.ahora());
  }
  conexion(l: Lector): string {
    return conexionEnPalabras(l.conexion);
  }
  hace(valor: string | null | undefined): string {
    const ms = parseFecha(valor);
    return ms === null ? '' : haceCuanto(ms, this.ahora());
  }
  resultado = resultadoEnPalabras;
  verificacion = verificacionEnPalabras;
  tipoComando = tipoComandoEnPalabras;
  estadoComando = estadoComandoEnPalabras;
  puerta(l: Lector): 'si' | 'aviso' | 'no' {
    return puertaDisponible(this.capacidadPuerta(l));
  }

  /** Las capacidades las trae el servidor en cada lector (según su conexión y driver). */
  private capacidadPuerta(l: Lector): Capacidad | undefined {
    return l.capacidades?.abrir_puerta;
  }

  // ── Acciones ──
  abrirPuerta(l: Lector): void {
    const id = this.idNegocio();
    if (!id) return;
    if (this.puerta(l) === 'aviso' && this.confirmarPuerta() !== l.id_lector) {
      this.confirmarPuerta.set(l.id_lector);
      return;
    }
    this.confirmarPuerta.set(null);
    this.ocupado.set(l.id_lector);
    this.api.abrirPuertaLector(l.id_lector, id).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.aviso.set({ tipo: 'ok', texto: `Le pedimos a «${l.nombre}» que abra la puerta. Puede tardar unos segundos.` });
        this.cargar(true);
      },
      error: (e) => {
        this.ocupado.set(null);
        this.aviso.set({ tipo: 'err', texto: textoDeError(e, 'No se pudo pedir que abra la puerta.') });
      },
    });
  }

  resincronizar(l: Lector): void {
    const id = this.idNegocio();
    if (!id) return;
    this.ocupado.set(l.id_lector);
    this.api.resincronizarLector(l.id_lector, id).subscribe({
      next: (r) => {
        this.ocupado.set(null);
        const n = r?.data?.encolados ?? 0;
        this.aviso.set({
          tipo: 'ok',
          texto: `Se enviaron ${n} ${n === 1 ? 'miembro' : 'miembros'} a «${l.nombre}».`,
        });
        this.cargar(true);
      },
      error: (e) => {
        this.ocupado.set(null);
        this.aviso.set({ tipo: 'err', texto: textoDeError(e, 'No se pudo resincronizar.') });
      },
    });
  }

  quitar(l: Lector): void {
    const id = this.idNegocio();
    if (!id) return;
    if (this.confirmarQuitar() !== l.id_lector) {
      this.confirmarQuitar.set(l.id_lector);
      return;
    }
    this.confirmarQuitar.set(null);
    this.ocupado.set(l.id_lector);
    this.api.quitarLector(l.id_lector, id).subscribe({
      next: () => {
        this.ocupado.set(null);
        if (this.detalle()?.id_lector === l.id_lector) this.detalle.set(null);
        this.aviso.set({ tipo: 'ok', texto: `«${l.nombre}» ya no está en tu lista.` });
        this.cargar(true);
      },
      error: (e) => {
        this.ocupado.set(null);
        this.aviso.set({ tipo: 'err', texto: textoDeError(e, 'No se pudo quitar el lector.') });
      },
    });
  }

  generarCodigo(l: Lector): void {
    const id = this.idNegocio();
    if (!id) return;
    this.ocupado.set(l.id_lector);
    this.api.codigoEmparejamiento(l.id_lector, id).subscribe({
      next: (r) => {
        this.ocupado.set(null);
        if (r?.data) this.codigoDe.set({ id: l.id_lector, codigo: r.data });
        this.ahora.set(Date.now());
      },
      error: (e) => {
        this.ocupado.set(null);
        this.aviso.set({ tipo: 'err', texto: textoDeError(e, 'No se pudo generar el código.') });
      },
    });
  }

  // ── Edición ──
  editar(l: Lector): void {
    this.formEdicion.set({
      nombre: l.nombre,
      serie: l.numero_serie ?? '',
      ip: l.direccion_ip ?? '',
      puerto: l.puerto ? String(l.puerto) : '',
      usuario: l.usuario_aparato ?? '',
      clave: '',
    });
    this.errorEdicion.set(null);
    this.editando.set(l);
  }

  campoEdicion(k: 'nombre' | 'serie' | 'ip' | 'puerto' | 'usuario' | 'clave', v: string): void {
    this.formEdicion.update((f) => ({ ...f, [k]: v }));
  }

  cerrarEdicion(): void {
    if (!this.guardandoEdicion()) this.editando.set(null);
  }

  guardarEdicion(): void {
    const l = this.editando();
    const id = this.idNegocio();
    if (!l || !id) return;
    const f = this.formEdicion();
    if (!f.nombre.trim()) {
      this.errorEdicion.set('El nombre no puede quedar vacío.');
      return;
    }
    const cuerpo: Record<string, unknown> = { nombre: f.nombre.trim() };
    if (l.conexion === 'ZK_ADMS') cuerpo['numero_serie'] = f.serie.trim().toUpperCase();
    if (l.conexion === 'PUENTE') {
      cuerpo['direccion_ip'] = f.ip.trim();
      cuerpo['puerto'] = f.puerto.trim() ? Number(f.puerto) : null;
      cuerpo['usuario_aparato'] = f.usuario.trim() || null;
      if (f.clave) cuerpo['clave_aparato'] = f.clave; // vacía = no se cambia
    }
    this.guardandoEdicion.set(true);
    this.errorEdicion.set(null);
    this.api.actualizarLector(l.id_lector, id, cuerpo).subscribe({
      next: () => {
        this.guardandoEdicion.set(false);
        this.editando.set(null);
        this.aviso.set({ tipo: 'ok', texto: 'Cambios guardados.' });
        this.cargar(true);
      },
      error: (e) => {
        this.guardandoEdicion.set(false);
        this.errorEdicion.set(textoDeError(e, 'No se pudo guardar.'));
      },
    });
  }

  // ── Detalle ──
  verDetalle(l: Lector): void {
    const id = this.idNegocio();
    if (!id) return;
    if (this.detalle()?.id_lector === l.id_lector) {
      this.detalle.set(null);
      return;
    }
    this.detalle.set(l);
    this.marcaciones.set([]);
    this.comandos.set([]);
    this.cargandoDetalle.set(true);
    let pendientes = 2;
    const listo = () => {
      if (--pendientes === 0) this.cargandoDetalle.set(false);
    };
    this.api.marcacionesLector(l.id_lector, id, 30).subscribe({
      next: (r) => this.marcaciones.set(r?.data ?? []),
      error: () => listo(),
      complete: () => listo(),
    });
    this.api.comandosLector(l.id_lector, id, 30).subscribe({
      next: (r) => this.comandos.set(r?.data ?? []),
      error: () => listo(),
      complete: () => listo(),
    });
  }

  abrirAsistente(): void {
    this.aviso.set(null);
    this.asistente.set(true);
  }

  cerrarAsistente(): void {
    this.asistente.set(false);
    this.cargar(true);
  }
}
