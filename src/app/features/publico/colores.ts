/**
 * El color del gimnasio en su página pública.
 *
 * El dueño elige su color de marca, pero sobre él va texto blanco (botones, la franja de arriba):
 * un amarillo o un verde claro dejarían el botón ilegible. Se oscurece el MISMO tono hasta que el
 * blanco encima llega a 4,5:1 (WCAG AA). Así la página se reconoce como del gimnasio y se lee.
 */

const VIOLETA_ESCALAPP = '#5d5497';

function aRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function aHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste del blanco sobre ese color. */
export function contrasteConBlanco(hex: string): number {
  const rgb = aRgb(hex);
  if (!rgb) return 0;
  return 1.05 / (luminancia(rgb) + 0.05);
}

/** El mismo tono, oscurecido lo justo para que el blanco encima se lea. */
export function legibleConBlanco(hex: string): string {
  let rgb = aRgb(hex);
  if (!rgb) return VIOLETA_ESCALAPP;
  for (let i = 0; i < 40 && 1.05 / (luminancia(rgb) + 0.05) < 4.5; i++) {
    rgb = rgb.map((v) => v * 0.92) as [number, number, number];
  }
  return aHex(rgb);
}

/** El color de marca que eligió el gimnasio: los propios primero, luego la paleta. */
export function colorDelGimnasio(
  colores: { primario?: string; acento?: string } | null | undefined,
  paleta: { colores: Record<string, string> } | null | undefined,
): string {
  const c = paleta?.colores ?? {};
  const elegido = colores?.primario ?? c['primario'] ?? c['color-primary'];
  return elegido && aRgb(elegido) ? elegido : VIOLETA_ESCALAPP;
}
