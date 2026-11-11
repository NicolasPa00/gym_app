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
  plan_activo?: boolean;
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
  /** Sale en la página pública (si además está activo). */
  publicado?: boolean;
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
  /** Estado vigente de las autorizaciones de datos sensibles (solo lectura: lo escribe el libro). */
  autoriza_biometria?: boolean;
  autoriza_datos_salud?: boolean;
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
  metodo: MetodoIngreso;
  duracion_minutos: number | null;
  miembro?: Pick<Miembro, 'id_miembro' | 'primer_nombre' | 'primer_apellido' | 'codigo_qr' | 'foto_url' | 'estado'>;
}

/** Lo que el gimnasio edita de su página pública (Configuración → Mi página). */
export interface PaginaConfig {
  url: string;
  slug: string | null;
  tiene_logo: boolean;
  tiene_portada: boolean;
  pagina_activa: boolean;
  frase: string;
  descripcion: string;
  horario_texto: string;
  servicios: string;
  mapa_url: string;
  creditos_fotos: string;
  whatsapp: string;
  direccion: string;
  url_instagram: string;
  url_facebook: string;
  url_tiktok: string;
}

/** Identidad del negocio (logo, portada, color, URL propia): `GET /gym/marca`. */
export interface MarcaGimnasio {
  id_negocio: number;
  nombre: string;
  logo_url: string | null;
  banner_url: string | null;
  colores: { primario?: string; acento?: string } | null;
  slug: string | null;
}

/** HUELLA y FACIAL los registra el programa del lector (docs/gym-biometria.md), no la recepción. */
export type MetodoIngreso = 'QR' | 'MANUAL' | 'CEDULA' | 'HUELLA' | 'FACIAL' | 'TARJETA';

// ── Autorizaciones de datos sensibles (Ley 1581 de 2012) ──
export type TipoAutorizacion = 'BIOMETRIA' | 'SALUD';

/** El texto que el miembro lee y acepta, ya con el nombre del gimnasio. */
export interface TextoAutorizacion {
  tipo: TipoAutorizacion;
  version: string;
  titulo: string;
  texto: string;
}

export interface AutorizacionFila {
  id_autorizacion: number;
  tipo: TipoAutorizacion;
  otorgada: boolean;
  version_texto: string;
  texto: string;
  medio: 'PRESENCIAL' | 'DIGITAL';
  fecha: string;
}

export interface AutorizacionesMiembro {
  autoriza_biometria: boolean;
  autoriza_datos_salud: boolean;
  historial: AutorizacionFila[];
}

export interface NuevoMiembro extends Partial<Miembro> {
  autorizaciones?: { tipo: TipoAutorizacion; otorgada: boolean }[];
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
  /** Sale en la tienda de la página pública (si además está activo). */
  publicado?: boolean;
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

// ── Lectores biométricos (docs/gym-lectores-biometricos.md del backend) ──
export type ConexionLector = 'ZK_ADMS' | 'PUENTE' | 'SOLO_REGISTRO';
export type EstadoLector = 'PENDIENTE' | 'CONECTADO' | 'DESCONECTADO' | 'INACTIVO';
export type CapacidadAbrirPuerta = boolean | 'sin_confirmar';

export type Capacidad = boolean | 'sin_confirmar';

export interface CapacidadesLector {
  deshabilitar_sin_borrar?: Capacidad;
  vigencia_en_aparato?: Capacidad;
  abrir_puerta?: Capacidad;
  eventos_en_vivo?: Capacidad;
}

export interface ModeloLectorCatalogo {
  modelo: string;
  conexion_sugerida: ConexionLector;
  nota?: string;
}

export interface MarcaLectorCatalogo {
  /** Clave de la marca (ZKTECO, HIKVISION…): es lo que se manda al crear. */
  marca: string;
  modelos: ModeloLectorCatalogo[];
  /** Formas de conexión posibles para esa marca. */
  conexiones: ConexionLector[];
}

export interface ConexionCatalogo {
  conexion: ConexionLector;
  titulo: string;
  capacidades: CapacidadesLector;
  pasos: string[];
}

export interface DriverCatalogo {
  driver: string;
  marcas: string[];
  nombre: string;
  puerto_defecto: number | null;
  capacidades: CapacidadesLector;
}

export interface EstrategiaDeshabilitar {
  valor: string;
  descripcion: string;
}

export interface CatalogoLectores {
  servidor_adms?: string;
  marcas: MarcaLectorCatalogo[];
  conexiones: ConexionCatalogo[];
  drivers: DriverCatalogo[];
  estrategias_deshabilitar: EstrategiaDeshabilitar[];
}

export interface Lector {
  id_lector: number;
  id_negocio: number;
  nombre: string;
  marca: string;
  modelo: string | null;
  conexion: ConexionLector;
  driver: string | null;
  numero_serie: string | null;
  direccion_ip: string | null;
  puerto: number | null;
  usuario_aparato: string | null;
  estrategia_deshabilitar?: string | null;
  admite_vigencia?: boolean;
  estado: EstadoLector;
  ultimo_contacto: string | null;
  ultima_marcacion: string | null;
  info_aparato?: Record<string, unknown> | null;
  /** `estado` ya viene calculado por el servidor (CONECTADO si hubo contacto hace <= 3 min). */
  comandos_pendientes?: number;
  capacidades?: CapacidadesLector;
  /** Solo PUENTE: ya se emparejó con un código. */
  emparejado?: boolean;
  /** El servidor nunca devuelve la clave; solo si hay una guardada. */
  tiene_clave?: boolean;
}

export interface NuevoLector {
  nombre: string;
  marca: string;
  modelo?: string | null;
  conexion: ConexionLector;
  driver?: string | null;
  numero_serie?: string | null;
  direccion_ip?: string | null;
  puerto?: number | null;
  usuario_aparato?: string | null;
  clave_aparato?: string | null;
  estrategia_deshabilitar?: string | null;
}

export type EstadoComandoLector = 'PENDIENTE' | 'ENVIADO' | 'OK' | 'ERROR' | 'REEMPLAZADO';
export type TipoComandoLector =
  'HABILITAR' | 'DESHABILITAR' | 'BORRAR' | 'ABRIR_PUERTA' | 'INFO' | 'SINCRONIZAR_HORA';

export interface ComandoLector {
  id_comando: number;
  id_lector: number;
  tipo: TipoComandoLector;
  id_miembro: number | null;
  estado: EstadoComandoLector;
  intentos?: number;
  resultado?: string | null;
  creado_en: string;
  terminado_en?: string | null;
}

export type ResultadoMarcacion =
  | 'REGISTRADA' | 'YA_DENTRO' | 'VENCIDO_PERO_ENTRO' | 'DENEGADA'
  | 'MIEMBRO_DESCONOCIDO' | 'BLOQUEADO_PERO_ENTRO' | 'SIN_AUTORIZACION_BIOMETRICA';

export interface MarcacionLector {
  id_marcacion: number;
  id_lector: number;
  pin: string;
  fecha_evento: string;
  verificacion: string | null;
  concedido: boolean | null;
  id_miembro: number | null;
  resultado: ResultadoMarcacion;
  /** Nombre completo, ya armado por el servidor (null si el número no es de un miembro). */
  miembro?: string | null;
}

export interface EstadoMiembroLector {
  id_lector: number;
  nombre?: string;
  comando?: TipoComandoLector | null;
  estado?: EstadoComandoLector | null;
  /** La frase lista para mostrar («En el lector», «Revocada, falta borrar del lector»…). */
  texto: string;
}

export interface MiembroEnLectores {
  /** El número que se teclea en el lector: es el `id_miembro`. */
  numero_en_lector: string;
  lectores: EstadoMiembroLector[];
}

export interface LectorDesconocido {
  sn: string;
  primera_vez?: string;
  ultima_vez?: string;
  veces?: number;
}

export interface CodigoEmparejamiento {
  codigo: string;
  vence: string;
}
