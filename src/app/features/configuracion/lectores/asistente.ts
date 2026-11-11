import {
  Capacidad,
  CatalogoLectores,
  ConexionLector,
  DriverCatalogo,
  MarcaLectorCatalogo,
  ModeloLectorCatalogo,
  NuevoLector,
} from '../../../core/models';

/** Valor del selector de modelo para un modelo que no está en la lista. */
export const OTRO_MODELO = '__otro';
export const ESTRATEGIA_POR_DEFECTO = 'BORRAR_USUARIO';

/** Lo que el asistente «Agregar lector» va recogiendo en sus pasos. */
export interface BorradorLector {
  /** Clave de la marca (ZKTECO…). */
  marca: string;
  /** Nombre del modelo del catálogo, u `OTRO_MODELO` con el nombre en `modeloTexto`. */
  modelo: string;
  modeloTexto: string;
  /** «No sé cuál es»: no se elige marca; se explica cómo leer la etiqueta. */
  noSe: boolean;
  conexion: ConexionLector;
  driver: string;
  estrategia: string;
  nombre: string;
  serie: string;
  ip: string;
  puerto: string;
  usuario: string;
  clave: string;
}

export const BORRADOR_VACIO: BorradorLector = {
  marca: '',
  modelo: '',
  modeloTexto: '',
  noSe: false,
  conexion: 'SOLO_REGISTRO',
  driver: '',
  estrategia: ESTRATEGIA_POR_DEFECTO,
  nombre: '',
  serie: '',
  ip: '',
  puerto: '',
  usuario: '',
  clave: '',
};

const NOMBRES_MARCA: Record<string, string> = {
  ZKTECO: 'ZKTeco',
  HIKVISION: 'Hikvision',
  DAHUA: 'Dahua',
  SUPREMA: 'Suprema',
  ANVIZ: 'Anviz',
  OTRA: 'Otra marca',
};

export function nombreMarca(clave: string): string {
  return NOMBRES_MARCA[clave] ?? clave;
}

export const SERVIDOR_POR_DEFECTO = { host: 'api.escalapp.cloud', puerto: 80 };

export function buscarMarca(c: CatalogoLectores | null, clave: string): MarcaLectorCatalogo | null {
  return c?.marcas.find((m) => m.marca === clave) ?? null;
}

export function buscarModelo(
  c: CatalogoLectores | null,
  marca: string,
  modelo: string,
): ModeloLectorCatalogo | null {
  return buscarMarca(c, marca)?.modelos.find((m) => m.modelo === modelo) ?? null;
}

/** Los drivers del puente que sirven a la marca (el simulado es de pruebas y no se ofrece). */
export function driversDe(c: CatalogoLectores | null, marca: string): DriverCatalogo[] {
  return (c?.drivers ?? []).filter((d) => d.driver !== 'simulado' && d.marcas.includes(marca));
}

export function buscarDriver(c: CatalogoLectores | null, driver: string): DriverCatalogo | null {
  return c?.drivers.find((d) => d.driver === driver) ?? null;
}

/** Formas de conexión posibles para lo elegido; «no sé cuál es» solo admite el registro a mano. */
export function conexionesDe(c: CatalogoLectores | null, b: BorradorLector): ConexionLector[] {
  if (b.noSe) return ['SOLO_REGISTRO'];
  return buscarMarca(c, b.marca)?.conexiones ?? ['SOLO_REGISTRO'];
}

/**
 * Tras elegir marca o modelo: la conexión que sugiere el catálogo (si la marca la admite), el
 * primer driver posible para el puente y la estrategia por defecto.
 */
export function aplicarEleccion(c: CatalogoLectores | null, b: BorradorLector): BorradorLector {
  const posibles = conexionesDe(c, b);
  const sugerida = buscarModelo(c, b.marca, b.modelo)?.conexion_sugerida;
  const conexion = sugerida && posibles.includes(sugerida) ? sugerida : posibles[0];
  const drivers = driversDe(c, b.marca);
  const driver = drivers.some((d) => d.driver === b.driver) ? b.driver : (drivers[0]?.driver ?? '');
  return { ...b, conexion, driver, estrategia: b.estrategia || ESTRATEGIA_POR_DEFECTO };
}

/** Con deshabilitar sin borrar confirmado no hace falta preguntar la estrategia. */
export function pideEstrategia(c: CatalogoLectores | null, b: BorradorLector): boolean {
  if (b.conexion !== 'PUENTE') return false;
  const cap: Capacidad | undefined = buscarDriver(c, b.driver)?.capacidades.deshabilitar_sin_borrar;
  return cap !== true;
}

export function pasosDe(c: CatalogoLectores | null, conexion: ConexionLector): string[] {
  return c?.conexiones.find((x) => x.conexion === conexion)?.pasos ?? [];
}

export function nombreModelo(b: BorradorLector): string | null {
  if (b.noSe) return null;
  if (b.modelo === OTRO_MODELO) return b.modeloTexto.trim() || null;
  return b.modelo || null;
}

/** Hay con qué avanzar del paso 1: un modelo elegido (o escrito), o «no sé cuál es». */
export function paso1Completo(b: BorradorLector): boolean {
  if (b.noSe) return true;
  if (!b.marca || !b.modelo) return false;
  return b.modelo !== OTRO_MODELO || !!b.modeloTexto.trim();
}

export function nombreSugerido(b: BorradorLector): string {
  if (b.nombre.trim()) return b.nombre.trim();
  const m = nombreModelo(b);
  return m ? `Lector ${m}` : 'Lector de la puerta';
}

/** Errores del paso 2 según la conexión; lista vacía = se puede crear. */
export function erroresPaso2(b: BorradorLector): string[] {
  const e: string[] = [];
  if (!b.nombre.trim()) e.push('Ponle un nombre al lector, por ejemplo «Puerta principal».');
  if (b.conexion === 'ZK_ADMS' && !b.serie.trim()) {
    e.push('Escribe el número de serie del lector (está en su etiqueta o en el menú Información).');
  }
  if (b.conexion === 'PUENTE') {
    if (!b.driver) e.push('Elige cómo habla el puente con el lector.');
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(b.ip.trim())) {
      e.push('Escribe la dirección IP del lector, como 192.168.1.50.');
    }
    if (b.puerto.trim() && !(Number(b.puerto) >= 1 && Number(b.puerto) <= 65535)) {
      e.push('El puerto debe ser un número entre 1 y 65535.');
    }
  }
  return e;
}

/** El cuerpo exacto de `POST /gym/lectores`; no manda lo que no aplica a la conexión. */
export function construirLector(b: BorradorLector): NuevoLector {
  const lector: NuevoLector = {
    nombre: nombreSugerido(b),
    marca: b.noSe || !b.marca ? 'OTRA' : b.marca,
    modelo: nombreModelo(b),
    conexion: b.conexion,
  };
  if (b.conexion === 'ZK_ADMS') lector.numero_serie = b.serie.trim().toUpperCase();
  if (b.conexion === 'PUENTE') {
    lector.driver = b.driver;
    lector.direccion_ip = b.ip.trim();
    if (b.puerto.trim()) lector.puerto = Number(b.puerto);
    if (b.usuario.trim()) lector.usuario_aparato = b.usuario.trim();
    if (b.clave) lector.clave_aparato = b.clave;
    lector.estrategia_deshabilitar = b.estrategia || ESTRATEGIA_POR_DEFECTO;
  }
  return lector;
}

/** Sugerencias de número de serie: las que llamaron al servidor, filtradas por lo que se escribe. */
export function sugerirSeries(vistos: string[], escrito: string): string[] {
  const q = escrito.trim().toUpperCase();
  return vistos.filter((s) => !q || s.toUpperCase().includes(q));
}

/** El código de emparejamiento en grupos de cuatro para leerlo y teclearlo sin errores. */
export function codigoEnGrupos(codigo: string): string {
  return codigo.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

export const AYUDA_ETIQUETA = [
  'Mira el costado o la parte de atrás del lector: casi todos traen una etiqueta con la marca, el modelo (MODEL) y el número de serie (S/N).',
  'Tómale una foto nítida a esa etiqueta y otra al frente del lector, y envíalas a soporte de EscalApp. Con eso te decimos cómo conectarlo.',
  'Mientras tanto puedes guardarlo como «solo registro»: no se conecta, pero queda anotado.',
];
