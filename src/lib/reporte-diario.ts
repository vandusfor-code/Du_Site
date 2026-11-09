import "server-only";
import { getGoogleAccessToken, getSpreadsheetMeta } from "@/lib/sheets";
import { enviarCorreoConAdjunto } from "@/lib/mailer";

// ============================================================
// Reporte diario de radicaciones y PQRSF (People BPO).
//
// Versión NATIVA del Apps Script: exporta a PDF la pestaña "Gestiones diarias"
// (rango A1:J21) del libro de Línea amiga (SHEET_ID_LINEA_AMIGA = "GESTIONES
// DIARIAS PEOPLE BPO") usando el token de la cuenta de servicio, y lo envía por
// correo (SMTP del proyecto) a los destinatarios. Se dispara por QStash a las
// 7 p. m. (hora Colombia); NO se envía los domingos.
// ============================================================

const NOMBRE_HOJA = "Gestiones diarias";
const RANGO_PDF = "A1:J21";
const CORREOS_POR_DEFECTO = ["vandusfor@gmail.com", "monica.hernandez@peoplebpo.com"];

function sheetId(): string {
  const id = process.env.SHEET_ID_LINEA_AMIGA;
  if (!id) throw new Error("Falta la variable SHEET_ID_LINEA_AMIGA");
  return id;
}

function destinatarios(): string[] {
  const env = (process.env.REPORTE_DIARIO_CORREOS ?? "").trim();
  const lista = env ? env.split(",").map((c) => c.trim()).filter((c) => c.includes("@")) : CORREOS_POR_DEFECTO;
  return lista.length ? lista : CORREOS_POR_DEFECTO;
}

// Fecha/día en Colombia (para el nombre, el asunto y saltar domingos).
function hoyColombia(): { fecha: string; diaSemana: number } {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(ahora);
  const y = partes.find((p) => p.type === "year")!.value;
  const m = partes.find((p) => p.type === "month")!.value;
  const d = partes.find((p) => p.type === "day")!.value;
  const wd = partes.find((p) => p.type === "weekday")!.value; // Sun, Mon, ...
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { fecha: `${d}/${m}/${y}`, diaSemana: dias.indexOf(wd) };
}

async function gidDeHoja(): Promise<number> {
  const meta = await getSpreadsheetMeta<{ sheets?: { properties?: { sheetId?: number; title?: string } }[] }>(
    sheetId(), "sheets.properties(sheetId,title)"
  );
  const hoja = meta.sheets?.find((s) => (s.properties?.title ?? "").trim().toLowerCase() === NOMBRE_HOJA.toLowerCase());
  const gid = hoja?.properties?.sheetId;
  if (gid === undefined) throw new Error(`No se encontró la pestaña "${NOMBRE_HOJA}" en el libro.`);
  return gid;
}

async function exportarPdf(gid: number): Promise<Buffer> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId()}/export?format=pdf` +
    `&gid=${gid}&portrait=true&size=A4&fitw=true&scale=2` +
    `&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25` +
    `&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false` +
    `&range=${encodeURIComponent(RANGO_PDF)}`;
  const token = await getGoogleAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`No se pudo exportar el PDF (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  // El export, si falla la auth, devuelve HTML en vez de PDF.
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("La exportación no devolvió un PDF (¿la cuenta de servicio tiene acceso al libro?).");
  }
  return buf;
}

function generarHTML(fechaTexto: string): string {
  return `
  <div style="font-family: Arial, sans-serif; background:#f5f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08);">
      <div style="background:#352D54; padding:16px 20px;">
        <h2 style="margin:0; color:#ffffff;">Reporte diario de radicaciones y PQRSF – People BPO</h2>
      </div>
      <div style="height:4px; background:#C1E12A;"></div>
      <div style="padding:20px; color:#2f2f2f; line-height:1.6;">
        <p>Hola <strong>Mónica Hernández</strong>,</p>
        <p>Te comparto el <strong>reporte diario de radicaciones y PQRSF del equipo</strong> correspondiente al día <strong>${fechaTexto}</strong>.</p>
        <p>En el archivo adjunto encontrarás el <strong>consolidado por asesora</strong> con el detalle de las gestiones realizadas durante la jornada.</p>
        <p>Cualquier observación o ajuste que requieras, quedo atento.</p>
        <p style="margin-top:24px;">Cordialmente,<br>
          <strong>Duván Ramos</strong><br>
          Coordinador de Formación y Calidad<br>
          People BPO</p>
      </div>
      <div style="background:#fafafa; padding:12px 20px; font-size:12px; color:#6b7280;">
        Envío automático desde Du Site (sistema de seguimiento operativo).
      </div>
    </div>
  </div>`;
}

export interface ResultadoReporte {
  enviado: boolean;
  motivo?: string;
  fecha: string;
  destinatarios: string[];
  bytesPdf?: number;
}

// Genera y envía el reporte. `dry` evalúa todo (incluido el PDF) sin enviar.
export async function enviarReporteDiario(dry = false): Promise<ResultadoReporte> {
  const { fecha, diaSemana } = hoyColombia();
  const dest = destinatarios();
  if (diaSemana === 0) {
    return { enviado: false, motivo: "Domingo: no se envía.", fecha, destinatarios: dest };
  }
  const gid = await gidDeHoja();
  const pdf = await exportarPdf(gid);
  if (dry) {
    return { enviado: false, motivo: "Dry-run: PDF generado, no se envió.", fecha, destinatarios: dest, bytesPdf: pdf.length };
  }
  await enviarCorreoConAdjunto(
    dest,
    `Reporte diario de radicaciones y PQRSF – People BPO (${fecha})`,
    generarHTML(fecha),
    { filename: `Reporte_Radicaciones_y_PQRSF_${fecha.replace(/\//g, "-")}.pdf`, content: pdf }
  );
  return { enviado: true, fecha, destinatarios: dest, bytesPdf: pdf.length };
}
