import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiResponse, Paginated, Miembro, NuevoMiembro, TextoAutorizacion, TipoAutorizacion,
  AutorizacionesMiembro, AutorizacionFila, MetodoIngreso, PaginaConfig, MarcaGimnasio, Plan, Membresia, Pago, Asistencia, ResumenDashboard,
  Producto, Venta,
} from '../models';

/**
 * Wrapper único para todos los endpoints de /gym.
 * Mantiene el código simple en componentes; cada método devuelve Observable<ApiResponse<T>>.
 */
@Injectable({ providedIn: 'root' })
export class GymApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // ── Dashboard ──
  getResumen(idNegocio: number): Observable<ApiResponse<ResumenDashboard>> {
    return this.http.get<ApiResponse<ResumenDashboard>>(
      `${this.base}/dashboard/resumen?id_negocio=${idNegocio}`,
    );
  }

  // ── Miembros ──
  listarMiembros(opts: { idNegocio: number; q?: string; estado?: string; page?: number; pageSize?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.q)        p = p.set('q', opts.q);
    if (opts.estado)   p = p.set('estado', opts.estado);
    if (opts.page)     p = p.set('page', String(opts.page));
    if (opts.pageSize) p = p.set('page_size', String(opts.pageSize));
    return this.http.get<ApiResponse<Paginated<Miembro>>>(`${this.base}/miembros`, { params: p });
  }
  getMiembro(id: number, idNegocio: number) {
    return this.http.get<ApiResponse<Miembro>>(`${this.base}/miembros/${id}?id_negocio=${idNegocio}`);
  }
  getMiembroPorQr(codigo: string, idNegocio: number) {
    return this.http.get<ApiResponse<Miembro>>(`${this.base}/miembros/qr/${encodeURIComponent(codigo)}?id_negocio=${idNegocio}`);
  }
  getMiembroPorIdentificacion(num: string, idNegocio: number) {
    return this.http.get<ApiResponse<Miembro>>(`${this.base}/miembros/identificacion/${encodeURIComponent(num)}?id_negocio=${idNegocio}`);
  }
  crearMiembro(data: NuevoMiembro) {
    return this.http.post<ApiResponse<Miembro>>(`${this.base}/miembros`, data);
  }
  actualizarMiembro(id: number, data: Partial<Miembro>) {
    return this.http.put<ApiResponse<Miembro>>(`${this.base}/miembros/${id}`, data);
  }
  // ── Autorizaciones de datos sensibles ──
  textosAutorizacion(idNegocio: number) {
    return this.http.get<ApiResponse<Record<TipoAutorizacion, TextoAutorizacion>>>(
      `${this.base}/miembros/autorizaciones/textos?id_negocio=${idNegocio}`,
    );
  }
  listarAutorizaciones(idMiembro: number, idNegocio: number) {
    return this.http.get<ApiResponse<AutorizacionesMiembro>>(
      `${this.base}/miembros/${idMiembro}/autorizaciones?id_negocio=${idNegocio}`,
    );
  }
  registrarAutorizacion(idMiembro: number, idNegocio: number, tipo: TipoAutorizacion, otorgada: boolean) {
    return this.http.post<ApiResponse<AutorizacionFila>>(
      `${this.base}/miembros/${idMiembro}/autorizaciones`,
      { id_negocio: idNegocio, tipo, otorgada, medio: 'PRESENCIAL' },
    );
  }
  cambiarEstadoMiembro(id: number, idNegocio: number, estado: Miembro['estado']) {
    return this.http.patch<ApiResponse<Miembro>>(
      `${this.base}/miembros/${id}/estado`, { id_negocio: idNegocio, estado },
    );
  }

  // ── Planes ──
  listarPlanes(idNegocio: number, incluirInactivos = false) {
    const url = `${this.base}/planes?id_negocio=${idNegocio}` + (incluirInactivos ? '&incluir_inactivos=true' : '');
    return this.http.get<ApiResponse<Plan[]>>(url);
  }
  // ── Mi página ──
  obtenerPagina(idNegocio: number) {
    return this.http.get<ApiResponse<PaginaConfig>>(`${this.base}/pagina?id_negocio=${idNegocio}`);
  }
  guardarPagina(idNegocio: number, data: Partial<PaginaConfig>) {
    return this.http.put<ApiResponse<PaginaConfig>>(`${this.base}/pagina`, { ...data, id_negocio: idNegocio });
  }
  obtenerMarca(idNegocio: number) {
    return this.http.get<ApiResponse<MarcaGimnasio>>(`${this.base}/marca?id_negocio=${idNegocio}`);
  }
  guardarColor(idNegocio: number, primario: string) {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/marca/colores`, { id_negocio: idNegocio, primario, acento: primario });
  }
  restablecerColor(idNegocio: number) {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/marca/colores?id_negocio=${idNegocio}`);
  }
  guardarSlug(idNegocio: number, slug: string) {
    return this.http.put<ApiResponse<{ slug: string }>>(`${this.base}/marca/slug`, { id_negocio: idNegocio, slug });
  }
  subirImagen(idNegocio: number, tipo: 'logo' | 'banner', imagen: Blob) {
    const fd = new FormData();
    fd.append('id_negocio', String(idNegocio));
    fd.append('imagen', new File([imagen], `${tipo}.webp`, { type: imagen.type || 'image/webp' }));
    return this.http.post<ApiResponse<Record<string, string>>>(`${this.base}/marca/${tipo}`, fd);
  }
  eliminarImagen(idNegocio: number, tipo: 'logo' | 'banner') {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/marca/${tipo}?id_negocio=${idNegocio}`);
  }

  crearPlan(data: Partial<Plan>) { return this.http.post<ApiResponse<Plan>>(`${this.base}/planes`, data); }
  actualizarPlan(id: number, data: Partial<Plan>) { return this.http.put<ApiResponse<Plan>>(`${this.base}/planes/${id}`, data); }
  inactivarPlan(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Plan>>(`${this.base}/planes/${id}/inactivar?id_negocio=${idNegocio}`, {});
  }

  // ── Membresías ──
  listarMembresias(opts: { idNegocio: number; idMiembro?: number; estado?: string; page?: number; pageSize?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.idMiembro) p = p.set('id_miembro', String(opts.idMiembro));
    if (opts.estado)    p = p.set('estado', opts.estado);
    if (opts.page)      p = p.set('page', String(opts.page));
    if (opts.pageSize)  p = p.set('page_size', String(opts.pageSize));
    return this.http.get<ApiResponse<Paginated<Membresia>>>(`${this.base}/membresias`, { params: p });
  }
  asignarMembresia(payload: { id_negocio: number; id_miembro: number; id_plan: number }) {
    return this.http.post<ApiResponse<Membresia>>(`${this.base}/membresias`, payload);
  }
  pausarMembresia(id: number, idNegocio: number, hasta?: string | null) {
    return this.http.patch<ApiResponse<Membresia>>(
      `${this.base}/membresias/${id}/pausar`, { id_negocio: idNegocio, hasta: hasta || null },
    );
  }
  reanudarMembresia(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Membresia>>(`${this.base}/membresias/${id}/reanudar`, { id_negocio: idNegocio });
  }
  cancelarMembresia(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Membresia>>(`${this.base}/membresias/${id}/cancelar`, { id_negocio: idNegocio });
  }

  // ── Pagos ──
  listarPagos(opts: { idNegocio: number; idMiembro?: number; desde?: string; hasta?: string; page?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.idMiembro) p = p.set('id_miembro', String(opts.idMiembro));
    if (opts.desde)     p = p.set('desde', opts.desde);
    if (opts.hasta)     p = p.set('hasta', opts.hasta);
    if (opts.page)      p = p.set('page', String(opts.page));
    return this.http.get<ApiResponse<Paginated<Pago>>>(`${this.base}/pagos`, { params: p });
  }
  registrarPago(payload: {
    id_negocio: number; id_miembro: number;
    id_plan?: number | null; id_membresia?: number | null;
    monto: number; metodo: Pago['metodo']; concepto?: string | null;
  }) {
    return this.http.post<ApiResponse<Pago>>(`${this.base}/pagos`, payload);
  }
  anularPago(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Pago>>(`${this.base}/pagos/${id}/anular`, { id_negocio: idNegocio });
  }

  // ── Asistencias ──
  listarAsistencias(opts: { idNegocio: number; idMiembro?: number; desde?: string; hasta?: string; page?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.idMiembro) p = p.set('id_miembro', String(opts.idMiembro));
    if (opts.desde)     p = p.set('desde', opts.desde);
    if (opts.hasta)     p = p.set('hasta', opts.hasta);
    if (opts.page)      p = p.set('page', String(opts.page));
    return this.http.get<ApiResponse<Paginated<Asistencia>>>(`${this.base}/asistencias`, { params: p });
  }
  registrarEntrada(payload: { id_negocio: number; id_miembro: number; metodo?: MetodoIngreso }) {
    return this.http.post<ApiResponse<{ asistencia: Asistencia; ya_estaba_dentro: boolean }>>(
      `${this.base}/asistencias/entrada`, payload,
    );
  }
  registrarSalida(idAsistencia: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Asistencia>>(
      `${this.base}/asistencias/${idAsistencia}/salida`, { id_negocio: idNegocio },
    );
  }

  // ── Productos ──
  listarProductos(opts: { idNegocio: number; q?: string; categoria?: string; pageSize?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.q)        p = p.set('q', opts.q);
    if (opts.categoria) p = p.set('categoria', opts.categoria);
    if (opts.pageSize) p = p.set('page_size', String(opts.pageSize));
    return this.http.get<ApiResponse<Paginated<Producto>>>(`${this.base}/productos`, { params: p });
  }
  crearProducto(data: Partial<Producto>) {
    return this.http.post<ApiResponse<Producto>>(`${this.base}/productos`, data);
  }
  subirFotoProducto(id: number, idNegocio: number, imagen: Blob) {
    const fd = new FormData();
    fd.append('id_negocio', String(idNegocio));
    fd.append('imagen', new File([imagen], 'producto.webp', { type: imagen.type || 'image/webp' }));
    return this.http.post<ApiResponse<{ foto_url: string }>>(`${this.base}/productos/${id}/foto`, fd);
  }
  eliminarFotoProducto(id: number, idNegocio: number) {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/productos/${id}/foto?id_negocio=${idNegocio}`);
  }
    actualizarProducto(id: number, data: Partial<Producto>) {
    return this.http.put<ApiResponse<Producto>>(`${this.base}/productos/${id}`, data);
  }
  inactivarProducto(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Producto>>(`${this.base}/productos/${id}/inactivar?id_negocio=${idNegocio}`, {});
  }
  ajustarStock(id: number, idNegocio: number, delta: number) {
    return this.http.patch<ApiResponse<Producto>>(`${this.base}/productos/${id}/stock`, { id_negocio: idNegocio, delta });
  }

  // ── Ventas ──
  listarVentas(opts: { idNegocio: number; desde?: string; hasta?: string; page?: number }) {
    let p = new HttpParams().set('id_negocio', String(opts.idNegocio));
    if (opts.desde) p = p.set('desde', opts.desde);
    if (opts.hasta) p = p.set('hasta', opts.hasta);
    if (opts.page)  p = p.set('page', String(opts.page));
    return this.http.get<ApiResponse<Paginated<Venta>>>(`${this.base}/ventas`, { params: p });
  }
  registrarVenta(payload: {
    id_negocio: number; id_miembro?: number | null; metodo: Venta['metodo'];
    items: Array<{ id_producto: number; cantidad: number }>;
  }) {
    return this.http.post<ApiResponse<Venta>>(`${this.base}/ventas`, payload);
  }
  anularVenta(id: number, idNegocio: number) {
    return this.http.patch<ApiResponse<Venta>>(`${this.base}/ventas/${id}/anular`, { id_negocio: idNegocio });
  }
}
