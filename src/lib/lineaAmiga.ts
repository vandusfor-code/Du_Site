import "server-only";
import {
  readRange,
  appendRow,
  updateRange,
  parseSheetDate,
  formatSheetDate,
  hoyEnBogota,
} from "@/lib/sheets";

function sheetId(): string {
  const id = process.env.SHEET_ID_LINEA_AMIGA;
  if (!id) throw new Error("Falta la variable SHEET_ID_LINEA_AMIGA");
  return id;
}

function sugerenciasSheetId(): string {
  const id = process.env.SHEET_ID_SUGERENCIAS_PQRSF;
  if (!id) throw new Error("Falta la variable SHEET_ID_SUGERENCIAS_PQRSF");
  return id;
}

const SHEETS = {
  PQRSF: "PQRSF Creados",
  AGENTES: "USUARIOS",
  CHAT: "CHAT",
  NOTIFICACIONES: "Notificaciones",
  TURNOS: "Turnos",
};

const AGENTES_POR_DEFECTO = [
  "Angi Johana Banda Montes",
  "Slendy Lizzeth Pico Garcia",
  "Heillen Tatiana Rincón Lizarazo",
  "Juliana Roa Aragonez",
  "Stefania Ortega Rodríguez",
  "Hadisha Faride Bitar Lerech",
  "Bleidis Farides Cabarcas Charris",
  "Katherine Sofia Nieto Guerra",
];

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

function normalize(str: unknown): string {
  if (!str) return "";
  return str
    .toString()
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function horaBogotaHoy(hours: number, minutes: number): Date {
  const { dia, mes, anio } = hoyEnBogota();
  return new Date(Date.UTC(anio, mes, dia, hours + 5, minutes, 0));
}

function esMismoDiaBogota(date: Date): boolean {
  const hoy = hoyEnBogota();
  return (
    date.getUTCDate() === hoy.dia &&
    date.getUTCMonth() === hoy.mes &&
    date.getUTCFullYear() === hoy.anio
  );
}

/* ===================== */
/* PQRSF */
/* ===================== */

export interface DatosPQRSF {
  radicado: string;
  caso: string;
  clasificacion: string;
  dirige: string;
}

export interface ResultadoGuardarPQRSF {
  estado: "ok" | "duplicado" | "error";
  agente?: string;
  error?: string;
}

export async function guardarPQRSF(
  datos: DatosPQRSF,
  agente: string
): Promise<ResultadoGuardarPQRSF> {
  try {
    const id = sheetId();
    const filas = await readRange(id, SHEETS.PQRSF, { unformatted: true });

    for (let i = 1; i < filas.length; i++) {
      if (texto(filas[i], 2) === datos.radicado) {
        return { estado: "duplicado", agente: texto(filas[i], 1) };
      }
    }

    await appendRow(id, `${SHEETS.PQRSF}!A:F`, [
      new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }),
      agente,
      datos.radicado,
      datos.caso,
      datos.clasificacion,
      datos.dirige,
    ]);

    return { estado: "ok" };
  } catch (e) {
    return { estado: "error", error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export interface PQRSFEncontrado {
  fecha: string;
  agente: string;
  radicado: string;
  clasificacion: string;
  dirige: string;
}

export async function buscarPQRSF(radicado: string): Promise<PQRSFEncontrado | null> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.PQRSF, { unformatted: true });
    const searchVal = radicado.trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (texto(data[i], 2).trim().toLowerCase() === searchVal) {
        return {
          fecha: formatSheetDate(data[i][0], "dd/MM/yyyy HH:mm:ss"),
          agente: texto(data[i], 1),
          radicado: texto(data[i], 2),
          clasificacion: texto(data[i], 4),
          dirige: texto(data[i], 5),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/* ===================== */
/* AGENTES */
/* ===================== */

export async function getAgentes(): Promise<string[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.AGENTES);
    if (data.length < 2) return [...AGENTES_POR_DEFECTO].sort();

    const nombres = data
      .slice(1)
      .map((row) => texto(row, 1))
      .filter((n) => n.trim() !== "");

    return nombres.length > 0 ? [...new Set(nombres)].sort() : [...AGENTES_POR_DEFECTO].sort();
  } catch {
    return [...AGENTES_POR_DEFECTO].sort();
  }
}

/* ===================== */
/* HISTORIAL */
/* ===================== */

export interface ResultadoHistorial {
  historial: { fecha: string; radicado: string }[];
  hoy: number;
}

export async function getHistorial(agente: string): Promise<ResultadoHistorial> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.PQRSF, { unformatted: true });
    if (data.length < 2) return { historial: [], hoy: 0 };

    const agenteNorm = normalize(agente);
    const propios = data.slice(1).filter((row) => normalize(row[1]) === agenteNorm);

    const hoyCount = propios.filter((row) => {
      const fecha = parseSheetDate(row[0]);
      return fecha && esMismoDiaBogota(fecha);
    }).length;

    const historial = propios
      .slice()
      .reverse()
      .slice(0, 10)
      .map((row) => ({
        fecha: formatSheetDate(row[0], "dd/MM/yyyy HH:mm:ss"),
        radicado: texto(row, 2),
      }));

    return { historial, hoy: hoyCount };
  } catch {
    return { historial: [], hoy: 0 };
  }
}

/* ===================== */
/* CHAT */
/* ===================== */

export interface MensajeChat {
  fecha: string;
  usuario: string;
  mensaje: string;
  destinatario: string;
}

export async function getMensajes(usuario: string): Promise<MensajeChat[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.CHAT, { unformatted: true });
    if (data.length < 2) return [];

    const uNorm = normalize(usuario);

    return data
      .slice(1)
      .filter((row) => {
        const destinatario = texto(row, 3);
        return (
          destinatario === "TODOS" ||
          normalize(destinatario) === uNorm ||
          normalize(row[1]) === uNorm
        );
      })
      .slice(-50)
      .map((row) => ({
        fecha: formatSheetDate(row[0], "dd/MM/yyyy HH:mm:ss"),
        usuario: texto(row, 1),
        mensaje: texto(row, 2),
        destinatario: texto(row, 3),
      }));
  } catch {
    return [];
  }
}

export async function enviarMensaje(
  usuario: string,
  mensaje: string,
  destinatario: string
): Promise<void> {
  const id = sheetId();
  await appendRow(id, `${SHEETS.CHAT}!A:D`, [
    new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }),
    usuario,
    mensaje,
    destinatario || "TODOS",
  ]);
}

/* ===================== */
/* NOTIFICACIONES */
/* ===================== */

export interface Notificacion {
  id: number;
  funcionaria: string;
  fecha: string;
  radicado: string;
  mensaje: string;
  estado: string;
}

export async function getNotificaciones(usuario: string): Promise<Notificacion[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.NOTIFICACIONES, { unformatted: true });
    if (data.length < 2) return [];

    const uNorm = normalize(usuario);
    const resultado: Notificacion[] = [];

    data.slice(1).forEach((row, index) => {
      const recibido = row[5];
      if (normalize(row[0]) === uNorm && !recibido) {
        resultado.push({
          id: index + 2,
          funcionaria: texto(row, 0),
          fecha: formatSheetDate(row[1], "dd/MM/yyyy HH:mm:ss"),
          radicado: texto(row, 2),
          mensaje: texto(row, 3),
          estado: texto(row, 4),
        });
      }
    });

    return resultado;
  } catch {
    return [];
  }
}

export async function marcarNotificacionRecibida(id: number): Promise<void> {
  const sid = sheetId();
  await updateRange(sid, `${SHEETS.NOTIFICACIONES}!F${id}`, [
    [new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" })],
  ]);
}

/* ===================== */
/* SUGERENCIAS (base externa) */
/* ===================== */

export interface SugerenciaPQRSF {
  radicado: string;
  canal: string;
  radicador: string;
}

export async function buscarSimilitudPQRSF(texto_: string): Promise<SugerenciaPQRSF[]> {
  try {
    const id = sugerenciasSheetId();
    const data = await readRange(id, "A:G");
    const searchVal = texto_.trim().toLowerCase();
    if (!searchVal) return [];

    const results: SugerenciaPQRSF[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const descripcion = texto(row, 6).toLowerCase();
      if (descripcion.includes(searchVal)) {
        results.push({
          radicado: texto(row, 0),
          canal: texto(row, 5),
          radicador: texto(row, 4),
        });
        if (results.length >= 20) break;
      }
    }
    return results;
  } catch {
    return [];
  }
}

/* ===================== */
/* HORARIOS / WFM */
/* ===================== */

export interface HorarioHoy {
  jornada: string;
  almuerzo: string;
  break1: string;
  break2: string;
}

function serialAIso(row3: unknown): string {
  const fecha = parseSheetDate(row3);
  if (!fecha) return (row3 ?? "").toString().trim();
  if (typeof row3 === "number") {
    // Serial de Sheets: ya convertido consistentemente vía nuestra convención UTC.
    const dd = String(fecha.getUTCDate()).padStart(2, "0");
    const mm = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    return `${fecha.getUTCFullYear()}-${mm}-${dd}`;
  }
  // Texto: soporta separadores /, -, . en formato YYYY-MM-DD o DD-MM-YYYY
  const s = String(row3).replace(/ /g, " ").replace(/\s+/g, " ").trim();
  const parts = s.split(/[/\-.]/);
  if (parts.length === 3) {
    let day: number, month: number, year: number;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    }
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month + 1).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }
  return s;
}

export async function obtenerHorarioHoy(usuario: string): Promise<HorarioHoy | null> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.TURNOS, { unformatted: true });
    const { dia, mes, anio } = hoyEnBogota();
    const targetDateStr = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const userNorm = normalize(usuario);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNombre = texto(row, 0).trim();
      const rowFecha = row[3];
      if (!rowNombre || !rowFecha) continue;

      if (normalize(rowNombre) === userNorm && serialAIso(rowFecha) === targetDateStr) {
        return {
          jornada: texto(row, 4) || "-",
          almuerzo: texto(row, 5) || "-",
          break1: texto(row, 6) || "-",
          break2: texto(row, 7) || "-",
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseHora(horaStr: string): Date | null {
  const match = horaStr.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
  if (!match) return null;
  let horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);
  const meridiano = match[3];
  if (meridiano === "pm" && horas < 12) horas += 12;
  if (meridiano === "am" && horas === 12) horas = 0;
  return horaBogotaHoy(horas, minutos);
}

async function yaNotificadoHoy(usuario: string, mensaje: string): Promise<boolean> {
  try {
    const id = sheetId();
    const data = await readRange(id, SHEETS.NOTIFICACIONES, { unformatted: true });
    if (data.length < 2) return false;

    const startRow = Math.max(1, data.length - 100);
    const uNorm = normalize(usuario);

    for (let i = startRow; i < data.length; i++) {
      const fecha = parseSheetDate(data[i][1]);
      if (!fecha || !esMismoDiaBogota(fecha)) continue;
      if (normalize(data[i][0]) === uNorm && texto(data[i], 3) === mensaje) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function crearNotificacion(usuario: string, mensaje: string): Promise<void> {
  const id = sheetId();
  await appendRow(id, `${SHEETS.NOTIFICACIONES}!A:F`, [
    usuario,
    new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }),
    "HORARIO",
    mensaje,
    "PENDIENTE",
    "",
  ]);
}

export async function verificarHorarios(usuario: string): Promise<void> {
  const info = await obtenerHorarioHoy(usuario);
  if (!info) return;

  const ahora = new Date();
  const eventos = [
    { rango: info.almuerzo, msg: "En 2 minutos inicia tu almuerzo" },
    { rango: info.break1, msg: "En 2 minutos inicia tu break" },
    { rango: info.break2, msg: "En 2 minutos inicia tu break" },
  ];

  for (const ev of eventos) {
    if (!ev.rango || ev.rango === "-" || ev.rango.toUpperCase() === "DESCANSO") continue;

    const partes = ev.rango.split(" a ");
    if (partes.length < 1) continue;

    const inicio = parseHora(partes[0].trim());
    if (!inicio) continue;

    const diffMin = (inicio.getTime() - ahora.getTime()) / (1000 * 60);
    if (diffMin > 1.5 && diffMin <= 2.5) {
      if (!(await yaNotificadoHoy(usuario, ev.msg))) {
        await crearNotificacion(usuario, ev.msg);
      }
    }
  }
}

export interface GestionesMes {
  pqrsfHoy: number;
  pqrsfMes: number;
  radicadosHoy: number;
  radicadosMes: number;
  gestionesTotalesMes: number;
  pqrsfPorComunicar: number;
  pqrsfComunicados: number;
}

export async function obtenerGestionesMes(): Promise<GestionesMes> {
  const id = sheetId();
  const fila = (await readRange(id, "CONTROL!L2:S2", { unformatted: true }))[0] ?? [];
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

  return {
    pqrsfHoy: num(fila[0]),
    pqrsfMes: num(fila[1]),
    radicadosHoy: num(fila[3]),
    radicadosMes: num(fila[4]),
    gestionesTotalesMes: num(fila[5]),
    pqrsfPorComunicar: num(fila[6]),
    pqrsfComunicados: num(fila[7]),
  };
}

export interface ResumenGestion {
  devueltos: number;
  campana: number;
  respondidos: number;
  porResponder: number;
}

// Pendiente: el 2026-07-26 el usuario indicó que aún no existen las
// columnas/pestañas para estos 4 conteos por agente (las va a crear él mismo
// y luego nos dice dónde quedaron). Hasta entonces devolvemos ceros reales
// (no hay nada que contar todavía) en vez de inventar números.
export async function obtenerResumenGestion(_agente: string): Promise<ResumenGestion> {
  return { devueltos: 0, campana: 0, respondidos: 0, porResponder: 0 };
}

// ── PQRSF creados por día (para la tarjeta del Home Admin) ──
// Cuenta filas de la pestaña "PQRSF Creados" por día (columna A "Marca temporal"),
// para los últimos N días. Una sola lectura de esa columna, sin N+1.
export interface PqrsfDia {
  fecha: string;
  valor: number;
  esHoy: boolean;
}

export async function obtenerPqrsfUltimosDias(dias = 5): Promise<PqrsfDia[]> {
  const id = sheetId();
  const data = await readRange(id, `${SHEETS.PQRSF}!A2:A`, { unformatted: true });

  const hoy = hoyEnBogota(); // { dia, mes (0-based), anio }
  const base = Date.UTC(hoy.anio, hoy.mes, hoy.dia);
  const clave = (y: number, m0: number, d: number) => `${y}-${m0}-${d}`;

  const dividir: { key: string; label: string; esHoy: boolean }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(base - i * 86400000);
    dividir.push({
      key: clave(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
      label: `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`,
      esHoy: i === 0,
    });
  }

  const conteo = new Map<string, number>();
  for (const row of data) {
    const dt = parseSheetDate(row[0]);
    if (!dt) continue;
    const k = clave(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }

  return dividir.map((c) => ({ fecha: c.label, valor: conteo.get(c.key) ?? 0, esHoy: c.esHoy }));
}
