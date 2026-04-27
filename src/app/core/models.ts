export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: { code?: string; [k: string]: unknown } | unknown[];
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UsuarioGym {
  id_usuario: number;
  nombre_completo: string;
  primer_nombre: string;
  primer_apellido: string;
  email: string;
}

export interface PermisoVista {
  id_nivel: number;
  vista: string;
  url: string;
  roles: string[];
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
}

export interface NegocioGym {
  id_negocio: number;
  nombre: string;
  tipo_negocio: string | null;
  paleta: { id_paleta: number; nombre: string; colores: Record<string, string> } | null;
  roles: { id_rol: number; descripcion: string }[];
  permisos_vista: PermisoVista[];
  permisos_subnivel: unknown[];
}

export interface SesionGym {
  usuario: UsuarioGym;
  permisos_cargados: boolean;
  negocios: NegocioGym[];
  negocio: NegocioGym | null;
  roles: { id_rol: number; descripcion: string }[];
  permisos_vista?: PermisoVista[];
  roles_globales: { id_rol: number; descripcion: string }[];
}

// ── Entidades del dominio gym ──
export interface Plan {
  id_plan: number;
  id_negocio: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracion_meses: number;
  beneficios: string | null;
  estado: 'A' | 'I';
  fecha_creacion: string;
}

export interface Membresia {
  id_membresia: number;
  id_miembro: number;
  id_plan: number;
  id_negocio: number;
  fecha_inicio: string;
  fecha_fin: string;
  precio_pagado: number;
  estado: 'ACTIVA' | 'VENCIDA' | 'PAUSADA' | 'CANCELADA';
  pausada_desde?: string | null;
  pausada_hasta?: string | null;
  fecha_creacion: string;
  plan?: Plan | null;
  miembro?: Miembro | null;
}

export interface Miembro {
  id_miembro: number;
  id_negocio: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  num_identificacion?: string | null;
  email?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: 'M' | 'F' | 'O' | null;
  peso_kg?: number | null;
  altura_cm?: number | null;
  porcentaje_grasa?: number | null;
  direccion?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  alergias?: string | null;
  condiciones_medicas?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  foto_url?: string | null;
  codigo_qr: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'MOROSO' | 'INACTIVO';
  fecha_registro: string;
  fecha_actualizacion: string;
  membresias?: Membresia[];
}

export interface Pago {
  id_pago: number;
  id_membresia: number | null;
  id_miembro: number;
  id_negocio: number;
  monto: number;
  metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO';
  concepto: string | null;
  estado: 'PAGADO' | 'PENDIENTE' | 'ANULADO';
  fecha_pago: string;
  miembro?: Pick<Miembro, 'id_miembro' | 'primer_nombre' | 'primer_apellido' | 'codigo_qr'>;
  membresia?: Membresia | null;
  usuarioCobro?: { id_usuario: number; primer_nombre: string; primer_apellido: string } | null;
}

export interface Asistencia {
  id_asistencia: number;
  id_miembro: number;
  id_negocio: number;
  fecha_entrada: string;
  fecha_salida: string | null;
  metodo: 'QR' | 'MANUAL' | 'HUELLA';
  duracion_minutos: number | null;
  miembro?: Pick<Miembro, 'id_miembro' | 'primer_nombre' | 'primer_apellido' | 'codigo_qr' | 'foto_url' | 'estado'>;
}

export interface ResumenDashboard {
  miembros_activos: number;
  asistencias_hoy: number;
  ingresos_hoy: number;
  ingresos_mes: number;
  proximos_vencen_5d: number;
  ocupacion_actual: number;
}

// ── Productos / Ventas ──
export interface Producto {
  id_producto: number;
  id_negocio: number;
  nombre: string;
  sku: string | null;
  descripcion: string | null;
  categoria: string | null;
  precio: number;
  costo: number | null;
  stock_actual: number;
  stock_minimo: number;
  foto_url: string | null;
  estado: 'A' | 'I';
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface VentaDetalle {
  id_detalle: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto?: { id_producto: number; nombre: string; sku?: string | null };
}

export interface Venta {
  id_venta: number;
  id_negocio: number;
  id_miembro: number | null;
  id_usuario_cobro: number | null;
  total: number;
  metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO';
  estado: 'PAGADA' | 'ANULADA';
  fecha_venta: string;
  detalles?: VentaDetalle[];
  miembro?: { id_miembro: number; primer_nombre: string; primer_apellido: string } | null;
  usuarioCobro?: { id_usuario: number; primer_nombre: string; primer_apellido: string } | null;
}
