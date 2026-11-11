import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { GymApiService } from '../../../core/services/gym-api.service';
import { CatalogoLectores, CodigoEmparejamiento, ConexionLector, Lector } from '../../../core/models';
import {
  AYUDA_ETIQUETA,
  BORRADOR_VACIO,
  BorradorLector,
  OTRO_MODELO,
  SERVIDOR_POR_DEFECTO,
  aplicarEleccion,
  buscarDriver,
  buscarMarca,
  codigoEnGrupos,
  conexionesDe,
  construirLector,
  driversDe,
  erroresPaso2,
  nombreMarca,
  nombreSugerido,
  paso1Completo,
  pasosDe,
  pideEstrategia,
  sugerirSeries,
} from './asistente';
import { estadoEnPalabras, vencimientoEnPalabras } from './textos';

/**
 * Asistente «Agregar lector» de 3 pasos (docs/gym-lectores-biometricos.md §6):
 * 1) marca y modelo, 2) cómo se conecta, 3) esperar el primer contacto y mandarle los miembros.
 * La lógica que decide (qué falta, qué se envía) vive en `asistente.ts`, que se prueba aparte.
 */
@Component({
  selector: 'gym-agregar-lector',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './agregar-lector.html',
  styleUrl: './lectores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgregarLectorComponent implements OnInit {
  private readonly api = inject(GymApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly idNegocio = input.required<number>();
  readonly catalogo = input<CatalogoLectores | null>(null);
  readonly cerrar = output<void>();
  /** Avisa que se creó o cambió algo, para que la lista se refresque. */
  readonly cambio = output<void>();

  readonly paso = signal<1 | 2 | 3>(1);
  readonly b = signal<BorradorLector>({ ...BORRADOR_VACIO });
  readonly errores = signal<string[]>([]);
  readonly guardando = signal(false);
  readonly errorServidor = signal<string | null>(null);
  readonly creado = signal<Lector | null>(null);

  readonly codigo = signal<CodigoEmparejamiento | null>(null);
  readonly generandoCodigo = signal(false);
  readonly copiado = signal(false);
  readonly ahora = signal(Date.now());

  readonly desconocidos = signal<string[]>([]);
  readonly lectorVivo = signal<Lector | null>(null);
  readonly enviando = signal(false);
  readonly enviado = signal<number | null>(null);

  readonly ayudaEtiqueta = AYUDA_ETIQUETA;
  private temporizador?: ReturnType<typeof setInterval>;

  readonly otroModelo = OTRO_MODELO;
  readonly nombreMarca = nombreMarca;
  readonly marca = computed(() => buscarMarca(this.catalogo(), this.b().marca));
  readonly conexion = computed(() => this.b().conexion);
  readonly conexiones = computed(() => conexionesDe(this.catalogo(), this.b()));
  readonly pasos = computed(() => pasosDe(this.catalogo(), this.conexion()));
  readonly drivers = computed(() => driversDe(this.catalogo(), this.b().marca));
  readonly puertoDefecto = computed(
    () => buscarDriver(this.catalogo(), this.b().driver)?.puerto_defecto ?? null,
  );
  readonly estrategias = computed(() => this.catalogo()?.estrategias_deshabilitar ?? []);
  readonly pideEstrategia = computed(() => pideEstrategia(this.catalogo(), this.b()));
  readonly servidor = computed(() => ({
    host: this.catalogo()?.servidor_adms ?? SERVIDOR_POR_DEFECTO.host,
    puerto: SERVIDOR_POR_DEFECTO.puerto,
  }));
  readonly series = computed(() => sugerirSeries(this.desconocidos(), this.b().serie));
  readonly puedeSeguir1 = computed(() => paso1Completo(this.b()));
  readonly nombrePlaceholder = computed(() => nombreSugerido({ ...this.b(), nombre: '' }));
  readonly codigoGrande = computed(() => codigoEnGrupos(this.codigo()?.codigo ?? ''));
  readonly vence = computed(() => vencimientoEnPalabras(this.codigo()?.vence, this.ahora()));
  readonly estadoVivo = computed(() => {
    const l = this.lectorVivo();
    return l ? estadoEnPalabras(l, this.ahora()) : null;
  });
  readonly hizoContacto = computed(() => !!this.lectorVivo()?.ultimo_contacto);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.detenerSondeo());
    this.api.lectoresDesconocidos(this.idNegocio()).subscribe({
      next: (r) => this.desconocidos.set((r?.data ?? []).map((x) => x.sn).filter(Boolean)),
      error: () => this.desconocidos.set([]),
    });
  }

  campo<K extends keyof BorradorLector>(k: K, v: BorradorLector[K]): void {
    this.b.update((x) => ({ ...x, [k]: v }));
  }

  elegirMarca(clave: string): void {
    this.b.update((x) =>
      aplicarEleccion(this.catalogo(), { ...x, marca: clave, modelo: '', modeloTexto: '', noSe: false }),
    );
  }

  elegirModelo(nombre: string): void {
    this.b.update((x) => aplicarEleccion(this.catalogo(), { ...x, modelo: nombre, noSe: false }));
  }

  noSeCual(): void {
    this.b.update((x) =>
      aplicarEleccion(this.catalogo(), { ...x, marca: '', modelo: '', modeloTexto: '', noSe: true }),
    );
  }

  elegirConexion(c: ConexionLector): void {
    this.b.update((x) => ({ ...x, conexion: c }));
  }

  siguiente1(): void {
    if (!this.puedeSeguir1()) return;
    this.paso.set(2);
  }

  atras(): void {
    if (this.creado()) return;
    this.errores.set([]);
    this.paso.set(this.paso() === 3 ? 2 : 1);
  }

  /** Crea el lector. Con puente se queda en el paso 2 para dar el código; sin él pasa al 3. */
  guardar(): void {
    const faltas = erroresPaso2(this.b());
    this.errores.set(faltas);
    if (faltas.length) return;
    this.guardando.set(true);
    this.errorServidor.set(null);
    this.api.crearLector(this.idNegocio(), construirLector(this.b())).subscribe({
      next: (r) => {
        this.guardando.set(false);
        const l = r?.data ?? null;
        this.creado.set(l);
        this.lectorVivo.set(l);
        this.cambio.emit();
        if (this.conexion() === 'PUENTE') this.generarCodigo();
        else this.irAlPaso3();
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorServidor.set(textoDeError(e, 'No se pudo guardar el lector.'));
      },
    });
  }

  generarCodigo(): void {
    const l = this.creado();
    if (!l) return;
    this.generandoCodigo.set(true);
    this.errorServidor.set(null);
    this.api.codigoEmparejamiento(l.id_lector, this.idNegocio()).subscribe({
      next: (r) => {
        this.generandoCodigo.set(false);
        this.codigo.set(r?.data ?? null);
        this.ahora.set(Date.now());
      },
      error: (e) => {
        this.generandoCodigo.set(false);
        this.errorServidor.set(textoDeError(e, 'No se pudo generar el código.'));
      },
    });
  }

  async copiarCodigo(): Promise<void> {
    const c = this.codigo()?.codigo;
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.copiado.set(false);
    }
  }

  irAlPaso3(): void {
    this.paso.set(3);
    this.sondear();
    if (isPlatformBrowser(this.platformId) && this.conexion() !== 'SOLO_REGISTRO') {
      this.detenerSondeo();
      this.temporizador = setInterval(() => this.sondear(), 5000);
    }
  }

  /** Mira si el lector ya llamó. Se repite cada 5 s hasta que llama o se sale del asistente. */
  private sondear(): void {
    const id = this.creado()?.id_lector;
    if (!id) return;
    this.api.listarLectores(this.idNegocio()).subscribe({
      next: (r) => {
        this.ahora.set(Date.now());
        const l = (r?.data ?? []).find((x) => x.id_lector === id);
        if (l) this.lectorVivo.set(l);
        if (l?.ultimo_contacto) this.detenerSondeo();
      },
    });
  }

  private detenerSondeo(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = undefined;
  }

  enviarMiembros(): void {
    const id = this.creado()?.id_lector;
    if (!id) return;
    this.enviando.set(true);
    this.errorServidor.set(null);
    this.api.resincronizarLector(id, this.idNegocio()).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.enviado.set(r?.data?.encolados ?? 0);
        this.cambio.emit();
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorServidor.set(textoDeError(e, 'No se pudo enviar los miembros.'));
      },
    });
  }

  terminar(): void {
    this.detenerSondeo();
    this.cerrar.emit();
  }
}

export function textoDeError(e: unknown, defecto: string): string {
  const x = e as { error?: { message?: string } };
  return x?.error?.message || defecto;
}
