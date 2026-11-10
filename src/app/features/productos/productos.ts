import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Producto } from '../../core/models';
import { urlRecurso } from '../../core/url-recurso';
import { reducirImagen } from '../configuracion/reducir-imagen';

type Filtro = 'todos' | 'bajo' | 'sin-foto';

/**
 * Productos que vende el gimnasio. Lo activo y marcado «En la página» sale en la tienda de su
 * página pública (`/t/:slug`), con la foto que se suba aquí; lo agotado sale como «Agotado».
 */
@Component({
  selector: 'gym-productos',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, CurrencyPipe],
  templateUrl: './productos.html',
  styleUrl: './productos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(false);
  readonly busqueda = signal('');
  readonly total = signal(0);
  readonly filtro = signal<Filtro>('todos');
  readonly aviso = signal<string | null>(null);
  /** Inactivar pide un segundo toque sobre el mismo producto. */
  readonly confirmarInactivar = signal<number | null>(null);

  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly form = signal<Partial<Producto>>(this.formVacio());
  readonly editandoId = signal<number | null>(null);
  /** Foto elegida en la ventana: se sube después de guardar (un producto nuevo aún no tiene id). */
  readonly fotoNueva = signal<{ blob: Blob; vista: string } | null>(null);
  readonly quitarFoto = signal(false);

  readonly negocio = computed(() => this.auth.negocio());

  readonly bajos = computed(() => this.productos().filter((p) => esBajo(p)).length);
  readonly sinFoto = computed(() => this.productos().filter((p) => !p.foto_url).length);
  readonly visibles = computed(() => {
    const f = this.filtro();
    const lista = this.productos();
    if (f === 'bajo') return lista.filter((p) => esBajo(p));
    if (f === 'sin-foto') return lista.filter((p) => !p.foto_url);
    return lista;
  });

  readonly fotoEnVentana = computed(() => {
    if (this.fotoNueva()) return this.fotoNueva()!.vista;
    if (this.quitarFoto()) return null;
    return urlRecurso(this.form().foto_url);
  });

  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar();
  }

  private formVacio(): Partial<Producto> {
    return {
      nombre: '', sku: '', descripcion: '', categoria: '',
      precio: 0, costo: 0, stock_actual: 0, stock_minimo: 0, publicado: true,
    };
  }

  foto(p: Producto): string | null {
    return urlRecurso(p.foto_url);
  }

  bajo(p: Producto): boolean {
    return esBajo(p);
  }

  cargar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargando.set(true);
    this.api.listarProductos({ idNegocio: id, q: this.busqueda() || undefined, pageSize: 100 }).subscribe({
      next: (res) => {
        this.productos.set(res?.data?.rows ?? []);
        this.total.set(res?.data?.total ?? 0);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.productos.set([]);
      },
    });
  }

  onBusquedaChange(v: string): void {
    this.busqueda.set(v);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.cargar(), 300);
  }

  abrirNuevo(): void {
    this.form.set(this.formVacio());
    this.editandoId.set(null);
    this.prepararVentana();
  }

  abrirEdicion(p: Producto): void {
    this.form.set({ ...p, publicado: p.publicado !== false });
    this.editandoId.set(p.id_producto);
    this.prepararVentana();
  }

  private prepararVentana(): void {
    this.errorForm.set(null);
    this.soltarVista();
    this.fotoNueva.set(null);
    this.quitarFoto.set(false);
    this.modalAbierto.set(true);
  }

  private soltarVista(): void {
    const v = this.fotoNueva();
    if (v) URL.revokeObjectURL(v.vista);
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.soltarVista();
    this.modalAbierto.set(false);
  }

  actualizarCampo<K extends keyof Producto>(key: K, value: Producto[K] | null): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  async elegirFoto(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    try {
      const blob = await reducirImagen(archivo, 900, 900);
      this.soltarVista();
      this.fotoNueva.set({ blob, vista: URL.createObjectURL(blob) });
      this.quitarFoto.set(false);
    } catch (e) {
      this.errorForm.set((e as Error).message || 'No se pudo leer la imagen.');
    }
  }

  descartarFoto(): void {
    this.soltarVista();
    this.fotoNueva.set(null);
    this.quitarFoto.set(true);
  }

  guardar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    const f = this.form();
    if (!f.nombre?.trim()) {
      this.errorForm.set('Escribe el nombre del producto.');
      return;
    }
    if (!(Number(f.precio) >= 0)) {
      this.errorForm.set('El precio no es válido.');
      return;
    }

    const { foto_url: _foto, ...resto } = f;
    const payload: Partial<Producto> = {
      ...resto,
      id_negocio: id,
      precio: Number(f.precio),
      costo: f.costo != null ? Number(f.costo) : null,
      stock_actual: Number(f.stock_actual) || 0,
      stock_minimo: Number(f.stock_minimo) || 0,
      sku: f.sku?.trim() || null,
      categoria: f.categoria?.trim() || null,
      publicado: f.publicado !== false,
    };
    this.enviando.set(true);
    this.errorForm.set(null);
    const editando = this.editandoId();
    const obs$ = editando ? this.api.actualizarProducto(editando, payload) : this.api.crearProducto(payload);
    obs$.subscribe({
      next: (r) => {
        const idProducto = editando ?? r?.data?.id_producto;
        const nueva = this.fotoNueva();
        const terminar = () => {
          this.enviando.set(false);
          this.soltarVista();
          this.modalAbierto.set(false);
          this.cargar();
        };
        if (idProducto && nueva) {
          this.api.subirFotoProducto(idProducto, id, nueva.blob).subscribe({
            next: terminar,
            error: (e) => {
              this.enviando.set(false);
              this.errorForm.set(`El producto se guardó, pero la foto no: ${e?.error?.message || 'inténtalo de nuevo.'}`);
            },
          });
        } else if (idProducto && this.quitarFoto() && f.foto_url) {
          this.api.eliminarFotoProducto(idProducto, id).subscribe({ next: terminar, error: terminar });
        } else {
          terminar();
        }
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorForm.set(e?.error?.message || 'No se pudo guardar.');
      },
    });
  }

  /** Mostrar u ocultar en la página pública se guarda al tocarlo. */
  alternarPagina(p: Producto, publicado: boolean): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.productos.update((l) => l.map((x) => (x.id_producto === p.id_producto ? { ...x, publicado } : x)));
    this.api.actualizarProducto(p.id_producto, { id_negocio: id, publicado }).subscribe({
      error: (e) => {
        this.productos.update((l) => l.map((x) => (x.id_producto === p.id_producto ? { ...x, publicado: !publicado } : x)));
        this.aviso.set(e?.error?.message || 'No se pudo cambiar.');
      },
    });
  }

  inactivar(p: Producto): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    if (this.confirmarInactivar() !== p.id_producto) {
      this.confirmarInactivar.set(p.id_producto);
      return;
    }
    this.confirmarInactivar.set(null);
    this.api.inactivarProducto(p.id_producto, id).subscribe({
      next: () => this.cargar(),
      error: (e) => this.aviso.set(e?.error?.message || 'No se pudo inactivar.'),
    });
  }

  ajustarStock(p: Producto, delta: number): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.aviso.set(null);
    this.api.ajustarStock(p.id_producto, id, delta).subscribe({
      next: () => this.cargar(),
      error: (e) => this.aviso.set(e?.error?.message || 'No se pudo ajustar la existencia.'),
    });
  }
}

function esBajo(p: Producto): boolean {
  return Number(p.stock_actual) <= Number(p.stock_minimo);
}
