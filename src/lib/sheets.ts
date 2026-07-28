import { JWT } from "google-auth-library";

// ============================================================
// Acceso a Google Sheets vía REST + fetch (SIN la librería `googleapis`).
//
// `googleapis` pesa ~200 MB y tiene un import carísimo (arma un índice enorme
// de APIs al evaluarse), lo que inflaba el bundle y ralentizaba el arranque en
// frío de CADA función serverless. Aquí solo usamos `google-auth-library`
// (~800 KB) para firmar el token de la cuenta de servicio, y hablamos con la
// API REST de Sheets con `fetch`. La API pública de este módulo es idéntica a
// la anterior (readRange/appendRow/updateRange/appendRows/asegurarHoja), así
// que ningún otro archivo cambia su comportamiento.
// ============================================================

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

// Cliente JWT reutilizado durante toda la vida de la instancia ("caliente").
// google-auth-library cachea el access token internamente y lo renueva solo
// cuando está por expirar, así una página con varias lecturas paga UN solo
// intercambio de token (antes se re-emitía en cada llamada).
let jwtClient: JWT | null = null;

function getJwtClient(): JWT {
  if (jwtClient) return jwtClient;
  const { client_email, private_key } = getCredentials();
  jwtClient = new JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return jwtClient;
}

async function getAccessToken(): Promise<string> {
  const res = await getJwtClient().getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) throw new Error("No se pudo obtener el token de acceso de Google");
  return token;
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

interface HttpError extends Error {
  status?: number;
}

async function sheetsFetch<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detalle = "";
    try {
      detalle = await res.text();
    } catch {
      /* sin cuerpo */
    }
    const err: HttpError = new Error(`Sheets API ${res.status}: ${detalle.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
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
  const render = opts?.unformatted ? "UNFORMATTED_VALUE" : "FORMATTED_VALUE";
  const path = `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=${render}`;
  const data = await conReintentosDeLectura(() => sheetsFetch<{ values?: unknown[][] }>(path));
  return data.values ?? [];
}

// Append de bajo nivel; devuelve el rango donde quedaron las filas nuevas
// (necesario para replicar formato en pqrsf-comunicar).
export async function valuesAppend(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
  opts?: { valueInputOption?: "USER_ENTERED" | "RAW"; insertDataOption?: "INSERT_ROWS" | "OVERWRITE" }
): Promise<{ updatedRange?: string }> {
  const vio = opts?.valueInputOption ?? "USER_ENTERED";
  const ido = opts?.insertDataOption ?? "INSERT_ROWS";
  const path = `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${vio}&insertDataOption=${ido}`;
  const data = await sheetsFetch<{ updates?: { updatedRange?: string } }>(path, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
  return { updatedRange: data.updates?.updatedRange };
}

export async function appendRow(
  spreadsheetId: string,
  range: string,
  row: (string | number)[]
) {
  await valuesAppend(spreadsheetId, range, [row]);
}

export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
) {
  const path = `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await sheetsFetch(path, { method: "PUT", body: JSON.stringify({ values }) });
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number)[][]
) {
  if (rows.length === 0) return;
  await valuesAppend(spreadsheetId, range, rows);
}

// Metadatos del libro (equivalente a spreadsheets.get). `fields` restringe la
// respuesta (p. ej. "sheets.properties(sheetId,title)").
export async function getSpreadsheetMeta<T = { sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(
  spreadsheetId: string,
  fields?: string
): Promise<T> {
  const path = `/${spreadsheetId}${fields ? `?fields=${encodeURIComponent(fields)}` : ""}`;
  return sheetsFetch<T>(path);
}

// batchUpdate genérico (addSheet, copyPaste, etc.).
export async function batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<unknown> {
  const path = `/${spreadsheetId}:batchUpdate`;
  return sheetsFetch(path, { method: "POST", body: JSON.stringify({ requests }) });
}

// Crea la pestaña si no existe (y le pone encabezados, si se dan). Usado por
// procesos administrativos que esperan hojas de log/estado auto-creadas.
export async function asegurarHoja(
  spreadsheetId: string,
  nombreHoja: string,
  headers?: (string | number)[]
) {
  const meta = await getSpreadsheetMeta(spreadsheetId, "sheets.properties(title)");
  const existe = (meta.sheets ?? []).some((s) => s.properties?.title === nombreHoja);
  if (existe) return;

  await batchUpdate(spreadsheetId, [{ addSheet: { properties: { title: nombreHoja } } }]);

  if (headers) {
    await updateRange(spreadsheetId, `${nombreHoja}!A1`, [headers]);
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
