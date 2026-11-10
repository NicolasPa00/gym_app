/**
 * Lee el horario que el gimnasio escribe a mano en «Mi página» y dice si está abierto ahora.
 *
 * El dueño escribe una línea por grupo de días, por ejemplo:
 *   Lunes a viernes: 5:00 a. m. – 10:00 p. m.
 *   Sábados: 7:00 a. m. – 2:00 p. m.
 *   Domingos y festivos: 8:00 a. m. – 12:00 m.
 *
 * Es texto libre, así que leerlo puede fallar: en ese caso no se dice nada (ni «abierto» ni
 * «cerrado»). Un estado equivocado es peor que ninguno: manda a alguien a una puerta cerrada.
 */

export interface LineaHorario {
  /** «Lunes a viernes» */
  dias: string;
  /** «5:00 a. m. – 10:00 p. m.», o null si la línea no trae horas. */
  horas: string | null;
  /** Días de la semana que cubre (0 = domingo … 6 = sábado). Vacío si no se pudo leer. */
  diasSemana: number[];
  /** Minutos desde medianoche; null si no se pudo leer o dice «cerrado». */
  abre: number | null;
  cierra: number | null;
  /** El texto de la hora de cierre tal como lo escribió el gimnasio («10:00 p. m.»). */
  cierraTexto: string | null;
  abreTexto: string | null;
}

export type EstadoHorario =
  | { abierto: true; texto: string }
  | { abierto: false; texto: string };

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** «Lunes a viernes», «Lunes, miércoles y viernes», «Sábados», «Todos los días». */
export function leerDias(texto: string): number[] {
  const t = sinTildes(texto);
  if (/todos los dias|todos los días|diario|toda la semana/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const encontrados: { dia: number; pos: number }[] = [];
  for (const [nombre, dia] of Object.entries(DIAS)) {
    const re = new RegExp(`\\b${nombre}s?\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) encontrados.push({ dia, pos: m.index });
  }
  encontrados.sort((a, b) => a.pos - b.pos);
  if (!encontrados.length) return [];
  // «lunes a viernes» → rango (también «de lunes a viernes»).
  if (encontrados.length === 2 && /\b(a|al|hasta)\b/.test(t.slice(encontrados[0].pos, encontrados[1].pos))) {
    const [ini, fin] = [encontrados[0].dia, encontrados[1].dia];
    const dias: number[] = [];
    for (let d = ini; ; d = (d + 1) % 7) {
      dias.push(d);
      if (d === fin || dias.length > 7) break;
    }
    return dias;
  }
  return [...new Set(encontrados.map((e) => e.dia))];
}

const HORA = /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|m\.(?!\w)|am\b|pm\b)?/gi;

function aMinutos(h: number, min: number, sufijo: string | undefined): number | null {
  if (h > 24 || min > 59) return null;
  const s = sufijo ? sinTildes(sufijo).replace(/[\s.]/g, '') : '';
  if (s === 'm') return 12 * 60 + min; // «12:00 m.» = mediodía
  if (s === 'am') return (h % 12) * 60 + min;
  if (s === 'pm') return ((h % 12) + 12) * 60 + min;
  return h * 60 + min; // sin sufijo: se toma como hora de 24
}

/** «5:00 a. m. – 10:00 p. m.» → minutos de apertura y cierre. */
export function leerHoras(texto: string): Pick<LineaHorario, 'abre' | 'cierra' | 'abreTexto' | 'cierraTexto'> {
  const nada = { abre: null, cierra: null, abreTexto: null, cierraTexto: null };
  if (/cerrad/i.test(texto)) return nada;
  const horas = [...texto.matchAll(HORA)].filter((m) => m[2] || m[3]);
  if (horas.length < 2) return nada;
  const [a, c] = horas;
  const abre = aMinutos(+a[1], +(a[2] ?? 0), a[3]);
  let cierra = aMinutos(+c[1], +(c[2] ?? 0), c[3]);
  if (abre === null || cierra === null) return nada;
  if (cierra === 0) cierra = 24 * 60; // «12:00 a. m.» de cierre = medianoche
  if (cierra <= abre) return nada; // horarios que cruzan la medianoche: no se adivinan
  return { abre, cierra, abreTexto: a[0].trim(), cierraTexto: c[0].trim() };
}

export function leerHorario(texto: string | null | undefined): LineaHorario[] {
  return (texto ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      // «5:00 a. m.» también lleva dos puntos: solo se parte si lo de antes no es una hora.
      const partido = i > 0 && !/\d$/.test(l.slice(0, i));
      const dias = partido ? l.slice(0, i).trim() : l;
      const horas = partido ? l.slice(i + 1).trim() : null;
      return { dias, horas, diasSemana: leerDias(dias), ...leerHoras(horas ?? '') };
    });
}

/** La línea que corresponde a ese día de la semana, si alguna lo cubre. */
export function lineaDelDia(lineas: LineaHorario[], dia: number): LineaHorario | undefined {
  return lineas.find((l) => l.diasSemana.includes(dia));
}

/**
 * «Abierto hasta las 10:00 p. m.» o «Cerrado · abre mañana a las 5:00 a. m.».
 * null si el horario no se pudo leer con seguridad.
 */
export function estadoAhora(lineas: LineaHorario[], ahora: Date): EstadoHorario | null {
  // Solo se opina si TODAS las líneas con horas se entendieron.
  if (!lineas.length || lineas.some((l) => l.horas && (!l.diasSemana.length || l.abre === null && !/cerrad/i.test(l.horas)))) {
    return null;
  }
  const dia = ahora.getDay();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const hoy = lineaDelDia(lineas, dia);
  if (hoy && hoy.abre !== null && hoy.cierra !== null) {
    if (min >= hoy.abre && min < hoy.cierra) return { abierto: true, texto: `Abierto hasta las ${hoy.cierraTexto}` };
    if (min < hoy.abre) return { abierto: false, texto: `Cerrado · abre hoy a las ${hoy.abreTexto}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    const l = lineaDelDia(lineas, d);
    if (l && l.abre !== null) {
      const cuando = i === 1 ? 'mañana' : `el ${NOMBRE_DIA[d]}`;
      return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${l.abreTexto}` };
    }
  }
  return null;
}
