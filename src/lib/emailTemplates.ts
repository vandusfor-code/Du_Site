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
                  Se ha generado una nueva auditoría de calidad para ti.
                </p>

                <p style="font-size:15px; line-height:1.6;">
                  Te invitamos a ingresar a Du Academy para revisar la evaluación y registrar el compromiso correspondiente.
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
