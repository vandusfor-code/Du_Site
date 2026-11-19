import "server-only";
import { obtenerSeguimientoResumen } from "@/lib/seguimiento-resumen";
import { enviarCorreoIndividual, FROM_CALIDAD } from "@/lib/mailer";
import { getSupabase } from "@/lib/supabase";

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
  ids: string[];           // ids de resumen_diario incluidos (para marcar escalado)
}

// Agrupa por asesora las retroalimentaciones NOTIFICADAS sin firmar. `soloVencidas`
// limita a las que superaron el plazo (2 días hábiles). `soloNoEscaladas` excluye
// las que ya se escalaron a Mónica (para no re-escalar).
export async function obtenerAsesorasEscaladas(soloVencidas: boolean, soloNoEscaladas = false): Promise<AsesoraEscalada[]> {
  const { filas } = await obtenerSeguimientoResumen({});
  const pend = filas.filter((f) =>
    f.estado === "NOTIFICADA" && (!soloVencidas || f.vencida) && (!soloNoEscaladas || !f.escaladoEn)
  );
  const porAsesora = new Map<string, AsesoraEscalada>();
  for (const f of pend) {
    const prev = porAsesora.get(f.asesorCodigo) ?? { nombre: f.nombre, asesorCodigo: f.asesorCodigo, diasSinFirmar: 0, auditoriasPendientes: 0, diasPendientes: 0, ids: [] };
    prev.diasSinFirmar = Math.max(prev.diasSinFirmar, f.diasSinFirmar ?? 0);
    prev.auditoriasPendientes += f.numAuditorias;
    prev.diasPendientes += 1;
    prev.ids.push(f.id);
    porAsesora.set(f.asesorCodigo, prev);
  }
  return Array.from(porAsesora.values()).sort((a, b) => b.diasSinFirmar - a.diasSinFirmar);
}

export function construirCorreoEscalamiento(nombreDest: string, asesoras: AsesoraEscalada[], urlPanel: string): string {
  const totalAsesoras = asesoras.length;
  const totalCompromisos = asesoras.reduce((s, a) => s + a.diasPendientes, 0);
  const hoy = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" });

  const filas = asesoras.map((a, i) => `
    <tr style="background:${i % 2 ? "#faf9ff" : "#ffffff"};">
      <td style="padding:12px 16px;font-weight:700;color:#21175d;border-bottom:1px solid #eef0f6;">${a.nombre}</td>
      <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #eef0f6;">
        <span style="display:inline-block;background:${a.diasSinFirmar >= 2 ? "#fff1f2" : "#fffbeb"};color:${a.diasSinFirmar >= 2 ? "#be123c" : "#b45309"};padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px;">${a.diasSinFirmar} día${a.diasSinFirmar === 1 ? "" : "s"}</span>
      </td>
      <td style="padding:12px 16px;text-align:center;color:#2f2f2f;border-bottom:1px solid #eef0f6;">${a.diasPendientes}</td>
    </tr>`).join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f8;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 26px rgba(24,30,55,0.10);">
      <div style="background:linear-gradient(135deg,#21175d,#3f2d9c);padding:22px 26px;">
        <h2 style="margin:0;color:#ffffff;font-size:19px;">Firmas de calidad pendientes</h2>
        <p style="margin:6px 0 0;color:#c9c2f5;font-size:13px;">Seguimiento de retroalimentaciones sin firmar · ${hoy}</p>
      </div>
      <div style="height:4px;background:#C1E12A;"></div>
      <div style="padding:24px 26px;color:#2f2f2f;line-height:1.6;">
        <p style="margin:0 0 14px;">Hola <strong>${nombreDest}</strong>,</p>
        <p style="margin:0 0 18px;">Te comparto el estado de las <strong>retroalimentaciones de calidad</strong> que aún no han sido firmadas por las asesoras. Es un reporte informativo para su seguimiento.</p>

        <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:12px 0;margin:0 0 20px;">
          <tr>
            <td width="50%" style="background:#f1ecff;border-radius:14px;padding:18px 14px;text-align:center;">
              <div style="font-size:32px;font-weight:800;color:#5b2eff;line-height:1;">${totalAsesoras}</div>
              <div style="font-size:12.5px;color:#6b6a85;margin-top:6px;">Asesoras sin firmar</div>
            </td>
            <td width="50%" style="background:#f1ecff;border-radius:14px;padding:18px 14px;text-align:center;">
              <div style="font-size:32px;font-weight:800;color:#5b2eff;line-height:1;">${totalCompromisos}</div>
              <div style="font-size:12.5px;color:#6b6a85;margin-top:6px;">Compromisos sin firmar</div>
            </td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f6;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f1ecff;">
              <th style="padding:11px 16px;text-align:left;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Asesora</th>
              <th style="padding:11px 16px;text-align:center;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Días sin firmar</th>
              <th style="padding:11px 16px;text-align:center;font-size:12px;color:#5c34d1;text-transform:uppercase;letter-spacing:.4px;">Compromisos</th>
            </tr>
          </thead>
          <tbody>${filas || `<tr><td colspan="3" style="padding:18px;text-align:center;color:#8a93a8;">No hay firmas pendientes. ¡Todo al día!</td></tr>`}</tbody>
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
// `marcar` = escalamiento REAL: solo vencidas NO escaladas aún, y al enviar marca
// escalado_en en resumen_diario (para que el tablero muestre "Escalada a Mónica"
// y no se re-escale).
export async function enviarEscalamientoResumen(
  opts: { soloVencidas: boolean; correoOverride?: string; marcar?: boolean }
): Promise<{ ok: boolean; asesoras: number; destino: string; mensaje: string }> {
  const marcar = opts.marcar === true;
  const asesoras = await obtenerAsesorasEscaladas(opts.soloVencidas, marcar);
  const destino = (opts.correoOverride ?? DESTINATARIO_ESCALAMIENTO).trim();

  // En el escalamiento real, si no hay vencidas nuevas, NO se envía nada a Mónica.
  if (marcar && asesoras.length === 0) {
    return { ok: true, asesoras: 0, destino, mensaje: "Sin firmas vencidas nuevas para escalar." };
  }

  const html = construirCorreoEscalamiento(NOMBRE_DESTINATARIO, asesoras, `${appUrl()}/modulos/calidad`);
  const asunto = `Firmas de calidad pendientes — ${asesoras.length} asesora(s)`;
  const envio = await enviarCorreoIndividual(destino, asunto, html, FROM_CALIDAD);

  if (marcar && envio.aceptado) {
    const ids = asesoras.flatMap((a) => a.ids);
    if (ids.length) {
      try {
        await getSupabase().from("resumen_diario").update({ escalado_en: new Date().toISOString() }).in("id", ids);
      } catch (e) {
        console.error("[escalamiento-resumen] marcar escalado_en:", e instanceof Error ? e.message : e);
      }
    }
  }
  return {
    ok: envio.aceptado, asesoras: asesoras.length, destino,
    mensaje: envio.aceptado ? `Enviado a ${destino} (${asesoras.length} asesora(s))` : `No se aceptó: ${envio.respuestaServidor ?? ""}`,
  };
}
