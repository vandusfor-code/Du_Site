import "server-only";
import { readRange, appendRow, updateRange, parseSheetDate, formatSheetDate, hoyEnBogota, serieDesdeFechas, type SerieItem } from "@/lib/sheets";

function sheetId(): string {
  const id = process.env.SHEET_ID_RADICACIONES;
  if (!id) throw new Error("Falta la variable SHEET_ID_RADICACIONES");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

function normalize(str: unknown): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function ahoraBogota(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" });
}

// "Hoy a las HH:mm" en Bogotá, como instante UTC real y comparable con `new Date()`.
// Bogotá es UTC-5 todo el año (sin horario de verano).
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
/* ASESORES (para el chat) */
/* ===================== */

export interface Asesor {
  id: string;
  nombre: string;
}

export async function obtenerAsesores(): Promise<Asesor[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, "ASESORES");
    return data
      .slice(1)
      .map((r) => texto(r, 4))
      .filter(Boolean)
      .map((nombre) => ({ id: nombre, nombre }));
  } catch {
    return [];
  }
}

/* ===================== */
/* RADICACIÓN */
/* ===================== */

export interface DatosRadicacion {
  radicado: string;
  fecha?: string;
  devuelto: boolean;
  sncProceso: boolean;
  observacion: string;
}

export interface ResultadoGuardarRadicacion {
  success: boolean;
  updated?: boolean;
  error?: string;
}

export async function guardarRadicacion(
  data: DatosRadicacion,
  funcionaria: string
): Promise<ResultadoGuardarRadicacion> {
  const id = sheetId();
  const filas = await readRange(id, "GESTIONES", { unformatted: true });

  const fechaTexto = data.fecha || hoyISOBogota();

  let filaEncontrada = -1;
  for (let i = 1; i < filas.length; i++) {
    if (texto(filas[i], 3).trim() === data.radicado.trim()) {
      filaEncontrada = i + 1;
      break;
    }
  }

  if (filaEncontrada !== -1) {
    if (data.sncProceso) {
      await Promise.all([
        updateRange(id, `GESTIONES!A${filaEncontrada}`, [[fechaTexto]]),
        updateRange(id, `GESTIONES!E${filaEncontrada}`, [["NA"]]),
        updateRange(id, `GESTIONES!G${filaEncontrada}`, [["SI"]]),
      ]);
      return { success: true, updated: true };
    }
    return { success: false, error: "El radicado ya existe en el sistema." };
  }

  await appendRow(id, "GESTIONES!A:H", [
    fechaTexto,
    "",
    funcionaria,
    data.radicado,
    data.devuelto ? "Si" : "No",
    data.observacion,
    data.sncProceso ? "SI" : "",
    "",
  ]);

  return { success: true };
}

function hoyISOBogota(): string {
  const { dia, mes, anio } = hoyEnBogota();
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/* ===================== */
/* RESUMEN / HISTORIAL */
/* ===================== */

export interface ResumenHoy {
  efectivos: number;
  devueltos: number;
  total: number;
}

export async function obtenerResumenHoy(usuario: string): Promise<ResumenHoy> {
  try {
    const id = sheetId();
    const data = await readRange(id, "GESTIONES", { unformatted: true });
    const uNorm = normalize(usuario);

    let efectivos = 0;
    let devueltos = 0;

    for (let i = 1; i < data.length; i++) {
      const fecha = parseSheetDate(data[i][0]);
      if (!fecha || !esMismoDiaBogota(fecha)) continue;
      if (normalize(data[i][2]) !== uNorm) continue;

      const est = normalize(data[i][4]);
      if (est === "no") efectivos++;
      else if (est === "si" || est === "sí") devueltos++;
    }
    return { efectivos, devueltos, total: efectivos + devueltos };
  } catch {
    return { efectivos: 0, devueltos: 0, total: 0 };
  }
}

export async function obtenerResumenMes(usuario: string): Promise<number> {
  try {
    const id = sheetId();
    const data = await readRange(id, "GESTIONES", { unformatted: true });
    const uNorm = normalize(usuario);
    const { mes, anio } = hoyEnBogota();

    let total = 0;
    for (let i = 1; i < data.length; i++) {
      const fecha = parseSheetDate(data[i][0]);
      if (!fecha) continue;
      if (fecha.getUTCMonth() !== mes || fecha.getUTCFullYear() !== anio) continue;
      if (normalize(data[i][2]) !== uNorm) continue;
      total++;
    }
    return total;
  } catch {
    return 0;
  }
}

export interface HistorialItem {
  fecha: string;
  radicado: string;
  devuelto: string;
  snc: string;
  observacion: string;
}

export async function obtenerHistorial(usuario: string): Promise<HistorialItem[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, "GESTIONES", { unformatted: true });
    const res: HistorialItem[] = [];
    const uNorm = normalize(usuario);

    for (let i = data.length - 1; i > 0; i--) {
      if (normalize(data[i][2]) !== uNorm) continue;
      res.push({
        fecha: formatSheetDate(data[i][0], "dd/MM/yyyy"),
        radicado: texto(data[i], 3),
        devuelto: texto(data[i], 4),
        snc: texto(data[i], 6),
        observacion: texto(data[i], 5),
      });
    }
    return res;
  } catch {
    return [];
  }
}

/* ===================== */
/* DETALLE POR ASESORA (Admin) */
/* ===================== */

export interface DetalleAsesora {
  nombre: string;
  inicial: string;
  total: number;
  exitosas: number;
  devueltas: number;
  sinGestion: number;
  eficiencia: number; // %
  ultimaActividad: string;
  esUsuario: boolean;
}

export interface ResumenDetalle {
  totalRadicadas: number;
  pendientes: number;
  exitosas: number;
  devueltas: number;
  sinGestion: number;
}

export interface DetalleRadicaciones {
  resumen: ResumenDetalle;
  dias: SerieItem[];
  asesoras: DetalleAsesora[];
}

const MESES_ABR_RAD = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaLargaCorta(fecha: Date): string {
  return `${fecha.getUTCDate()} ${MESES_ABR_RAD[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}

// Agrega el desempeño de radicación de los últimos 5 días (misma ventana que las
// barras del Home) agrupado por asesora, leyendo la hoja GESTIONES una sola vez.
// Exitosa = devuelto "No"; Devuelta = "Sí"; Sin gestión = ni Sí ni No; Pendiente
// = SNC en proceso (col G "SI") aún no solucionado (col H vacío).
export async function obtenerDetalleRadicaciones(
  usuarioActual: string,
  opts?: { desde?: string; hasta?: string }
): Promise<DetalleRadicaciones> {
  const vacio: DetalleRadicaciones = {
    resumen: { totalRadicadas: 0, pendientes: 0, exitosas: 0, devueltas: 0, sinGestion: 0 },
    dias: [],
    asesoras: [],
  };
  try {
    const id = sheetId();
    const data = await readRange(id, "GESTIONES", { unformatted: true });
    const { dia, mes, anio } = hoyEnBogota();
    const baseHoy = Date.UTC(anio, mes, dia);

    // Rango [desde, hasta] en días UTC (fechas "yyyy-mm-dd"). Sin opts → últimos 7 días.
    const parseYMD = (s?: string): number | null => {
      const m = (s ?? "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
    };
    let hasta = parseYMD(opts?.hasta) ?? baseHoy;
    let desde = parseYMD(opts?.desde) ?? hasta - 6 * 86400000;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    const uNorm = normalize(usuarioActual);

    const conteoDia = new Map<number, number>();
    const map = new Map<string, DetalleAsesora & { _ts: number }>();
    let pendientes = 0;

    for (let i = 1; i < data.length; i++) {
      const fecha = parseSheetDate(data[i][0]);
      if (!fecha) continue;
      const utc = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
      if (utc < desde || utc > hasta) continue;

      conteoDia.set(utc, (conteoDia.get(utc) ?? 0) + 1);

      const funcionaria = texto(data[i], 2).trim();
      if (!funcionaria) continue;

      const est = normalize(data[i][4]);
      const esExito = est === "no";
      const esDevuelta = est === "si" || est === "sí";
      const enProceso = texto(data[i], 6) === "SI";
      const solucionado = Boolean(data[i][7]);
      if (enProceso && !solucionado) pendientes++;

      const clave = funcionaria.toLowerCase();
      let a = map.get(clave);
      if (!a) {
        a = {
          nombre: funcionaria,
          inicial: (funcionaria.charAt(0) || "?").toUpperCase(),
          total: 0,
          exitosas: 0,
          devueltas: 0,
          sinGestion: 0,
          eficiencia: 0,
          ultimaActividad: "",
          esUsuario: normalize(funcionaria) === uNorm,
          _ts: 0,
        };
        map.set(clave, a);
      }
      a.total++;
      if (esExito) a.exitosas++;
      else if (esDevuelta) a.devueltas++;
      else a.sinGestion++;
      if (utc >= a._ts) {
        a._ts = utc;
        a.ultimaActividad = fechaLargaCorta(fecha);
      }
    }

    const asesoras: DetalleAsesora[] = Array.from(map.values())
      .map(({ _ts, ...a }) => {
        void _ts;
        return { ...a, eficiencia: a.total > 0 ? Math.round((a.exitosas / a.total) * 1000) / 10 : 0 };
      })
      .sort((x, y) => y.total - x.total);

    const totalRadicadas = asesoras.reduce((s, a) => s + a.total, 0);
    const exitosas = asesoras.reduce((s, a) => s + a.exitosas, 0);
    const devueltas = asesoras.reduce((s, a) => s + a.devueltas, 0);
    const sinGestion = asesoras.reduce((s, a) => s + a.sinGestion, 0);

    // Barras: un valor por cada día del rango (Hoy resaltado).
    const dias: SerieItem[] = [];
    const totalDias = Math.max(1, Math.round((hasta - desde) / 86400000) + 1);
    for (let i = 0; i < totalDias; i++) {
      const dUtc = desde + i * 86400000;
      const d = new Date(dUtc);
      const esHoy = dUtc === baseHoy;
      dias.push({
        fecha: esHoy ? "Hoy" : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        valor: conteoDia.get(dUtc) ?? 0,
        esHoy,
      });
    }

    return { resumen: { totalRadicadas, pendientes, exitosas, devueltas, sinGestion }, dias, asesoras };
  } catch {
    return vacio;
  }
}

/* ===================== */
/* SNC / BÚSQUEDA */
/* ===================== */

export interface SncResultado {
  row: number;
  radicado: string;
  funcionaria: string;
  observacion: string;
  estado: "Solucionado" | "En proceso" | "Sin SNC";
  canClose: boolean;
}

export async function buscarSNC(radicado: string): Promise<SncResultado | null> {
  const id = sheetId();
  const data = await readRange(id, "GESTIONES", { unformatted: true });
  const rBusq = radicado.trim();

  for (let i = 1; i < data.length; i++) {
    if (texto(data[i], 3).trim() === rBusq) {
      const solucionado = Boolean(data[i][7]);
      const enProceso = texto(data[i], 6) === "SI";
      return {
        row: i + 1,
        radicado: texto(data[i], 3),
        funcionaria: texto(data[i], 2),
        observacion: texto(data[i], 5),
        estado: solucionado ? "Solucionado" : enProceso ? "En proceso" : "Sin SNC",
        canClose: enProceso && !solucionado,
      };
    }
  }
  return null;
}

export interface BusquedaGeneralResultado {
  funcionaria: string;
  fecha: string;
  observacion: string;
}

export async function buscarGeneral(radicado: string): Promise<BusquedaGeneralResultado | null> {
  const id = sheetId();
  const data = await readRange(id, "GESTIONES", { unformatted: true });
  const rBusq = radicado.trim();

  for (let i = 1; i < data.length; i++) {
    if (texto(data[i], 3).trim() === rBusq) {
      return {
        funcionaria: texto(data[i], 2),
        fecha: formatSheetDate(data[i][0], "dd/MM/yyyy"),
        observacion: texto(data[i], 5),
      };
    }
  }
  return null;
}

export async function marcarSolucionado(rowId: number): Promise<void> {
  const id = sheetId();
  await Promise.all([
    updateRange(id, `GESTIONES!H${rowId}`, [[ahoraBogota()]]),
    updateRange(id, `GESTIONES!E${rowId}`, [["No"]]),
    updateRange(id, `GESTIONES!G${rowId}`, [[""]]),
  ]);
}

/* ===================== */
/* NOTIFICACIONES */
/* ===================== */

export interface Notificacion {
  id: number;
  fecha: string;
  radicado: string;
  mensaje: string;
}

export async function obtenerNotificaciones(usuario: string): Promise<Notificacion[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, "NOTIFICACIONES", { unformatted: true });
    const res: Notificacion[] = [];
    const uNorm = normalize(usuario);

    for (let i = 1; i < data.length; i++) {
      if (normalize(data[i][0]) === uNorm && texto(data[i], 4) !== "Recibido") {
        res.push({
          id: i + 1,
          fecha: formatSheetDate(data[i][1], "dd/MM HH:mm"),
          radicado: texto(data[i], 2),
          mensaje: texto(data[i], 3),
        });
      }
    }
    return res;
  } catch {
    return [];
  }
}

export async function marcarRecibido(id: number): Promise<void> {
  const sid = sheetId();
  await Promise.all([
    updateRange(sid, `NOTIFICACIONES!E${id}`, [["Recibido"]]),
    updateRange(sid, `NOTIFICACIONES!F${id}`, [[ahoraBogota()]]),
  ]);
}

/* ===================== */
/* CHAT */
/* ===================== */

export interface MensajeChat {
  usuario: string;
  mensaje: string;
  fecha: string;
  esPrivado: boolean;
}

export async function obtenerChat(usuario: string): Promise<MensajeChat[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, "CHAT", { unformatted: true });
    const res: MensajeChat[] = [];
    const uNorm = normalize(usuario);

    for (let i = 1; i < data.length; i++) {
      const dest = texto(data[i], 2);
      if (dest === "TODOS" || normalize(dest) === uNorm || normalize(data[i][0]) === uNorm) {
        res.push({
          usuario: texto(data[i], 0),
          mensaje: texto(data[i], 3),
          fecha: formatSheetDate(data[i][1], "HH:mm"),
          esPrivado: dest !== "TODOS",
        });
      }
    }
    return res.slice(-50);
  } catch {
    return [];
  }
}

export async function enviarMensajeChat(usuario: string, mensaje: string, destinatario: string): Promise<void> {
  const id = sheetId();
  await appendRow(id, "CHAT!A:D", [usuario, ahoraBogota(), destinatario || "TODOS", mensaje]);
}

/* ===================== */
/* WFM / HORARIOS */
/* ===================== */

export interface HorarioHoy {
  descanso?: boolean;
  jornada?: string;
  almuerzo?: string;
  break1?: string;
  break2?: string;
}

export async function obtenerHorarioHoy(usuario: string): Promise<HorarioHoy | null> {
  try {
    const id = sheetId();
    const data = await readRange(id, "Turnos", { unformatted: true });
    const { dia, mes, anio } = hoyEnBogota();
    const hoyStr = `${dia}/${mes + 1}/${anio}`;

    for (let i = 1; i < data.length; i++) {
      const fVal = data[i][3];
      let fStr: string;
      if (typeof fVal === "number") {
        const fecha = parseSheetDate(fVal)!;
        fStr = `${fecha.getUTCDate()}/${fecha.getUTCMonth() + 1}/${fecha.getUTCFullYear()}`;
      } else {
        fStr = (fVal ?? "").toString().trim();
      }

      if (texto(data[i], 0) === usuario && fStr === hoyStr) {
        if (texto(data[i], 4) === "DESCANSO") return { descanso: true };
        return {
          jornada: texto(data[i], 4),
          almuerzo: texto(data[i], 5),
          break1: texto(data[i], 6),
          break2: texto(data[i], 7),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function convertirHora(horaStr: string): Date | null {
  const match = horaStr.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];
  if (hours === 12 && modifier === "am") hours = 0;
  else if (hours !== 12 && modifier === "pm") hours += 12;
  return horaBogotaHoy(hours, minutes);
}

async function yaNotificado(usuario: string, radicado: string, mensaje: string): Promise<boolean> {
  try {
    const id = sheetId();
    const data = await readRange(id, "NOTIFICACIONES", { unformatted: true });

    for (let i = data.length - 1; i >= Math.max(1, data.length - 50); i--) {
      const fecha = parseSheetDate(data[i][1]);
      if (!fecha || !esMismoDiaBogota(fecha)) continue;
      if (
        texto(data[i], 0) === usuario &&
        texto(data[i], 2) === radicado &&
        texto(data[i], 3) === mensaje
      ) {
        return true;
      }
    }
  } catch {
    // ignora errores, se asume no notificado
  }
  return false;
}

export async function verificarHorarios(usuario: string): Promise<void> {
  try {
    const horario = await obtenerHorarioHoy(usuario);
    if (!horario || horario.descanso) return;

    const ahora = new Date();
    const eventos: { time: Date; msg: string }[] = [];

    const parseRangeStr = (range: string | undefined, label: string) => {
      if (!range || range === "Sin break" || range === "-" || range === "DESCANSO") return;
      const parts = range.split(" a ");
      if (parts.length !== 2) return;
      const inicio = convertirHora(parts[0]);
      const fin = convertirHora(parts[1]);
      if (inicio) eventos.push({ time: inicio, msg: `Inicio de ${label}` });
      if (fin) eventos.push({ time: fin, msg: `Fin de ${label}` });
    };

    parseRangeStr(horario.jornada, "Jornada");
    parseRangeStr(horario.almuerzo, "Almuerzo");
    parseRangeStr(horario.break1, "Break Mañana");
    parseRangeStr(horario.break2, "Break Tarde");

    for (const ev of eventos) {
      const diff = (ev.time.getTime() - ahora.getTime()) / 60000;
      if (diff > 0 && diff <= 2.1) {
        if (!(await yaNotificado(usuario, "HORARIO", ev.msg))) {
          const id = sheetId();
          await appendRow(id, "NOTIFICACIONES!A:F", [
            usuario,
            ahoraBogota(),
            "HORARIO",
            ev.msg,
            "Pendiente",
            "",
          ]);
        }
      }
    }
  } catch {
    // silencioso, igual que el original
  }
}

// ── Radicaciones por día y por mes (tarjetas del Home Admin) ──
// UNA sola lectura de la columna A "Marca temporal" de GESTIONES; de ahí se
// calculan los últimos N días y los últimos N meses. Sin N+1, hora de pared.
export type RadicacionDia = SerieItem;

export async function obtenerRadicacionesSerie(): Promise<{ dias: RadicacionDia[]; meses: RadicacionDia[] }> {
  const id = sheetId();
  const data = await readRange(id, "GESTIONES!A2:A", { unformatted: true });
  const fechas = data.map((row) => parseSheetDate(row[0]));
  return serieDesdeFechas(fechas, 5, 5);
}
