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
  const hoy = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" });

  const filas = asesoras.map((a) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eef0f6;color:#1f2430;">${a.nombre}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eef0f6;text-align:center;font-weight:700;color:${a.diasSinFirmar >= 2 ? "#c0143c" : "#b45309"};">${a.diasSinFirmar}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eef0f6;text-align:center;color:#1f2430;">${a.auditoriasPendientes}</td>
    </tr>`).join("");

  // Compacto a propósito: cabe en una sola captura. Sin gradientes, sin iconos,
  // sin relleno de más. Tabla densa con totales en una línea.
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1f2430;padding:14px;">
    <div style="border-left:4px solid #21175d;padding-left:10px;margin-bottom:10px;">
      <div style="font-size:16px;font-weight:800;color:#21175d;">Firmas de calidad pendientes</div>
      <div style="font-size:12px;color:#6b7280;">Retroalimentaciones sin firmar · ${hoy}</div>
    </div>
    <p style="margin:0 0 10px;font-size:13px;">Hola ${nombreDest}, estas asesoras aún no han firmado su retroalimentación:</p>
    <div style="font-size:13px;margin:0 0 8px;">
      <b style="color:#21175d;">${totalAsesoras}</b> asesora(s) sin firmar · <b style="color:#c2410c;">${totalAuditorias}</b> auditoría(s) pendiente(s)
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f1ecff;">
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:#5c34d1;letter-spacing:.3px;">ASESORA</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#5c34d1;letter-spacing:.3px;">DÍAS</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#5c34d1;letter-spacing:.3px;">AUDIT. PEND.</th>
        </tr>
      </thead>
      <tbody>${filas || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#8a93a8;">No hay firmas pendientes.</td></tr>`}</tbody>
    </table>
    <div style="font-size:11px;color:#9ca3af;margin-top:10px;">
      <a href="${urlPanel}" style="color:#5c34d1;text-decoration:none;">Ver seguimiento</a> · Du Site · Calidad · People BPO
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
