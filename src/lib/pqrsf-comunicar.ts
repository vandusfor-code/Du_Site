import "server-only";
import * as XLSX from "xlsx";
import { valuesAppend, getSpreadsheetMeta, batchUpdate, readRange, hoyEnBogota, eliminarFilaPorValor } from "@/lib/sheets";

// ============================================================
// PQRSF Por comunicar (Registro): importa un .xls/.xlsx descargado del sistema
// externo y AGREGA filas a la pestaña "PQRSF" del Sheet que ya usamos, copiando
// el formato/validaciones/desplegables de una fila plantilla. No sobrescribe
// nada existente. Reutiliza la conexión de Google Sheets del proyecto.
// ============================================================

const TAB = "PQRSF";
const NUM_COLS = 15; // A..O (se agregó la columna M "SATISFACCIÓN" en el medio)
const TEMPLATE_ROW_0 = 1; // fila 2 (0-based) como plantilla de formato/validación

function sheetId(): string {
  const id = process.env.SHEET_ID_PQRSF_COMUNICAR;
  if (!id) throw new Error("Falta la variable SHEET_ID_PQRSF_COMUNICAR");
  return id;
}

export interface ResultadoImportacion {
  ok: boolean;
  error?: string;
  encontrados?: number;
  registrados?: number;
  omitidos?: number;
  /** Radicados omitidos por estar ya en el Sheet (para mostrarlos en la UI). */
  duplicados?: string[];
}

// Columnas obligatorias del ARCHIVO (se localizan por nombre de encabezado).
const REQUERIDAS = [
  { clave: "radicado", header: "Radicado" },
  { clave: "fechaRecibido", header: "Fecha de Recibido" },
  { clave: "trabajador", header: "Trabajador" },
  { clave: "empresa", header: "Empresa" },
  { clave: "telefono", header: "Telefono" },
  { clave: "correo", header: "Correo electronico" },
] as const;

type ClaveCol = (typeof REQUERIDAS)[number]["clave"];

function norm(s: unknown): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Serial de fecha de Google Sheets/Excel (mismo sistema para fechas >= 1900-03-01,
// como las de 2026). Se calcula desde enteros Y/M/D → sin zonas horarias.
function serialDesdeYMD(anio: number, mes: number, dia: number): number {
  const MS = 86400000;
  return Math.round((Date.UTC(anio, mes - 1, dia) - Date.UTC(1899, 11, 30)) / MS);
}

// Convierte "PQRSF!A9:N16" → índices 0-based de fila inicio/fin (fin exclusivo).
function filasDeRango(rango: string): { inicio: number; fin: number } | null {
  const m = rango.match(/!\D+(\d+):\D+(\d+)/);
  if (!m) return null;
  return { inicio: Number(m[1]) - 1, fin: Number(m[2]) };
}

export async function importarPqrsfComunicar(buffer: Buffer): Promise<ResultadoImportacion> {
  // 1. Leer el archivo (.xls o .xlsx). cellDates:false → las fechas llegan como
  // serial numérico (mismo sistema que Google Sheets), evitando zonas horarias.
  let filas: unknown[][];
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { ok: false, error: "El archivo no contiene ninguna hoja." };
    filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false });
  } catch {
    return { ok: false, error: "Archivo no compatible. Sube un .xls o .xlsx válido." };
  }
  if (!filas.length) return { ok: false, error: "El archivo está vacío." };

  // 2. Localizar columnas por nombre de encabezado.
  const encabezados = (filas[0] as unknown[]).map(norm);
  const idx = {} as Record<ClaveCol, number>;
  for (const col of REQUERIDAS) {
    const i = encabezados.indexOf(norm(col.header));
    if (i === -1) return { ok: false, error: `No se encontró la columna "${col.header}" en el archivo.` };
    idx[col.clave] = i;
  }

  const celda = (fila: unknown[], i: number): string => (fila[i] ?? "").toString().trim();

  // 3. Registros del archivo (omitiendo filas sin radicado). Dedup dentro del archivo.
  const vistosArchivo = new Set<string>();
  interface Registro {
    radicado: string;
    telefono: string;
    nombre: string;
    empresa: string;
    correo: string;
    fechaCofremSerial: number | null;
  }
  const registros: Registro[] = [];
  for (let r = 1; r < filas.length; r++) {
    const fila = filas[r] as unknown[];
    const radicado = celda(fila, idx.radicado);
    if (!radicado) continue;
    if (vistosArchivo.has(radicado)) continue;
    vistosArchivo.add(radicado);

    const fechaRaw = fila[idx.fechaRecibido];
    let fechaCofremSerial: number | null = null;
    if (typeof fechaRaw === "number") {
      fechaCofremSerial = Math.round(fechaRaw); // serial Excel = serial Sheets
    } else if (fechaRaw) {
      const t = fechaRaw.toString().trim();
      const m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/) || t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (m) {
        const [a, b, c] = [m[1], m[2], m[3]].map(Number);
        // yyyy primero si el primer grupo tiene 4 dígitos
        fechaCofremSerial = m[1].length === 4 ? serialDesdeYMD(a, b, c) : serialDesdeYMD(c, b, a);
      }
    }

    registros.push({
      radicado,
      telefono: celda(fila, idx.telefono),
      nombre: celda(fila, idx.trabajador),
      empresa: celda(fila, idx.empresa),
      correo: celda(fila, idx.correo),
      fechaCofremSerial,
    });
  }

  if (registros.length === 0) return { ok: false, error: "El archivo no contiene registros con radicado." };

  // 4. Duplicados: radicados ya existentes en la columna C del Sheet.
  const id = sheetId();
  let existentes: unknown[][];
  try {
    existentes = await readRange(id, `${TAB}!C2:C`);
  } catch {
    return { ok: false, error: "No fue posible conectar con Google Sheets." };
  }
  const radicadosExistentes = new Set(existentes.map((f) => (f[0] ?? "").toString().trim()).filter(Boolean));

  const nuevos = registros.filter((r) => !radicadosExistentes.has(r.radicado));
  const duplicados = registros.filter((r) => radicadosExistentes.has(r.radicado)).map((r) => r.radicado);
  const omitidos = duplicados.length;

  if (nuevos.length === 0) {
    return { ok: true, encontrados: registros.length, registrados: 0, omitidos, duplicados };
  }

  // 5. RECIBIDO PEOPLE = fecha de importación (hoy en Bogotá), como serial.
  const hoy = hoyEnBogota();
  const recibidoSerial = serialDesdeYMD(hoy.anio, hoy.mes + 1, hoy.dia);

  // Fila destino: A..O. Solo B,C,D,F,G,H,I con valor; el resto vacío (conservan
  // desplegables/validación al copiar el formato de la plantilla). Las columnas
  // de seguimiento (J..O) las llena manualmente el equipo en el Sheet.
  const valores = nuevos.map((r) => [
    "", // A ASESOR ASIGNADO
    recibidoSerial, // B RECIBIDO PEOPLE
    r.radicado, // C RADICADO
    r.fechaCofremSerial ?? "", // D FECHA COFREM
    "", // E HORA
    r.nombre, // F NOMBRE
    r.telefono, // G TELEFONO
    r.correo, // H CORREO ELECTRONICO
    r.empresa, // I EMPRESA
    "", // J ESTADO
    "", // K CANAL CONTACTO
    "", // L EFECTIVIDAD
    "", // M SATISFACCIÓN
    "", // N REQUIERE OTRA SOLUCIÓN
    "", // O SE ENCONTRO PQRS
  ]);

  // 6. Append de valores (RAW → sin coerción: fechas como serial, teléfono/radicado tal cual).
  let rangoNuevas: string | undefined;
  try {
    const res = await valuesAppend(id, `${TAB}!A:O`, valores, {
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
    });
    rangoNuevas = res.updatedRange;
  } catch {
    return { ok: false, error: "Error al registrar los datos en Google Sheets." };
  }

  // 7. Copiar formato + validaciones desde la fila plantilla hacia las nuevas filas
  // (no toca los valores ya escritos). Así conservan fuentes, bordes, formato de
  // fecha/número y desplegables idénticos a las filas actuales.
  const filasRango = rangoNuevas ? filasDeRango(rangoNuevas) : null;
  if (filasRango) {
    try {
      const meta = await getSpreadsheetMeta(id, "sheets.properties(sheetId,title)");
      const hoja = meta.sheets?.find((s) => s.properties?.title === TAB);
      const gid = hoja?.properties?.sheetId;
      if (gid !== undefined && gid !== null) {
        const source = { sheetId: gid, startRowIndex: TEMPLATE_ROW_0, endRowIndex: TEMPLATE_ROW_0 + 1, startColumnIndex: 0, endColumnIndex: NUM_COLS };
        const destination = { sheetId: gid, startRowIndex: filasRango.inicio, endRowIndex: filasRango.fin, startColumnIndex: 0, endColumnIndex: NUM_COLS };
        await batchUpdate(id, [
          { copyPaste: { source, destination, pasteType: "PASTE_FORMAT", pasteOrientation: "NORMAL" } },
          { copyPaste: { source, destination, pasteType: "PASTE_DATA_VALIDATION", pasteOrientation: "NORMAL" } },
        ]);
      }
    } catch (e) {
      // El registro ya quedó guardado; solo falló la réplica de formato. No es fatal.
      console.error("[pqrsf-comunicar] no se pudo replicar formato/validación:", e instanceof Error ? e.message : e);
    }
  }

  return { ok: true, encontrados: registros.length, registrados: nuevos.length, omitidos, duplicados };
}

/* ===================== */
/* LISTADO + ELIMINAR (panel Admin/Coordinación) */
/* ===================== */

export interface RegistroComunicar {
  fecha: string;
  fechaTs: number;
  radicado: string;
  nombre: string;
  empresa: string;
  telefono: string;
  estado: string;
  comunicado: boolean;
}

// Serial de fecha (Google Sheets/Excel) → "dd/mm/yyyy".
function fechaDesdeSerial(serial: number): string {
  if (!serial) return "";
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// Lista los registros de "PQRSF por comunicar" (pestaña PQRSF). Comunicado =
// la columna J "ESTADO" tiene valor; vacía = aún por comunicar (faltante).
// Del más reciente (RECIBIDO PEOPLE) al más antiguo.
export async function listarRegistrosComunicar(limite = 1500): Promise<RegistroComunicar[]> {
  const id = sheetId();
  const data = await readRange(id, TAB, { unformatted: true });
  const out: RegistroComunicar[] = [];
  for (let i = 1; i < data.length; i++) {
    const fila = data[i] ?? [];
    const radicado = (fila[2] ?? "").toString().trim();
    if (!radicado) continue;
    const recibido = Number(fila[1]) || 0; // B RECIBIDO PEOPLE (serial)
    const cofrem = Number(fila[3]) || 0; // D FECHA COFREM (serial)
    const estado = (fila[9] ?? "").toString().trim(); // J ESTADO
    out.push({
      fecha: cofrem ? fechaDesdeSerial(cofrem) : recibido ? fechaDesdeSerial(recibido) : "",
      fechaTs: recibido || cofrem,
      radicado,
      nombre: (fila[5] ?? "").toString().trim(), // F NOMBRE
      empresa: (fila[8] ?? "").toString().trim(), // I EMPRESA
      telefono: (fila[6] ?? "").toString().trim(), // G TELEFONO
      estado,
      comunicado: estado !== "",
    });
  }
  out.sort((a, b) => b.fechaTs - a.fechaTs);
  return out.slice(0, limite);
}

// Elimina un registro de "PQRSF por comunicar" por su radicado (col C).
export async function eliminarComunicar(radicado: string): Promise<boolean> {
  return eliminarFilaPorValor(sheetId(), TAB, 2, radicado);
}
