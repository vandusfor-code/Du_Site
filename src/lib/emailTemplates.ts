export function correoRecordatorioModulos(): string {
  const url = process.env.APP_URL ? `${process.env.APP_URL}/modulos/quiz` : "https://TU-DOMINIO.com/modulos/quiz";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#eef2f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
      <tr>
        <td align="center">

          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td style="background:#3f3a64; padding:25px; text-align:center; color:#ffffff;">
                <h2 style="margin:0;">Du AcademyPro</h2>
              </td>
            </tr>

            <tr>
              <td style="background:#b7d80a; height:6px;"></td>
            </tr>

            <tr>
              <td style="padding:30px; color:#2d2d2d;">

                <p style="font-size:16px;">
                  Hola equipo,
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Les recordamos que cuentan con módulos de formación pendientes por realizar en la plataforma.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Es importante avanzar en estos contenidos para mantener su proceso actualizado dentro de la operación.
                </p>

                <div style="text-align:center; margin:35px 0;">
                  <a href="${url}" target="_blank"
                    style="
                      background:#3f3a64;
                      color:#ffffff;
                      padding:14px 32px;
                      border-radius:8px;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      display:inline-block;
                      box-shadow:0 4px 12px rgba(63,58,100,0.3);
                    ">
                    Ingresar a AcademyPro
                  </a>
                </div>

                <p style="font-size:14px; color:#666;">
                  Si ya completaron sus módulos, pueden omitir este mensaje.
                </p>

                <p style="margin-top:30px; font-size:14px;">
                  Cordialmente,<br><br>
                  <strong>Duván Ramos</strong><br>
                  Coordinador de Formación y Calidad<br>
                  People BPO
                </p>

              </td>
            </tr>

            <tr>
              <td style="background:#f5f5f5; padding:12px; text-align:center; font-size:12px; color:#777;">
                Notificación automática · Du AcademyPro
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`;
}

// nombreAsesor: nombre real si se pudo resolver (Usuarios), o el código de
// asesor como respaldo — nunca se inventa un nombre. url: enlace directo a
// la auditoría específica (ver construirUrlAuditoria() en
// notificacion-por-enviar.ts). A propósito NO incluye nota, PENC, criterios,
// hallazgos ni puntos de mejora — el correo anuncia la existencia de la
// auditoría, no expone su resultado.
export function correoNuevaAuditoria(nombreAsesor: string, url: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#eef2f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
      <tr>
        <td align="center">

          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td style="background:#3f3a64; padding:25px; text-align:center; color:#ffffff;">
                <h2 style="margin:0;">Du Academy</h2>
              </td>
            </tr>

            <tr>
              <td style="background:#b7d80a; height:6px;"></td>
            </tr>

            <tr>
              <td style="padding:30px; color:#2d2d2d;">

                <p style="font-size:16px;">
                  Hola, ${nombreAsesor}.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Se ha generado una nueva auditoría de calidad correspondiente a una de tus gestiones.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  La evaluación ya se encuentra disponible en Du Academy y requiere tu revisión.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Ingresa para consultar los resultados, revisar las observaciones de Calidad y, cuando corresponda, registrar tu compromiso de mejora.
                </p>

                <div style="text-align:center; margin:35px 0;">
                  <a href="${url}" target="_blank"
                    style="
                      background:#3f3a64;
                      color:#ffffff;
                      padding:14px 32px;
                      border-radius:8px;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      display:inline-block;
                      box-shadow:0 4px 12px rgba(63,58,100,0.3);
                    ">
                    REVISAR AUDITORÍA
                  </a>
                </div>

                <p style="margin-top:30px; font-size:14px;">
                  Formación y Calidad
                </p>

              </td>
            </tr>

            <tr>
              <td style="background:#f5f5f5; padding:12px; text-align:center; font-size:12px; color:#777;">
                Notificación automática · Du Academy
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`;
}

// diaHabil 1: falta 1 día hábil para el vencimiento (aviso temprano).
// diaHabil 2: es el día del vencimiento (último aviso). Mismo estilo visual
// que correoNuevaAuditoria — solo cambia el mensaje y el color de la franja
// (naranja en el día 2, para diferenciar visualmente la urgencia).
export function correoRecordatorioAcuse(nombreAsesor: string, url: string, diaHabil: 1 | 2): string {
  const esUltimoDia = diaHabil === 2;
  const mensajePrincipal = esUltimoDia
    ? "Hoy es el último día hábil para acusar recibo de tu auditoría de calidad."
    : "Todavía no has acusado recibo de tu auditoría de calidad.";
  const mensajeSecundario = esUltimoDia
    ? "Si no acusas hoy, tu auditoría quedará marcada como vencida sin acuse."
    : "Ingresa a Du Academy para revisarla y confirmar que la recibiste.";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#eef2f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
      <tr>
        <td align="center">

          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td style="background:#3f3a64; padding:25px; text-align:center; color:#ffffff;">
                <h2 style="margin:0;">Du Academy</h2>
              </td>
            </tr>

            <tr>
              <td style="background:${esUltimoDia ? "#e08a1e" : "#b7d80a"}; height:6px;"></td>
            </tr>

            <tr>
              <td style="padding:30px; color:#2d2d2d;">

                <p style="font-size:16px;">
                  Hola, ${nombreAsesor}.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  ${mensajePrincipal}
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  ${mensajeSecundario}
                </p>

                <div style="text-align:center; margin:35px 0;">
                  <a href="${url}" target="_blank"
                    style="
                      background:#3f3a64;
                      color:#ffffff;
                      padding:14px 32px;
                      border-radius:8px;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      display:inline-block;
                      box-shadow:0 4px 12px rgba(63,58,100,0.3);
                    ">
                    ACUSAR RECIBO
                  </a>
                </div>

                <p style="margin-top:30px; font-size:14px;">
                  Formación y Calidad
                </p>

              </td>
            </tr>

            <tr>
              <td style="background:#f5f5f5; padding:12px; text-align:center; font-size:12px; color:#777;">
                Notificación automática · Du Academy
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`;
}

// Mismo criterio de diaHabil que correoRecordatorioAcuse(). Se envía solo
// a asesoras con estado COMPROMISO_PENDIENTE (ya acusaron, aún no
// registran su compromiso de mejora).
export function correoRecordatorioCompromiso(nombreAsesor: string, url: string, diaHabil: 1 | 2): string {
  const esUltimoDia = diaHabil === 2;
  const mensajePrincipal = esUltimoDia
    ? "Hoy es el último día hábil para registrar tu compromiso de mejora."
    : "Todavía no has registrado tu compromiso de mejora sobre tu auditoría de calidad.";
  const mensajeSecundario = esUltimoDia
    ? "Si no lo registras hoy, tu auditoría quedará marcada como vencida sin compromiso."
    : "Ingresa a Du Academy para registrarlo.";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#eef2f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
      <tr>
        <td align="center">

          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td style="background:#3f3a64; padding:25px; text-align:center; color:#ffffff;">
                <h2 style="margin:0;">Du Academy</h2>
              </td>
            </tr>

            <tr>
              <td style="background:${esUltimoDia ? "#e08a1e" : "#b7d80a"}; height:6px;"></td>
            </tr>

            <tr>
              <td style="padding:30px; color:#2d2d2d;">

                <p style="font-size:16px;">
                  Hola, ${nombreAsesor}.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  ${mensajePrincipal}
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  ${mensajeSecundario}
                </p>

                <div style="text-align:center; margin:35px 0;">
                  <a href="${url}" target="_blank"
                    style="
                      background:#3f3a64;
                      color:#ffffff;
                      padding:14px 32px;
                      border-radius:8px;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      display:inline-block;
                      box-shadow:0 4px 12px rgba(63,58,100,0.3);
                    ">
                    REGISTRAR COMPROMISO
                  </a>
                </div>

                <p style="margin-top:30px; font-size:14px;">
                  Formación y Calidad
                </p>

              </td>
            </tr>

            <tr>
              <td style="background:#f5f5f5; padding:12px; text-align:center; font-size:12px; color:#777;">
                Notificación automática · Du Academy
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`;
}

export type MotivoEscalamientoCalidad = "SIN_ACUSE" | "SIN_COMPROMISO" | "COMPROMISO_VENCIDO";

const ETIQUETA_MOTIVO_ESCALAMIENTO: Record<MotivoEscalamientoCalidad, string> = {
  SIN_ACUSE: "Sin acuse (vencido)",
  SIN_COMPROMISO: "Sin compromiso registrado (vencido)",
  COMPROMISO_VENCIDO: "Compromiso vencido",
};

// Correo CONSOLIDADO — un solo envío agrupando todos los ciclos vencidos de
// las tres rutas, nunca un correo por auditoría. url: enlace directo al
// panel de Calidad (no a una auditoría puntual, porque el correo cubre
// varias). asesora: nombre real ya resuelto por quien llama (misma función
// de identidad de Fase 1, resolverNombreAsesor) — nunca se inventa aquí.
export function correoEscalamientoCalidad(
  destinatarioNombre: string,
  casos: { idGestion: string; asesora: string; motivo: MotivoEscalamientoCalidad }[],
  url: string
): string {
  const filas = casos
    .map(
      (c) => `
                  <tr>
                    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:13px; color:#2d2d2d;">${c.asesora}</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:12px; font-family:monospace; color:#666;">${c.idGestion.slice(0, 8)}…</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:13px; color:#2d2d2d;">${ETIQUETA_MOTIVO_ESCALAMIENTO[c.motivo]}</td>
                  </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#eef2f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;">
      <tr>
        <td align="center">

          <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">

            <tr>
              <td style="background:#3f3a64; padding:25px; text-align:center; color:#ffffff;">
                <h2 style="margin:0;">Du Academy — Escalamiento de Calidad</h2>
              </td>
            </tr>

            <tr>
              <td style="background:#d9364f; height:6px;"></td>
            </tr>

            <tr>
              <td style="padding:30px; color:#2d2d2d;">

                <p style="font-size:16px;">
                  Hola, ${destinatarioNombre}.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Estas son las auditorías con plazos vencidos que requieren tu seguimiento (${casos.length} en total):
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0; border:1px solid #eee; border-radius:8px; overflow:hidden;">
                  <tr style="background:#f5f5f5;">
                    <td style="padding:10px 12px; font-size:11px; font-weight:bold; color:#555; text-transform:uppercase;">Asesora</td>
                    <td style="padding:10px 12px; font-size:11px; font-weight:bold; color:#555; text-transform:uppercase;">ID Gestión</td>
                    <td style="padding:10px 12px; font-size:11px; font-weight:bold; color:#555; text-transform:uppercase;">Motivo</td>
                  </tr>
                  ${filas}
                </table>

                <div style="text-align:center; margin:35px 0;">
                  <a href="${url}" target="_blank"
                    style="
                      background:#3f3a64;
                      color:#ffffff;
                      padding:14px 32px;
                      border-radius:8px;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      display:inline-block;
                      box-shadow:0 4px 12px rgba(63,58,100,0.3);
                    ">
                    IR A CALIDAD
                  </a>
                </div>

                <p style="margin-top:30px; font-size:14px;">
                  Formación y Calidad
                </p>

              </td>
            </tr>

            <tr>
              <td style="background:#f5f5f5; padding:12px; text-align:center; font-size:12px; color:#777;">
                Notificación automática · Du Academy
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`;
}
