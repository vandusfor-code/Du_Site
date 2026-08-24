import "server-only";
import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "Faltan las variables SMTP_HOST, SMTP_PORT, SMTP_USER o SMTP_PASS para enviar correos"
    );
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
}

export async function enviarCorreoMasivo(
  destinatarios: string[],
  asunto: string,
  html: string
): Promise<void> {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await Promise.all(
    destinatarios.map((to) => transport.sendMail({ from, to, subject: asunto, html }))
  );
}

export interface ResultadoEnvioIndividual {
  // true solo si el SMTP confirmó aceptar ESE destinatario puntual (no basta
  // con que sendMail() no haya lanzado una excepción — un servidor puede
  // "aceptar la conexión" y aun así rechazar la dirección en `rejected`).
  aceptado: boolean;
  messageId: string | null;
  respuestaServidor: string | null;
}

// Mismo transporte que enviarCorreoMasivo() — no es un sistema de correo
// nuevo, es la variante de UN destinatario que sí expone lo necesario para
// confirmar aceptación real (ver SentMessageInfo en
// @types/nodemailer/lib/smtp-transport). enviarCorreoMasivo() no se toca.
export async function enviarCorreoIndividual(
  destinatario: string,
  asunto: string,
  html: string
): Promise<ResultadoEnvioIndividual> {
  const transport = getTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await transport.sendMail({ from, to: destinatario, subject: asunto, html });

  const objetivo = destinatario.trim().toLowerCase();
  const aceptado = info.accepted.some((a) => {
    const direccion = typeof a === "string" ? a : a.address;
    return direccion.trim().toLowerCase() === objetivo;
  });

  return {
    aceptado,
    messageId: info.messageId ?? null,
    respuestaServidor: info.response ?? null,
  };
}
