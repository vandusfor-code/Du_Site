import "server-only";
import { obtenerSeguimientoResumen } from "@/lib/seguimiento-resumen";
import { enviarCorreoIndividual, FROM_CALIDAD } from "@/lib/mailer";

// ============================================================
// Escalamiento CONSOLIDADO a Coordinación (Mónica): UN correo informativo con el
// listado de asesoras que NO han firmado su retroalimentación, los días sin
// firmar y cuántas auditorías/compromisos quedan pendientes. Agrupado por
// asesora (no auditoría por auditoría).
// ============================================================

export const DESTINATARIO_ESCALAMIENTO = "monica.hernandez@peoplebpo.com";
const NOMBRE_DESTINATARIO = "Mónica";

export interface AsesoraEscalada {
  nombre: string;
  asesorCodigo: string;
  diasSinFirmar: number;   // máximo de sus días sin firmar
  auditoriasPendientes: number;
  diasPendientes: number;  // cuántos días/resúmenes sin firmar
}

// Agrupa por asesora las retroalimentaciones NOTIFICADAS sin firmar. Si
// `soloVencidas`, solo las que superaron el plazo (2 días hábiles).
export async function obtenerAsesorasEscaladas(soloVencidas: boolean): Promise<AsesoraEscalada[]> {
  const { filas } = await obtenerSeguimientoResumen({});
  const pend = filas.filter((f) => f.estado === "NOTIFICADA" && (!soloVencidas || f.vencida));
  const porAsesora = new Map<string, AsesoraEscalada>();
  for (const f of pend) {
    const prev = porAsesora.get(f.asesorCodigo) ?? { nombre: f.nombre, asesorCodigo: f.asesorCodigo, diasSinFirmar: 0, auditoriasPendientes: 0, diasPendientes: 0 };
    prev.diasSinFirmar = Math.max(prev.diasSinFirmar, f.diasSinFirmar ?? 0);
    prev.auditoriasPendientes += f.numAuditorias;
    prev.diasPendientes += 1;
    porAsesora.set(f.asesorCodigo, prev);
  }
  return Array.from(porAsesora.values()).sort((a, b) => b.diasSinFirmar - a.diasSinFirmar);
}

export function construirCorreoEscalamiento(nombreDest: string, asesoras: AsesoraEscalada[], urlPanel: string): string {
  const totalAsesoras = asesoras.length;
  const totalAuditorias = asesoras.reduce((s, a) => s + a.auditoriasPendientes, 0);

  const filas = asesoras.map((a, i) => `
    <tr style="background:${i % 2 ? "#faf9ff" : "#ffffff"};">
      <td style="padding:12px 16px;font-weight:700;color:#21175d;border-bottom:1px solid #eef0f6;">${a.nombre}</td>
      <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #eef0f6;">
        <span style="display:inline-block;background:${a.diasSinFirmar >= 2 ? "#fff1f2" : "#fffbeb"};color:${a.diasSinFirmar >= 2 ? "#be123c" : "#b45309"};padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px;">${a.diasSinFirmar} día${a.diasSinFirmar === 1 ? "" : "s"}</span>
      </td>
      <td style="padding:12px 16px;text-align:center;color:#2f2f2f;border-bottom:1px solid #eef0f6;">${a.auditoriasPendientes}</td>
    </tr>`).join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f8;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 26px rgba(24,30,55,0.10);">
      <div style="background:linear-gradient(135deg,#21175d,#3f2d9c);padding:22px 26px;">
        <h2 style="margin:0;color:#ffffff;font-size:19px;">Firmas de calidad pendientes</h2>
        <p style="margin:6px 0 0;color:#c9c2f5;font-size:13px;">Seguimiento de retroalimentaciones sin firmar</p>
      </div>
      <div style="height:4px;background:#C1E12A;"></div>
      <div style="padding:24px 26px;color:#2f2f2f;line-height:1.6;">
        <p style="margin:0 0 14px;">Hola <strong>${nombreDest}</strong>,</p>
        <p style="margin:0 0 18px;">Te comparto el estado de las <strong>retroalimentaciones de calidad</strong> que aún no han sido firmadas por las asesoras. Es un reporte informativo para su seguimiento.</p>

        <div style="display:flex;gap:12px;margin:0 0 20px;">
          <div style="flex:1;background:#f5f3ff;border:1px solid #e3dcff;border-radius:12px;padding:14px 16px;">
            <div style="font-size:28px;font-weight:800;color:#5b2eff;line-height:1;">${totalAsesoras}</div>
            <div style="font-size:12px;color:#6b6a85;margin-top:4px;">Asesoras sin firmar</div>
          </div>
          <div style="flex:1;background:#fff7ed;border:1px solid #fde4c8;border-radius:12px;padding:14px 16px;">
            <div style="font-size:28px;font-weight:800;color:#c2410c;line-height:1;">${totalAuditorias}</div>
            <div style="font-size:12px;color:#6b6a85;margin-top:4px;">Auditorías pendientes</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f6;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f1ecff;">
              <th style="padding:11px 16px;text-align:left;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Asesora</th>
              <th style="padding:11px 16px;text-align:center;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Días sin firmar</th>
              <th style="padding:11px 16px;text-align:center;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Auditorías pend.</th>
            </tr>
          </thead>
          <tbody>${filas || `<tr><td colspan="3" style="padding:18px;text-align:center;color:#8a93a8;">No hay firmas pendientes. ¡Todo al día! 🎉</td></tr>`}</tbody>
        </table>

        <p style="text-align:center;margin:22px 0 6px;">
          <a href="${urlPanel}" style="background:#21175d;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:bold;display:inline-block;font-size:14px;">Ver el seguimiento completo</a>
        </p>
        <p style="margin:22px 0 0;font-size:13px;color:#6b7280;">Cordialmente,<br><strong>Du Site</strong> · Sistema de seguimiento de Calidad · People BPO</p>
      </div>
    </div>
  </div>`;
}

function appUrl(): string {
  return (process.env.APP_URL ?? "https://www.duacademy.site").replace(/\/$/, "");
}

// Envía el correo consolidado. `correoOverride` es para pruebas (ej. tu correo).
export async function enviarEscalamientoResumen(
  opts: { soloVencidas: boolean; correoOverride?: string }
): Promise<{ ok: boolean; asesoras: number; destino: string; mensaje: string }> {
  const asesoras = await obtenerAsesorasEscaladas(opts.soloVencidas);
  const destino = (opts.correoOverride ?? DESTINATARIO_ESCALAMIENTO).trim();
  const html = construirCorreoEscalamiento(NOMBRE_DESTINATARIO, asesoras, `${appUrl()}/modulos/calidad`);
  const asunto = `Firmas de calidad pendientes — ${asesoras.length} asesora(s)`;
  const envio = await enviarCorreoIndividual(destino, asunto, html, FROM_CALIDAD);
  return {
    ok: envio.aceptado, asesoras: asesoras.length, destino,
    mensaje: envio.aceptado ? `Enviado a ${destino} (${asesoras.length} asesora(s))` : `No se aceptó: ${envio.respuestaServidor ?? ""}`,
  };
}
