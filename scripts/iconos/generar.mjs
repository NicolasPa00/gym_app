// Genera `src/app/core/icons/phosphor.ts` del gimnasio: los iconos Phosphor en el formato que
// entiende `lucide-angular`, igual que el panel y el restaurante (desde 2026-10-28).
//
// Las herramientas comunes viven en `admin_app-v21/scripts/iconos/` pero solo conocen tres apps
// (y con los nombres del otro PC). Este script toma de allí el MAPA lucide → Phosphor, para que un
// mismo nombre dibuje lo mismo en todas las apps, y añade los iconos que solo usa el gimnasio.
//
// Uso:  node scripts/iconos/generar.mjs        (necesita internet: API de Iconify)
//
// Al añadir un icono: ponlo en ICONOS (y en EXTRA si el mapa común no lo tiene), corre este
// script y regístralo en `app.config.ts`. `lucide-angular` LANZA una excepción al pintar un
// nombre no registrado: no deja un hueco, tumba la vista entera.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = import.meta.dirname;
const APP = path.resolve(AQUI, '..', '..');
const MAPA_COMUN = path.resolve(APP, '..', 'admin_app-v21', 'scripts', 'iconos', 'mapa.json');
const SALIDA = path.join(APP, 'src', 'app', 'core', 'icons', 'phosphor.ts');
const ESCALA = 24 / 256; // 0.09375

/** Los iconos del gimnasio, por su clave de lucide (PascalCase). */
const ICONOS = [
  'Activity', 'ArrowLeft', 'Ban', 'BadgeCheck', 'BadgePercent', 'Banknote', 'Calendar', 'Check',
  'ChevronRight', 'CircleCheck', 'CircleX', 'Clock', 'CreditCard', 'DoorOpen', 'Dumbbell',
  'FileText', 'Fingerprint', 'IdCard', 'Info', 'LayoutDashboard', 'Lock', 'LogIn', 'LogOut',
  'Menu', 'Monitor', 'Package', 'PanelLeft', 'PanelLeftClose', 'Pause', 'Pencil', 'Play', 'Plus',
  'QrCode', 'RefreshCw', 'ScanLine', 'Search', 'Settings', 'ShieldCheck', 'ShoppingCart',
  'TrendingUp', 'TriangleAlert', 'UserCheck', 'UserPlus', 'Users', 'Wifi', 'WifiOff', 'X',
  // Página pública y «Mi página» (2026-11-09)
  'Copy', 'ExternalLink', 'Globe', 'MapPin', 'WhatsappLogo',
  // Tienda de la página pública y panel (segunda pasada)
  'ArrowUp', 'ArrowUpRight', 'Barbell', 'Droplet', 'Flask', 'Image', 'Phone', 'ShoppingBag', 'Timer', 'Upload',
];

/** Los que el mapa común no trae (o el gimnasio dibuja distinto). */
const EXTRA = {
  Activity: 'pulse',
  Fingerprint: 'fingerprint',
  IdCard: 'identification-card',
  QrCode: 'qr-code',
  ScanLine: 'scan',
  WhatsappLogo: 'whatsapp-logo',
  Barbell: 'barbell',
  Droplet: 'drop',
  Flask: 'flask',
  Timer: 'timer',
  Wifi: 'wifi-high',
  WifiOff: 'wifi-slash',
};

/** Los del menú: de estos sale también la variante rellena (marca el ítem activo). */
const CON_FILL = [
  'LayoutDashboard', 'DoorOpen', 'Users', 'BadgePercent', 'IdCard', 'Package', 'ShoppingCart',
  'Banknote', 'Settings',
];

const { mapa } = JSON.parse(fs.readFileSync(MAPA_COMUN, 'utf8'));
const phosphorDe = (k) => EXTRA[k] ?? mapa[k];
const faltan = ICONOS.filter((k) => !phosphorDe(k));
if (faltan.length) throw new Error('Sin equivalente Phosphor: ' + faltan.join(', '));

const necesarios = new Set();
for (const k of ICONOS) {
  necesarios.add(phosphorDe(k));
  if (CON_FILL.includes(k)) necesarios.add(phosphorDe(k) + '-fill');
}
const lista = [...necesarios];
const crudos = {};
for (let i = 0; i < lista.length; i += 50) {
  const r = await fetch('https://api.iconify.design/ph.json?icons=' + lista.slice(i, i + 50).join(','));
  if (!r.ok) throw new Error('Iconify HTTP ' + r.status);
  Object.assign(crudos, (await r.json()).icons || {});
}
const noLlegaron = lista.filter((n) => !crudos[n]);
if (noLlegaron.length) throw new Error('Iconify no devolvió: ' + noLlegaron.join(', '));

// ── Cuerpo SVG → nodos de lucide (mismo procedimiento que admin_app-v21/scripts/iconos) ──
const RE_EL = /<([a-zA-Z]+)\b([^>]*?)\/?>/g;
const RE_ATTR = /([a-zA-Z-]+)="([^"]*)"/g;
const aNodos = (body) => {
  const nodos = [];
  let m;
  RE_EL.lastIndex = 0;
  while ((m = RE_EL.exec(body))) {
    if (m[1] === 'g' || m[1] === 'svg') continue;
    const attrs = {};
    let a;
    RE_ATTR.lastIndex = 0;
    while ((a = RE_ATTR.exec(m[2]))) attrs[a[1]] = a[2];
    attrs.transform = 'scale(' + ESCALA + ')' + (attrs.transform ? ' ' + attrs.transform : '');
    attrs.fill = attrs.fill || 'currentColor';
    attrs.stroke = 'none';
    nodos.push([m[1], attrs]);
  }
  return nodos;
};
const FIJOS = { fill: 'currentColor', stroke: 'none', transform: 'scale(' + ESCALA + ')' };
const esSimple = ([t, a]) =>
  t === 'path' && Object.keys(a).length === 4 && a.d !== undefined &&
  Object.entries(FIJOS).every(([k, v]) => a[k] === v);
const literal = (a) => '{' + Object.entries(a).map(([k, v]) =>
  (/^[a-zA-Z][a-zA-Z0-9]*$/.test(k) ? k : "'" + k + "'") + ":'" + String(v).replace(/'/g, "\\'") + "'",
).join(',') + '}';
const serializar = (nodos) => '[' + nodos.map((n) =>
  esSimple(n) ? "p('" + n[1].d.replace(/'/g, "\\'") + "')" : "['" + n[0] + "'," + literal(n[1]) + ']',
).join(',') + ']';

const lineas = [];
for (const k of [...ICONOS].sort()) {
  lineas.push(`export const ${k}: LucideIconData = ${serializar(aNodos(crudos[phosphorDe(k)].body))};`);
  if (CON_FILL.includes(k)) {
    lineas.push(`export const ${k}Fill: LucideIconData = ${serializar(aNodos(crudos[phosphorDe(k) + '-fill'].body))};`);
  }
}

const cabecera = `/**
 * Pack de iconos Phosphor del gimnasio, en el formato que entiende \`lucide-angular\`.
 *
 * ARCHIVO GENERADO — no editar a mano. Se regenera con \`node scripts/iconos/generar.mjs\`.
 *
 * Las plantillas siguen escribiendo \`<lucide-icon name="users">\`: el componente busca la clave
 * \`Users\` en el proveedor, así que cambiar de iconografía no toca ninguna plantilla. Phosphor es
 * relleno (no trazo) y dibuja en rejilla de 256: cada nodo lleva \`stroke="none"\` y
 * \`scale(${ESCALA})\`, y \`[strokeWidth]\` ya no hace nada. Las claves \`…Fill\` son la variante
 * rellena, solo para los iconos del menú.
 *
 * ${ICONOS.length} iconos + ${CON_FILL.length} rellenos.
 */
import type { LucideIconData, LucideIconNode } from 'lucide-angular';

/** Un <path> de Phosphor: relleno, sin trazo y escalado de la rejilla de 256 a la de 24. */
const p = (d: string): LucideIconNode =>
  ['path', { d, fill: 'currentColor', stroke: 'none', transform: 'scale(${ESCALA})' }];

`;
fs.writeFileSync(SALIDA, cabecera + lineas.join('\n') + '\n');
console.log('Escrito ' + path.relative(APP, SALIDA) + ': ' + lineas.length + ' iconos');
