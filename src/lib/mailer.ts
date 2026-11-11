import "server-only";

// ============================================================
// Envío de correo vía RESEND (API HTTP, puerto 443). Reemplaza el SMTP: Render
// (plan free) bloquea toda salida SMTP (25/465/587 → "connect ENETUNREACH" /
// "Connection timeout"). Resend sí funciona porque va por HTTPS.
//   RESEND_API_KEY  → clave de la API (secreta, en Render).
//   RESEND_FROM     → remitente, p. ej. "Du Site <reportes@duacademy.site>"
//                     (el dominio debe estar verificado en Resend).
// ============================================================

const RESEND_API = "https://api.resend.com/emails";

function remitente(): string {
  return process.env.RESEND_FROM || "Du Site <onboarding@resend.dev>";
}

function apiKey(): string {
  const k = process.env.RESEND_API_KEY;
  if (!k) throw new Error("Falta la variable RESEND_API_KEY para enviar correos");
  return k;
}

interface Adjunto {
  filename: string;
  content: Buffer;
  contentType?: string;
}

// Hace UN envío por la API de Resend. Devuelve el id (éxito) o el error.
async function enviarResend(
  to: string[],
  subject: string,
  html: string,
  adjuntos?: Adjunto[]
): Promise<{ id: string | null; error: string | null }> {
  const body: Record<string, unknown> = { from: remitente(), to, subject, html };
  if (adjuntos && adjuntos.length) {
    body.attachments = adjuntos.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  let res: Response;
  try {
    res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : "No se pudo conectar con Resend" };
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { id: null, error: data.message || `Resend respondió HTTP ${res.status}` };
  }
  return { id: data.id ?? null, error: null };
}

export async function enviarCorreoMasivo(
  destinatarios: string[],
  asunto: string,
  html: string
): Promise<void> {
  // Un envío por destinatario (no se revela la lista entre ellos).
  for (const to of destinatarios) {
    const r = await enviarResend([to], asunto, html);
    if (r.error) throw new Error(r.error);
  }
}

// Envía un correo (a uno o varios destinatarios en el mismo mensaje) con un
// archivo adjunto. Usado por el reporte diario (PDF de gestiones).
export async function enviarCorreoConAdjunto(
  destinatarios: string[],
  asunto: string,
  html: string,
  adjunto: { filename: string; content: Buffer; contentType?: string }
): Promise<void> {
  const r = await enviarResend(destinatarios, asunto, html, [adjunto]);
  if (r.error) throw new Error(r.error);
}

export interface ResultadoEnvioIndividual {
  aceptado: boolean;
  messageId: string | null;
  respuestaServidor: string | null;
}

// Variante de UN destinatario que confirma la aceptación (Resend devuelve un id
// cuando aceptó el envío).
export async function enviarCorreoIndividual(
  destinatario: string,
  asunto: string,
  html: string
): Promise<ResultadoEnvioIndividual> {
  const r = await enviarResend([destinatario], asunto, html);
  return {
    aceptado: !r.error && !!r.id,
    messageId: r.id,
    respuestaServidor: r.error,
  };
}
