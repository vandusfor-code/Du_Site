import "server-only";
import { getSpreadsheetMeta, readRange } from "@/lib/sheets";
import { PUNTOS_PAGO_MOCK } from "@/lib/puntos-pago-mock";
import type { PuntoPago } from "@/lib/puntos-pago-tipos";

// Puntos de pago: dos hojas de Google Sheets con columnas distintas,
// normalizadas a PuntoPago. Si ninguna responde, se sirve el mock.
//
// 1) Puntos-Retiros (varias cadenas, p. ej. Almacenes Éxito)
//    Cadena | Departamento | Ciudad | Nombre del Punto | Dirección | Horarios
// 2) SuperGIROS
//    DEPARTAMENTO | MUNICIPIO | AGENCIA | DIRECCION
//    La red no viene en columna: se asigna "SuperGIROS".
//    No trae horario → horario null.

const SHEET_RETIROS =
  process.env.SHEET_ID_PUNTOS_RETIRO || "1ktoKS6pkjHiNTjp8DrlNsi1xjssvW3GCoDFcfDcLgs8";
const GID_RETIROS = 1080811033;

const SHEET_SUPERGIROS =
  process.env.SHEET_ID_PUNTOS_SUPERGIROS || "1dZYTAz1qyyPeMZufns1ns7c1a8DugNdl";
const GID_SUPERGIROS = 1481680198;

function texto(row: unknown[], idx: number): string {
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

function rango(titulo: string, celdas: string): string {
  return `'${titulo.replace(/'/g, "''")}'!${celdas}`;
}

async function tituloPorGid(spreadsheetId: string, gid: number, fallback: string): Promise<string> {
  const meta = await getSpreadsheetMeta(spreadsheetId, "sheets.properties(sheetId,title)");
  const hoja = meta.sheets?.find((s) => s.properties?.sheetId === gid);
  return hoja?.properties?.title || fallback;
}

function esEncabezado(valor: string, ...claves: string[]): boolean {
  const n = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return claves.some((c) => n === c || n.startsWith(c));
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
  const tab = await tituloPorGid(SHEET_SUPERGIROS, GID_SUPERGIROS, "SUPERGIROS");
  const filas = await readRange(SHEET_SUPERGIROS, rango(tab, "A2:D"));
  const puntos: PuntoPago[] = [];
  let i = 0;
  for (const f of filas) {
    const departamento = presentar(texto(f, 0));
    const ciudad = presentar(texto(f, 1));
    const nombre = presentar(texto(f, 2));
    const direccion = presentar(texto(f, 3));
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

export async function obtenerPuntosPago(): Promise<{ puntos: PuntoPago[]; fuente: "sheets" | "mock" }> {
  const [retiros, superGiros] = await Promise.allSettled([leerRetiros(), leerSuperGiros()]);

  const puntos: PuntoPago[] = [];
  if (retiros.status === "fulfilled") puntos.push(...retiros.value);
  else console.warn("[puntos-pago] no se pudo leer Puntos-Retiros:", retiros.reason instanceof Error ? retiros.reason.message : retiros.reason);

  if (superGiros.status === "fulfilled") puntos.push(...superGiros.value);
  else console.warn("[puntos-pago] no se pudo leer SuperGIROS:", superGiros.reason instanceof Error ? superGiros.reason.message : superGiros.reason);

  if (puntos.length === 0) {
    return { puntos: PUNTOS_PAGO_MOCK, fuente: "mock" };
  }
  return { puntos, fuente: "sheets" };
}
