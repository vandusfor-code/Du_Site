import "server-only";
import * as XLSX from "xlsx";
import { JWT } from "google-auth-library";
import { getSpreadsheetMeta, readRange } from "@/lib/sheets";
import { PUNTOS_PAGO_MOCK } from "@/lib/puntos-pago-mock";
import type { PuntoPago } from "@/lib/puntos-pago-tipos";

// Puntos de pago: dos fuentes de Google Drive, columnas distintas, unificadas
// a PuntoPago. Si ninguna responde, se sirve el mock.
//
// 1) Puntos-Retiros — Google Sheet nativo
//    Cadena | Departamento | Ciudad | Nombre del Punto | Dirección | Horarios
// 2) SuperGIROS — archivo .xlsx subido a Drive (NO es Sheet nativo).
//    La API de Sheets responde FAILED_PRECONDITION ("must not be an Office
//    file"). Se descarga con Drive y se parsea con xlsx.
//    DEPARTAMENTO | MUNICIPIO | AGENCIA | DIRECCION
//    red = "SuperGIROS"; no trae horario.

const SHEET_RETIROS =
  process.env.SHEET_ID_PUNTOS_RETIRO || "1ktoKS6pkjHiNTjp8DrlNsi1xjssvW3GCoDFcfDcLgs8";
const GID_RETIROS = 1080811033;

const SHEET_SUPERGIROS =
  process.env.SHEET_ID_PUNTOS_SUPERGIROS || "1dZYTAz1qyyPeMZufns1ns7c1a8DugNdl";
const GID_SUPERGIROS = 1481680198;

function texto(row: unknown[], idx: number): string {
  if (idx < 0) return "";
  return (row[idx] ?? "").toString().replace(/\s+/g, " ").trim();
}

function horarioDe(valor: string): string | null {
  return valor.length > 0 ? valor : null;
}

/** Si la celda viene en MAYÚSCULAS (export SuperGIROS), se pasa a título. No se inventa tildes. */
function presentar(valor: string): string {
  const t = valor.trim();
  if (!t) return t;
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letras.length >= 3 && letras === letras.toUpperCase()) {
    return t.toLowerCase().replace(/(^|[\s.#/°-])(\S)/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return t;
}

function clave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function rango(titulo: string, celdas: string): string {
  return `'${titulo.replace(/'/g, "''")}'!${celdas}`;
}

async function tituloPorGid(spreadsheetId: string, gid: number, fallback: string): Promise<string> {
  const meta = await getSpreadsheetMeta(spreadsheetId, "sheets.properties(sheetId,title)");
  const hoja = meta.sheets?.find((s) => s.properties?.sheetId === gid);
  return hoja?.properties?.title || fallback;
}

function esEncabezado(valor: string, ...claves: string[]): boolean {
  const n = clave(valor);
  return claves.some((c) => n === c || n.startsWith(c));
}

function indiceColumna(header: unknown[], ...nombres: string[]): number {
  const buscadas = nombres.map(clave);
  return header.findIndex((h) => {
    const n = clave(String(h ?? ""));
    return buscadas.some((b) => n === b || n.startsWith(b));
  });
}

let driveJwt: JWT | null = null;

async function tokenDrive(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Faltan las variables GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY");
  }
  if (!driveJwt) {
    driveJwt = new JWT({
      email,
      key: key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
  }
  const res = await driveJwt.getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) throw new Error("No se pudo obtener el token de acceso de Drive");
  return token;
}

async function leerXlsxDrive(fileId: string): Promise<unknown[][]> {
  const token = await tokenDrive();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detalle = "";
    try {
      detalle = await res.text();
    } catch {
      /* sin cuerpo */
    }
    throw new Error(`Drive API ${res.status}: ${detalle.slice(0, 300)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nombre = wb.SheetNames.find((n) => /supergiros/i.test(n)) ?? wb.SheetNames[0];
  const sheet = nombre ? wb.Sheets[nombre] : undefined;
  if (!sheet) throw new Error("El archivo SuperGIROS no tiene hojas");
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
}

function parsearSuperGiros(filas: unknown[][]): PuntoPago[] {
  if (filas.length === 0) return [];

  let inicio = 0;
  let colDepto = 0;
  let colCiudad = 1;
  let colNombre = 2;
  let colDir = 3;

  const header = filas[0] ?? [];
  if (esEncabezado(texto(header, 0), "departamento") || indiceColumna(header, "municipio", "agencia") >= 0) {
    const iDepto = indiceColumna(header, "departamento");
    const iCiudad = indiceColumna(header, "municipio", "ciudad");
    const iNombre = indiceColumna(header, "agencia", "nombre del punto", "nombre");
    const iDir = indiceColumna(header, "direccion", "dirección");
    if (iDepto >= 0) colDepto = iDepto;
    if (iCiudad >= 0) colCiudad = iCiudad;
    if (iNombre >= 0) colNombre = iNombre;
    if (iDir >= 0) colDir = iDir;
    inicio = 1;
  }

  const puntos: PuntoPago[] = [];
  let i = 0;
  for (const f of filas.slice(inicio)) {
    const departamento = presentar(texto(f, colDepto));
    const ciudad = presentar(texto(f, colCiudad));
    const nombre = presentar(texto(f, colNombre));
    const direccion = presentar(texto(f, colDir));
    if (!nombre && !direccion) continue;
    if (esEncabezado(departamento, "departamento") || esEncabezado(ciudad, "municipio", "ciudad")) continue;
    puntos.push({
      id: `sg-${i++}`,
      red: "SuperGIROS",
      departamento,
      ciudad,
      nombre: nombre || direccion,
      direccion,
      horario: null,
      latitud: null,
      longitud: null,
    });
  }
  return puntos;
}

async function leerRetiros(): Promise<PuntoPago[]> {
  const tab = await tituloPorGid(SHEET_RETIROS, GID_RETIROS, "Puntos-Retiros");
  const filas = await readRange(SHEET_RETIROS, rango(tab, "A2:F"));
  const puntos: PuntoPago[] = [];
  let i = 0;
  for (const f of filas) {
    const red = presentar(texto(f, 0));
    const departamento = presentar(texto(f, 1));
    const ciudad = presentar(texto(f, 2));
    const nombre = presentar(texto(f, 3));
    const direccion = presentar(texto(f, 4));
    if (!nombre && !direccion) continue;
    if (esEncabezado(red, "cadena") || esEncabezado(nombre, "nombre del punto", "nombre")) continue;
    puntos.push({
      id: `retiro-${i++}`,
      red: red || "Sin red",
      departamento,
      ciudad,
      nombre: nombre || direccion,
      direccion,
      horario: horarioDe(texto(f, 5)),
      latitud: null,
      longitud: null,
    });
  }
  return puntos;
}

async function leerSuperGiros(): Promise<PuntoPago[]> {
  // El archivo de Drive es un .xlsx. Primero se descarga; si en el futuro lo
  // convierten a Google Sheet nativo, se usa la API de Sheets.
  try {
    const filas = await leerXlsxDrive(SHEET_SUPERGIROS);
    return parsearSuperGiros(filas);
  } catch (driveErr) {
    try {
      const tab = await tituloPorGid(SHEET_SUPERGIROS, GID_SUPERGIROS, "SUPERGIROS");
      const filas = await readRange(SHEET_SUPERGIROS, rango(tab, "A2:D"));
      return parsearSuperGiros(filas);
    } catch (sheetErr) {
      const driveMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
      const sheetMsg = sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
      throw new Error(`SuperGIROS Drive: ${driveMsg} | Sheets: ${sheetMsg}`);
    }
  }
}

export async function obtenerPuntosPago(): Promise<{
  puntos: PuntoPago[];
  fuente: "sheets" | "mock";
  avisos: string[];
}> {
  const [retiros, superGiros] = await Promise.allSettled([leerRetiros(), leerSuperGiros()]);

  const puntos: PuntoPago[] = [];
  const avisos: string[] = [];

  if (retiros.status === "fulfilled") {
    puntos.push(...retiros.value);
    console.info(`[puntos-pago] retiros: ${retiros.value.length} puntos`);
  } else {
    const msg = retiros.reason instanceof Error ? retiros.reason.message : String(retiros.reason);
    console.warn("[puntos-pago] no se pudo leer Puntos-Retiros:", msg);
    avisos.push("No se pudieron cargar los puntos de retiro (Éxito y otras cadenas).");
  }

  if (superGiros.status === "fulfilled") {
    puntos.push(...superGiros.value);
    console.info(`[puntos-pago] SuperGIROS: ${superGiros.value.length} puntos`);
  } else {
    const msg = superGiros.reason instanceof Error ? superGiros.reason.message : String(superGiros.reason);
    console.warn("[puntos-pago] no se pudo leer SuperGIROS:", msg);
    avisos.push("No se pudieron cargar los puntos SuperGIROS.");
  }

  if (puntos.length === 0) {
    return { puntos: PUNTOS_PAGO_MOCK, fuente: "mock", avisos };
  }
  return { puntos, fuente: "sheets", avisos };
}
