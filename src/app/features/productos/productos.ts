import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { GymApiService } from '../../core/services/gym-api.service';
import { Producto } from '../../core/models';

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

  readonly modalAbierto = signal(false);
  readonly enviando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly form = signal<Partial<Producto>>(this.formVacio());
  readonly editandoId = signal<number | null>(null);

  readonly negocio = computed(() => this.auth.negocio());
  private debounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { this.cargar(); }

  private formVacio(): Partial<Producto> {
    return {
      nombre: '', sku: '', descripcion: '', categoria: '',
      precio: 0, costo: 0, stock_actual: 0, stock_minimo: 0,
    };
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
      error: () => { this.cargando.set(false); this.productos.set([]); },
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
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }
  abrirEdicion(p: Producto): void {
    this.form.set({ ...p });
    this.editandoId.set(p.id_producto);
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }
  cerrarModal(): void { if (!this.enviando()) this.modalAbierto.set(false); }

  actualizarCampo<K extends keyof Producto>(key: K, value: Producto[K] | null): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  guardar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    const f = this.form();
    if (!f.nombre?.trim()) { this.errorForm.set('Nombre requerido.'); return; }
    if (!(Number(f.precio) >= 0)) { this.errorForm.set('Precio inválido.'); return; }

    const payload: Partial<Producto> = {
      ...f, id_negocio: id,
      precio: Number(f.precio), costo: f.costo != null ? Number(f.costo) : null,
      stock_actual: Number(f.stock_actual) || 0,
      stock_minimo: Number(f.stock_minimo) || 0,
      sku: f.sku?.trim() || null, categoria: f.categoria?.trim() || null,
    };
    this.enviando.set(true); this.errorForm.set(null);
    const editando = this.editandoId();
    const obs$ = editando
      ? this.api.actualizarProducto(editando, payload)
      : this.api.crearProducto(payload);
    obs$.subscribe({
      next: () => { this.enviando.set(false); this.modalAbierto.set(false); this.cargar(); },
      error: (e) => { this.enviando.set(false); this.errorForm.set(e?.error?.message || 'No se pudo guardar.'); },
    });
  }

  inactivar(p: Producto): void {
    const id = this.negocio()?.id_negocio;
    if (!id || !confirm(`¿Inactivar "${p.nombre}"?`)) return;
    this.api.inactivarProducto(p.id_producto, id).subscribe({ next: () => this.cargar() });
  }

  ajustarStock(p: Producto, delta: number): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.ajustarStock(p.id_producto, id, delta).subscribe({
      next: () => this.cargar(),
      error: (e) => alert(e?.error?.message || 'No se pudo ajustar el stock.'),
    });
  }
}
