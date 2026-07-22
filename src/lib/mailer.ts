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
