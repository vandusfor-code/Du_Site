import { google } from "googleapis";

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      "Faltan las variables GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY"
    );
  }

  return {
    client_email: email,
    // En .env las nuevas líneas se escapan como \n, hay que restaurarlas
    private_key: key.replace(/\\n/g, "\n"),
  };
}

export function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// La API de Sheets aplica una cuota de 60 lecturas/min por usuario. En ráfagas
// (varios módulos + navegaciones seguidas) puede devolver 429 RESOURCE_EXHAUSTED,
// lo que hacía fallar incluso el login (buscarUsuario lee la hoja Usuarios).
// Detectamos solo ese caso transitorio y reintentamos con backoff; cualquier otro
// error se relanza de inmediato sin alterar el comportamiento.
function esLimiteDeCuota(err: unknown): boolean {
  const e = err as { code?: number | string; status?: number; response?: { status?: number }; message?: string };
  const code = typeof e?.code === "string" ? parseInt(e.code, 10) : e?.code;
  if (code === 429 || e?.status === 429 || e?.response?.status === 429) return true;
  const msg = (e?.message ?? "").toString().toLowerCase();
  return msg.includes("quota exceeded") || msg.includes("ratelimitexceeded") || msg.includes("resource_exhausted");
}

async function conReintentosDeLectura<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      if (!esLimiteDeCuota(err) || i === intentos - 1) throw err;
      const espera = 400 * 2 ** i + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultimoError;
}

export async function readRange(
  spreadsheetId: string,
  range: string,
  opts?: { unformatted?: boolean }
): Promise<unknown[][]> {
  const sheets = getSheetsClient();
  const res = await conReintentosDeLectura(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: opts?.unformatted ? "UNFORMATTED_VALUE" : "FORMATTED_VALUE",
    })
  );
  return res.data.values ?? [];
}

export async function appendRow(
  spreadsheetId: string,
  range: string,
  row: (string | number)[]
) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number)[][]
) {
  if (rows.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

// Crea la pestaña si no existe (y le pone encabezados, si se dan). Usado por
// procesos administrativos que esperan hojas de log/estado auto-creadas.
export async function asegurarHoja(
  spreadsheetId: string,
  nombreHoja: string,
  headers?: (string | number)[]
) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existe = meta.data.sheets?.some((s) => s.properties?.title === nombreHoja);
  if (existe) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: nombreHoja } } }] },
  });

  if (headers) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${nombreHoja}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

/* ===================== */
/* Fechas de Google Sheets */
/* ===================== */
// La API devuelve fechas como número de serie (días desde 1899-12-30) cuando
// se usa valueRenderOption "UNFORMATTED_VALUE". Estas funciones lo convierten
// tratando la fecha como "hora de pared" (sin aplicar zona horaria), igual a
// como Apps Script la muestra con SpreadsheetApp.

const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function serialToDate(serial: number): Date {
  return new Date(SHEETS_EPOCH_UTC + Math.round(serial * 86400000));
}

export function parseSheetDate(value: unknown): Date | null {
  if (typeof value === "number") return serialToDate(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export type PatronFecha =
  | "dd-MM-yyyy HH:mm"
  | "MMMM yyyy"
  | "dd/MM/yyyy"
  | "dd/MM HH:mm"
  | "HH:mm"
  | "dd/MM/yyyy HH:mm:ss";

export function formatSheetDate(value: unknown, pattern: PatronFecha): string {
  const date = parseSheetDate(value);
  if (!date) return typeof value === "string" ? value : "";

  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm2 = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const HH = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");

  switch (pattern) {
    case "MMMM yyyy":
      return `${MESES[date.getUTCMonth()]} ${yyyy}`;
    case "dd/MM/yyyy":
      return `${dd}/${mm2}/${yyyy}`;
    case "dd/MM HH:mm":
      return `${dd}/${mm2} ${HH}:${mm}`;
    case "HH:mm":
      return `${HH}:${mm}`;
    case "dd/MM/yyyy HH:mm:ss":
      return `${dd}/${mm2}/${yyyy} ${HH}:${mm}:${ss}`;
    case "dd-MM-yyyy HH:mm":
    default:
      return `${dd}-${mm2}-${yyyy} ${HH}:${mm}`;
  }
}

// Fecha actual (día/mes/año) tal como se ve en Colombia, para comparar contra
// fechas de Sheets ya convertidas (que representan "hora de pared", no UTC real).
export function hoyEnBogota(): { dia: number; mes: number; anio: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  return {
    dia: Number(parts.find((p) => p.type === "day")?.value),
    mes: Number(parts.find((p) => p.type === "month")?.value) - 1,
    anio: Number(parts.find((p) => p.type === "year")?.value),
  };
}

// Serie de conteos por período (para las tarjetas de métricas del Home Admin).
// A partir de una lista de fechas (una por fila/evento) construye a la vez el
// conteo de los últimos N días y los últimos N meses. Fechas como hora de pared.
export interface SerieItem {
  fecha: string; // etiqueta ("Hoy", "26/7", "Este mes", "jul"…)
  valor: number;
  esHoy: boolean; // período actual (hoy / mes en curso) → se resalta
}

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function serieDesdeFechas(
  fechas: (Date | null)[],
  dias = 5,
  meses = 5
): { dias: SerieItem[]; meses: SerieItem[] } {
  const hoy = hoyEnBogota(); // { dia, mes (0-based), anio }
  const claveDia = (y: number, m0: number, d: number) => `${y}-${m0}-${d}`;
  const claveMes = (y: number, m0: number) => `${y}-${m0}`;

  const contDia = new Map<string, number>();
  const contMes = new Map<string, number>();
  for (const dt of fechas) {
    if (!dt) continue;
    const y = dt.getUTCFullYear();
    const m0 = dt.getUTCMonth();
    const d = dt.getUTCDate();
    contDia.set(claveDia(y, m0, d), (contDia.get(claveDia(y, m0, d)) ?? 0) + 1);
    contMes.set(claveMes(y, m0), (contMes.get(claveMes(y, m0)) ?? 0) + 1);
  }

  const baseDia = Date.UTC(hoy.anio, hoy.mes, hoy.dia);
  const diasArr: SerieItem[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(baseDia - i * 86400000);
    const esHoy = i === 0;
    diasArr.push({
      fecha: esHoy ? "Hoy" : `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`,
      valor: contDia.get(claveDia(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())) ?? 0,
      esHoy,
    });
  }

  const mesesArr: SerieItem[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    let y = hoy.anio;
    let m = hoy.mes - i;
    while (m < 0) {
      m += 12;
      y--;
    }
    const esActual = i === 0;
    mesesArr.push({ fecha: esActual ? "Este mes" : MESES_ABR[m], valor: contMes.get(claveMes(y, m)) ?? 0, esHoy: esActual });
  }

  return { dias: diasArr, meses: mesesArr };
}

// Convierte una celda de duración (fracción de día u "HH:mm:ss") al formato
// "minutos:segundos" usado en el dashboard de métricas.
export function formatDuration(value: unknown): string {
  if (typeof value === "number") {
    const totalSeconds = Math.round(value * 86400);
    const totalMins = Math.floor(totalSeconds / 60);
    const segs = totalSeconds % 60;
    return `${totalMins}:${String(segs).padStart(2, "0")}`;
  }
  if (typeof value === "string" && value.includes(":")) {
    const [h = 0, m = 0, s = 0] = value.split(":").map((p) => parseInt(p, 10) || 0);
    const totalMins = h * 60 + m;
    return `${totalMins}:${String(s).padStart(2, "0")}`;
  }
  return "0:00";
}
