// Utilidades y valores por defecto compartidos por la invitación y el panel.
import { SUPABASE_URL } from "./config.js";

export const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const pad = n => String(n).padStart(2, "0");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export const parseFecha = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? { Y: +m[1], M: +m[2], D: +m[3] } : null;
};
export const fmtFechaLarga = iso => { const f = parseFecha(iso); return f ? `${pad(f.D)} ${MESES[f.M - 1]} ${f.Y}` : ""; };
export const fmtFechaCorta = iso => { const f = parseFecha(iso); return f ? `${f.D} de ${MESES[f.M - 1]}` : ""; };
export const fmtHora = h => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || "");
  if (!m) return "";
  let H = +m[1];
  const s = H >= 12 ? "PM" : "AM";
  H = H % 12 || 12;
  return `${H}:${m[2]} ${s}`;
};
// Fotos de ejemplo (ilustraciones en /ejemplos). Se guardan como "ejemplo:nombre" y se
// reemplazan cuando se sube una foto propia.
export const esEjemplo = u => typeof u === "string" && u.startsWith("ejemplo:");
export const resolverFoto = u => (esEjemplo(u) ? new URL("../ejemplos/" + u.slice(8) + ".svg", import.meta.url).href : u);
export const urlSegura = u => /^https?:\/\//i.test((u || "").trim()) ? u.trim() : "";

// Paletas de la invitación (color principal de títulos, botones y detalles).
export const PALETAS = {
  olivo:      { n: "Olivo",      c: "#53582f" },
  arena:      { n: "Arena",      c: "#a88f66" },
  terracota:  { n: "Terracota",  c: "#a96d4a" },
  vino:       { n: "Vino",       c: "#71383d" },
  noche:      { n: "Azul noche", c: "#273448" }
};
// Claves de versiones anteriores → paleta equivalente
const PALETA_ANTERIOR = { verde: "olivo", azul: "noche", rosa: "terracota", dorado: "arena", grafito: "noche" };
export const paleta = k => PALETAS[k] || PALETAS[PALETA_ANTERIOR[k]] || PALETAS.olivo;

// Tipografías que se pueden elegir (se cargan desde Google Fonts)
export const FUENTES_PRINCIPAL = {
  great:     { n: "Great Vibes",        css: "'Great Vibes','Brush Script MT',cursive", script: true },
  cormorant: { n: "Cormorant Garamond", css: "'Cormorant Garamond',Georgia,serif",            script: false },
  playfair:  { n: "Playfair Display",   css: "'Playfair Display',Georgia,serif",              script: false }
};
export const FUENTES_SECUNDARIA = {
  lora:      { n: "Lora",               css: "'Lora',Georgia,serif" },
  manrope:   { n: "Manrope",            css: "'Manrope',system-ui,sans-serif" },
  cormorant: { n: "Cormorant Garamond", css: "'Cormorant Garamond',Georgia,serif" }
};
export const fuentePrincipal = k => FUENTES_PRINCIPAL[k] || FUENTES_PRINCIPAL.great;
export const fuenteSecundaria = k => FUENTES_SECUNDARIA[k] || FUENTES_SECUNDARIA.lora;

export const COLORES_VEST = [
  { n: "Blanco", c: "#ffffff" }, { n: "Beige", c: "#e3cfb4" }, { n: "Verde oliva", c: "#6b7340" },
  { n: "Negro", c: "#1c1c1c" }, { n: "Rojo", c: "#b3262e" }, { n: "Azul", c: "#2f4f8f" },
  { n: "Rosado", c: "#f1b8c4" }, { n: "Dorado", c: "#c9a24a" }, { n: "Gris", c: "#9a9a9a" }, { n: "Morado", c: "#6e4a8e" }
];
export const TIPOS_VEST = ["Formal", "Semi-formal", "Casual elegante", "Etiqueta", "Informal"];

export const ICONOS = {
  iglesia: { n: "Iglesia", svg: `<svg viewBox="0 0 48 48"><path d="M24 4v8M21 7h6M14 22l10-10 10 10v20H14zM9 42V28l5-3M39 42V28l-5-3M20 42V32a4 4 0 0 1 8 0v10M5 42h38"/></svg>` },
  copas:   { n: "Brindis", svg: `<svg viewBox="0 0 48 48"><path d="M10 6h12l-1 12a5 5 0 0 1-10 0zM16 23v14M10 40h12M26 10h12l-1 12a5 5 0 0 1-10 0zM32 27v10M26 40h12M31 3l2 4"/></svg>` },
  pareja:  { n: "Novios", svg: `<svg viewBox="0 0 48 48"><circle cx="15" cy="10" r="4"/><path d="M15 14c-6 2-9 12-9 22h18c0-10-3-20-9-22zM9 36l-2 8M21 36l2 8"/><circle cx="34" cy="10" r="4"/><path d="M30 16h8v28h-8zM30 16l4 8 4-8"/></svg>` },
  cena:    { n: "Cena", svg: `<svg viewBox="0 0 48 48"><circle cx="26" cy="24" r="13"/><circle cx="26" cy="24" r="8"/><path d="M8 8v10a3 3 0 0 0 3 3v19M11 8v13M14 8v10a3 3 0 0 1-3 3M42 8c-3 3-3 14 0 17v15"/></svg>` },
  disco:   { n: "Baile", svg: `<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="15"/><path d="M9 26h30M24 11v30M13 16c8 4 14 4 22 0M13 36c8-4 14-4 22 0M24 3v8"/></svg>` },
  pastel:  { n: "Pastel", svg: `<svg viewBox="0 0 48 48"><path d="M8 40h32V28H8zM12 28v-6h24v6M16 22v-6h16v6M24 16v-6M24 5c-2 2-2 4 0 4s2-2 0-4zM8 34c4 3 8 3 12 0s8-3 12 0 6 1 8 0"/></svg>` },
  anillos: { n: "Anillos", svg: `<svg viewBox="0 0 48 48"><circle cx="18" cy="29" r="11"/><circle cx="30" cy="29" r="11"/><path d="M14 12l4-5 4 5-4 4zM26 12l4-5 4 5-4 4z"/></svg>` },
  estrella:{ n: "Otro", svg: `<svg viewBox="0 0 48 48"><path d="M24 5l5.500 12 13 1.500-9.700 8.800 2.800 12.900L24 33l-11.600 7.200 2.800-12.900L5.500 18.500l13-1.500z"/></svg>` }
};

// Canciones ya subidas al almacén "boda" de Supabase, entre las que se puede elegir.
const BASE_CANCIONES = `${SUPABASE_URL}/storage/v1/object/public/boda/canciones/`;
export const CANCIONES = [
  { t: "Qué suerte tenerte", a: "Fonseca", url: BASE_CANCIONES + "que-suerte-tenerte.mp3" },
  { t: "Tú de qué vas", a: "Franco de Vita", url: BASE_CANCIONES + "tu-de-que-vas.mp3" }
];

export const DEFAULT_CONFIG = {
  novio: "", novia: "", fecha: "2026-12-08", color: "olivo", tipoPrincipal: "great", tipoSecundaria: "lora",
  versiculo: "Tres cosas permanecerán para siempre: la fe, la esperanza y el amor. Pero la más grande de ellas es el amor.",
  cita: "1 Corintios 13:13",
  mensaje: "Hoy unimos nuestras vidas ante Dios, convencidos de que el amor que nos une se fortalece con su presencia.\n\nComo un cordón de tres dobleces, deseamos construir un hogar donde Él sea el centro de nuestra unión.",
  portada: "ejemplo:portada",
  // Una foto opcional por apartado de la invitación + galería final (por defecto, ilustraciones de ejemplo)
  fotos: { mensaje: "ejemplo:mensaje", calendario: "ejemplo:anillos", vestimenta: "ejemplo:vestimenta", itinerario: "ejemplo:itinerario", final: ["ejemplo:final1", "ejemplo:final2", "ejemplo:final3", "ejemplo:final4"] },
  cancion: "", cancionNombre: "",
  ceremonia: { nombre: "", dir: "", hora: "", mapa: "", foto: "ejemplo:iglesia" },
  recepcion: { mismo: false, nombre: "", dir: "", hora: "", mapa: "", foto: "ejemplo:salon" },
  // Por defecto se pide evitar negro, morado y blanco (se pueden cambiar en el formulario)
  vestimenta: { tipo: "Formal", colores: ["#1c1c1c", "#6e4a8e", "#ffffff"], nota: "" },
  itinerario: [
    { t: "Eucaristía", h: "", ic: "iglesia" },
    { t: "Recepción", h: "", ic: "copas" },
    { t: "Entrada de novios", h: "", ic: "pareja" },
    { t: "Cena especial", h: "", ic: "cena" },
    { t: "¡A bailar!", h: "", ic: "disco" }
  ],
  sobres: { activo: true, texto: "Si deseas tener un detalle con nosotros, hemos elegido la modalidad de lluvia de sobres como muestra de cariño y buenos deseos." },
  confirmarAntes: ""
};

// Mezcla profunda: lo guardado pisa los valores por defecto.
export function mezclar(base, extra) {
  if (Array.isArray(base)) return JSON.parse(JSON.stringify(Array.isArray(extra) ? extra : base));
  if (base && typeof base === "object") {
    const out = {};
    for (const k of Object.keys(base)) out[k] = mezclar(base[k], extra && extra[k] !== undefined ? extra[k] : undefined);
    for (const k of Object.keys(extra || {})) if (!(k in out)) out[k] = extra[k];
    return out;
  }
  return extra !== undefined && extra !== null ? extra : base;
}
export const clonar = o => JSON.parse(JSON.stringify(o));

export const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, p, v) {
  const ks = p.split(".");
  const last = ks.pop();
  const t = ks.reduce((a, k) => a[k], o);
  t[last] = v;
}
