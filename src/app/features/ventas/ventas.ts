import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/services/auth.service';
import { EtiquetaPipe } from '../../core/etiqueta.pipe';
import { GymApiService } from '../../core/services/gym-api.service';
import { Producto, Miembro, Venta } from '../../core/models';

interface CarritoItem {
  producto: Producto;
  cantidad: number;
}

@Component({
  selector: 'gym-ventas',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, CurrencyPipe, DatePipe, EtiquetaPipe],
  templateUrl: './ventas.html',
  styleUrl: './ventas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(GymApiService);

  readonly negocio = computed(() => this.auth.negocio());

  // POS
  readonly productos = signal<Producto[]>([]);
  readonly busquedaProd = signal('');
  readonly carrito = signal<CarritoItem[]>([]);
  readonly metodo = signal<Venta['metodo']>('EFECTIVO');
  readonly miembroSel = signal<Miembro | null>(null);
  readonly busquedaMiembro = signal('');
  readonly miembrosBusqueda = signal<Miembro[]>([]);
  readonly enviando = signal(false);
  readonly errorPos = signal<string | null>(null);

  // Lista
  readonly ventas = signal<Venta[]>([]);
  readonly cargandoVentas = signal(false);

  readonly total = computed(() =>
    this.carrito().reduce((s, i) => s + Number(i.producto.precio) * i.cantidad, 0)
  );

  private debounceProd?: ReturnType<typeof setTimeout>;
  private debounceMiembro?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarVentas();
  }

  cargarProductos(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.api.listarProductos({ idNegocio: id, q: this.busquedaProd() || undefined, pageSize: 60 }).subscribe({
      next: (r) => this.productos.set((r?.data?.rows ?? []).filter(p => p.estado === 'A')),
    });
  }

  onBusquedaProd(v: string): void {
    this.busquedaProd.set(v);
    if (this.debounceProd) clearTimeout(this.debounceProd);
    this.debounceProd = setTimeout(() => this.cargarProductos(), 250);
  }

  agregar(p: Producto): void {
    if (Number(p.stock_actual) <= 0) return;
    const cur = this.carrito();
    const idx = cur.findIndex(i => i.producto.id_producto === p.id_producto);
    if (idx >= 0) {
      const item = cur[idx];
      if (item.cantidad + 1 > Number(p.stock_actual)) return;
      const next = [...cur];
      next[idx] = { ...item, cantidad: item.cantidad + 1 };
      this.carrito.set(next);
    } else {
      this.carrito.set([...cur, { producto: p, cantidad: 1 }]);
    }
  }

  cambiarCantidad(item: CarritoItem, delta: number): void {
    const nueva = item.cantidad + delta;
    if (nueva <= 0) {
      this.carrito.set(this.carrito().filter(i => i !== item));
      return;
    }
    if (nueva > Number(item.producto.stock_actual)) return;
    this.carrito.set(this.carrito().map(i => i === item ? { ...i, cantidad: nueva } : i));
  }

  quitar(item: CarritoItem): void {
    this.carrito.set(this.carrito().filter(i => i !== item));
  }

  buscarMiembros(q: string): void {
    this.busquedaMiembro.set(q);
    this.miembroSel.set(null);
    if (this.debounceMiembro) clearTimeout(this.debounceMiembro);
    if (q.trim().length < 2) { this.miembrosBusqueda.set([]); return; }
    this.debounceMiembro = setTimeout(() => {
      const id = this.negocio()?.id_negocio;
      if (!id) return;
      this.api.listarMiembros({ idNegocio: id, q, pageSize: 6 }).subscribe({
        next: (r) => this.miembrosBusqueda.set(r?.data?.rows ?? []),
      });
    }, 300);
  }

  seleccionarMiembro(m: Miembro): void {
    this.miembroSel.set(m);
    this.busquedaMiembro.set(`${m.primer_nombre} ${m.primer_apellido}`);
    this.miembrosBusqueda.set([]);
  }

  limpiarMiembro(): void {
    this.miembroSel.set(null);
    this.busquedaMiembro.set('');
  }

  cobrar(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    if (this.carrito().length === 0) { this.errorPos.set('Agrega productos al carrito.'); return; }

    this.enviando.set(true); this.errorPos.set(null);
    this.api.registrarVenta({
      id_negocio: id,
      id_miembro: this.miembroSel()?.id_miembro || null,
      metodo: this.metodo(),
      items: this.carrito().map(i => ({ id_producto: i.producto.id_producto, cantidad: i.cantidad })),
    }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.carrito.set([]);
        this.limpiarMiembro();
        this.cargarProductos();
        this.cargarVentas();
      },
      error: (e) => {
        this.enviando.set(false);
        const code = e?.error?.errors?.code;
        if (code === 'STOCK_INSUFICIENTE') {
          const f = e?.error?.errors?.faltantes || [];
          const detalle = f.slice(0, 3).map((x: { nombre: string; stock_actual: number }) => `${x.nombre} (stock: ${x.stock_actual})`).join(', ');
          this.errorPos.set('Stock insuficiente: ' + detalle);
        } else {
          this.errorPos.set(e?.error?.message || 'No se pudo registrar la venta.');
        }
      },
    });
  }

  cargarVentas(): void {
    const id = this.negocio()?.id_negocio;
    if (!id) return;
    this.cargandoVentas.set(true);
    this.api.listarVentas({ idNegocio: id, page: 1 }).subscribe({
      next: (r) => { this.ventas.set(r?.data?.rows ?? []); this.cargandoVentas.set(false); },
      error: () => this.cargandoVentas.set(false),
    });
  }

  anular(v: Venta): void {
    const id = this.negocio()?.id_negocio;
    if (!id || !confirm('¿Anular esta venta? Se devolverá el stock de los productos.')) return;
    this.api.anularVenta(v.id_venta, id).subscribe({
      next: () => { this.cargarVentas(); this.cargarProductos(); },
    });
  }
}
