import {
  Capacidad,
  ConexionLector,
  EstadoComandoLector,
  Lector,
  ResultadoMarcacion,
  TipoComandoLector,
} from '../../../core/models';

/** Pasados estos minutos sin contacto, el lector se considera sin conexión (igual que el servidor). */
export const MINUTOS_CONECTADO = 3;

export type Tono = 'ok' | 'warn' | 'off';

/**
 * Las fechas «sin zona» del servidor son hora de pared de Bogotá (UTC-5, sin horario de verano).
 * Con zona explícita (Z o ±hh:mm) se respeta; sin ella se ancla a -05:00.
 */
export function parseFecha(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const texto = valor.trim().replace(' ', 'T');
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/.test(texto);
  const ms = new Date(conZona ? texto : `${texto}-05:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** «hace un momento», «hace 5 min», «hace 2 h», «hace 3 días». */
export function haceCuanto(desde: number, ahora: number): string {
  const min = Math.floor(Math.max(0, ahora - desde) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export function conexionEnPalabras(c: ConexionLector): string {
  switch (c) {
    case 'ZK_ADMS':
      return 'Directo a internet';
    case 'PUENTE':
      return 'Con puente en el gimnasio';
    default:
      return 'Solo registro';
  }
}

/**
 * El estado del lector dicho para una persona, con el tono de su pastilla. Manda el estado que
 * calcula el servidor; la regla de los 3 minutos solo es respaldo si el servidor no lo trae.
 */
export function estadoEnPalabras(
  l: Pick<Lector, 'estado' | 'conexion' | 'ultimo_contacto'>,
  ahora: number,
): { texto: string; tono: Tono } {
  if (l.estado === 'INACTIVO') return { texto: 'Quitado', tono: 'off' };
  if (l.conexion === 'SOLO_REGISTRO') return { texto: 'Sin conexión: registro a mano', tono: 'off' };
  const ultimo = parseFecha(l.ultimo_contacto);
  if (l.estado === 'CONECTADO') return { texto: 'Conectado', tono: 'ok' };
  if (ultimo === null) return { texto: 'Esperando el primer contacto', tono: 'warn' };
  // Respaldo: sin estado del servidor se calcula con la misma regla.
  if (!l.estado && ahora - ultimo < MINUTOS_CONECTADO * 60000) return { texto: 'Conectado', tono: 'ok' };
  return { texto: `Sin conexión desde ${haceCuanto(ultimo, ahora)}`, tono: 'warn' };
}

export function resultadoEnPalabras(r: ResultadoMarcacion): { texto: string; tono: Tono } {
  switch (r) {
    case 'REGISTRADA':
      return { texto: 'Entró', tono: 'ok' };
    case 'YA_DENTRO':
      return { texto: 'Ya estaba dentro', tono: 'off' };
    case 'VENCIDO_PERO_ENTRO':
      return { texto: 'Entró con la membresía vencida: el lector estaba desactualizado', tono: 'warn' };
    case 'BLOQUEADO_PERO_ENTRO':
      return { texto: 'Entró estando bloqueado: el lector estaba desactualizado', tono: 'warn' };
    case 'SIN_AUTORIZACION_BIOMETRICA':
      return {
        texto:
          'Entró con huella, pero no ha autorizado la huella en EscalApp: pídele la autorización o bórrala del lector',
        tono: 'warn',
      };
    case 'DENEGADA':
      return { texto: 'El lector no lo dejó entrar', tono: 'warn' };
    case 'MIEMBRO_DESCONOCIDO':
      return { texto: 'Número que no es de un miembro', tono: 'off' };
    default:
      return { texto: String(r), tono: 'off' };
  }
}

export function verificacionEnPalabras(v: string | null | undefined): string {
  switch (v) {
    case 'HUELLA':
      return 'Huella';
    case 'FACIAL':
      return 'Rostro';
    case 'TARJETA':
      return 'Tarjeta';
    case 'CLAVE':
      return 'Clave';
    default:
      return v ? 'Otro' : '—';
  }
}

export function tipoComandoEnPalabras(t: TipoComandoLector): string {
  switch (t) {
    case 'HABILITAR':
      return 'Dejar entrar';
    case 'DESHABILITAR':
      return 'Bloquear la entrada';
    case 'BORRAR':
      return 'Borrar del lector';
    case 'ABRIR_PUERTA':
      return 'Abrir la puerta';
    case 'INFO':
      return 'Pedir datos del aparato';
    case 'SINCRONIZAR_HORA':
      return 'Poner la hora';
    default:
      return String(t);
  }
}

export function estadoComandoEnPalabras(e: EstadoComandoLector): { texto: string; tono: Tono } {
  switch (e) {
    case 'PENDIENTE':
      return { texto: 'Por enviar al lector', tono: 'warn' };
    case 'ENVIADO':
      return { texto: 'Enviado, esperando respuesta', tono: 'warn' };
    case 'OK':
      return { texto: 'Listo', tono: 'ok' };
    case 'ERROR':
      return { texto: 'Error en el lector', tono: 'warn' };
    default:
      return { texto: 'Reemplazado por uno más reciente', tono: 'off' };
  }
}

/** Estado de un miembro en un lector según su último comando (§4.2). */
export function estadoMiembroEnLector(
  tipo: TipoComandoLector | null | undefined,
  estado: EstadoComandoLector | null | undefined,
): { texto: string; tono: Tono } {
  if (!tipo || !estado) return { texto: 'Sin enviar al lector', tono: 'off' };
  if (tipo === 'BORRAR') {
    if (estado === 'OK') return { texto: 'Borrado del lector', tono: 'off' };
    if (estado === 'ERROR') return { texto: 'Error en el lector', tono: 'warn' };
    return { texto: 'Revocada, falta borrar del lector', tono: 'warn' };
  }
  if (estado === 'OK') {
    return tipo === 'DESHABILITAR'
      ? { texto: 'En el lector, sin permiso de entrar', tono: 'off' }
      : { texto: 'En el lector', tono: 'ok' };
  }
  if (estado === 'ERROR') return { texto: 'Error en el lector', tono: 'warn' };
  return { texto: 'Por enviar al lector', tono: 'warn' };
}

/** `si` abre sin aviso, `aviso` solo tras advertir que no está comprobado, `no` no se ofrece. */
export function puertaDisponible(c: Capacidad | undefined): 'si' | 'aviso' | 'no' {
  if (c === true) return 'si';
  if (c === 'sin_confirmar') return 'aviso';
  return 'no';
}

/** «vence en 28 minutos» / «ya venció», para el código de emparejamiento. */
export function vencimientoEnPalabras(vence: string | null | undefined, ahora: number): string {
  const v = parseFecha(vence);
  if (v === null) return '';
  const min = Math.ceil((v - ahora) / 60000);
  if (min <= 0) return 'ya venció: genera uno nuevo';
  return min === 1 ? 'vence en 1 minuto' : `vence en ${min} minutos`;
}

/** Una frase para la tarjeta de Ingreso a partir de todos los lectores del gimnasio. */
export function resumenLectores(lectores: Lector[], ahora: number): { texto: string; tono: Tono } {
  const activos = lectores.filter((l) => l.estado !== 'INACTIVO');
  if (activos.length === 0) return { texto: 'Sin lectores configurados', tono: 'off' };
  const conectados = activos.filter((l) => estadoEnPalabras(l, ahora).tono === 'ok').length;
  if (conectados === activos.length) {
    return { texto: activos.length === 1 ? 'Conectado' : `${conectados} lectores conectados`, tono: 'ok' };
  }
  if (conectados === 0) {
    return {
      texto: activos.length === 1 ? estadoEnPalabras(activos[0], ahora).texto : 'Sin conexión',
      tono: 'warn',
    };
  }
  return { texto: `${conectados} de ${activos.length} conectados`, tono: 'warn' };
}

/** Una capacidad que no es `true` (falso o sin confirmar) no se da por segura. */
export function esSegura(c: Capacidad | undefined): boolean {
  return c === true;
}
