// Configuración de la invitación de cumpleaños. Todo lo que se ve es editable desde el panel.
// Se guarda en el mismo almacén de las invitaciones de boda (campo "config" del evento).

export type IconoLlevar = "trago" | "comida" | "regalo" | "musica" | "foto" | "ropa" | "otro";

export interface ItemLlevar {
  ic: IconoLlevar;
  t: string;
  d: string;
}

export interface CumpleCfg {
  tipo: "cumple";
  anfitrion: string;
  corto: string;
  edad: number;
  version: string;
  modoTexto: string;
  foto: string;
  saludo: string;
  motivo: string;
  modo: string;
  fecha: string; // AAAA-MM-DD
  hora: string; // HH:MM
  lugar: string;
  ciudad: string;
  dir: string;
  mapa: string;
  fotoLugar: string;
  llevarTitulo: string;
  llevarIntro: string;
  llevar: ItemLlevar[];
  rsvpIntro: string;
  confirmarAntes: string;
  finalTexto: string;
  finalCodigo: string;
  cancion: string;
  compila: string[];
}

export const DEFAULTS: CumpleCfg = {
  tipo: "cumple",
  anfitrion: "Duvan Ramos",
  corto: "Duvan",
  edad: 30,
  version: "3.0",
  modoTexto: "Celebración",
  foto: "/cumple/duvan.webp",
  saludo: "Soy Duvan, y quiero celebrar una nueva vuelta al sol contigo.",
  motivo: "Agradecer la vida",
  modo: "Buena compañía",
  fecha: "2026-12-19",
  hora: "18:00",
  lugar: "La Terraza del Patio",
  ciudad: "Montería, Córdoba",
  dir: "",
  mapa: "",
  fotoLugar: "",
  llevarTitulo: "Colabora con la misión",
  llevarIntro: "Puedes sumarte a la celebración como prefieras, no hay reglas estrictas, solo buenas intenciones.",
  llevar: [
    { ic: "trago", t: "Trago", d: "Tu bebida favorita siempre será bienvenida." },
    { ic: "comida", t: "Comida", d: "Algo para compartir y disfrutar entre todos." },
    { ic: "regalo", t: "Regalo", d: "Si quieres tener un detalle conmigo, será muy especial." },
  ],
  rsvpIntro: "Para organizar todo mejor, confírmame si contaré contigo en esta celebración.",
  confirmarAntes: "",
  finalTexto: "Será una noche para celebrar la vida, los logros, los amigos y todo lo que viene en este nuevo capítulo.",
  finalCodigo: "Buena compañía, risas y grandes historias",
  cancion: "",
  compila: [
    "Compilando birthday.exe...",
    "Cargando modo *costeño*...",
    "Importando buenos amigos...",
    "Configurando música y buena vibra...",
    "Ejecutando *celebración*...",
  ],
};

export function mezclar<T>(base: T, extra: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(extra) ? JSON.parse(JSON.stringify(extra)) : JSON.parse(JSON.stringify(base))) as T;
  if (base && typeof base === "object") {
    const out: Record<string, unknown> = {};
    const e = (extra && typeof extra === "object" ? extra : {}) as Record<string, unknown>;
    for (const k of Object.keys(base as object)) out[k] = mezclar((base as Record<string, unknown>)[k], e[k]);
    for (const k of Object.keys(e)) if (!(k in out)) out[k] = e[k];
    return out as T;
  }
  return (extra !== undefined && extra !== null && typeof extra === typeof base ? extra : base) as T;
}

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function parseFecha(iso: string): { Y: number; M: number; D: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? { Y: +m[1], M: +m[2], D: +m[3] } : null;
}

export function fechaLarga(iso: string): string {
  const f = parseFecha(iso);
  if (!f) return "";
  const d = new Date(f.Y, f.M - 1, f.D);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${f.D} de ${MESES[f.M - 1]}`;
}

export function horaLarga(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return "";
  let h = +m[1];
  const suf = h >= 12 ? "p. m." : "a. m.";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suf}`;
}

export function objetivo(cfg: CumpleCfg): number | null {
  const f = parseFecha(cfg.fecha);
  if (!f) return null;
  const [h, m] = (cfg.hora || "00:00").split(":").map(Number);
  return new Date(f.Y, f.M - 1, f.D, h || 0, m || 0).getTime();
}

export interface Invitado {
  nombre: string;
  pases: number;
  estado: "pendiente" | "confirmado" | "declinado";
  asistentes: number | null;
  respondido: string | null;
}

export const urlSegura = (u: string) => /^https?:\/\//i.test(u || "");
