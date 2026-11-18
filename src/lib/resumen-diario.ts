import "server-only";
import { readRange, parseSheetDate } from "@/lib/sheets";
import { getSupabase } from "@/lib/supabase";
import { obtenerConfigIA } from "@/lib/config-ia";
import { obtenerFuncionariosParaSelector } from "@/lib/auditorias-admin";
import { enviarCorreoIndividual, FROM_CALIDAD } from "@/lib/mailer";
import { correoDeEnvio } from "@/lib/notificacion-por-enviar";
import { enviarLoteAuditorias } from "@/lib/envio-auditorias";
import { registrarAcuse, registrarCompromisoCiclo } from "@/lib/acuse-compromiso-ciclo";

// ============================================================
// RESUMEN DIARIO DE AUDITORÍAS (una notificación por asesora/día).
// Junta TODAS las auditorías del día de cada asesora (desde Consolidado),
// la IA redacta un resumen (lo positivo + lo que debe mejorar), se guarda en
// Supabase (resumen_diario) y se envía UN solo correo con un enlace donde la
// asesora firma UNA vez + deja un compromiso general. Flujo independiente del
// ciclo_auditoria (no toca el escalamiento existente).
// ============================================================

// Columnas de Consolidado (ver guardarAuditoriaManual).
const COL = { fecha: 0, asesor: 2, correo: 5, idGestion: 6, nota: 16, tipoNota: 17, hallazgos: 19, mejora: 20 };

function sheetIdMetricas(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}
function appUrl(): string {
  const base = process.env.APP_URL;
  if (!base) throw new Error("Falta la variable APP_URL");
  return base.replace(/\/$/, "");
}
function txt(row: unknown[], i: number): string {
  const v = row?.[i];
  return v === null || v === undefined ? "" : String(v).trim();
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

interface AuditoriaDia { idGestion: string; nota: number; tipoNota: string; hallazgos: string; mejora: string; }
export interface ResumenAsesora {
  asesorCodigo: string; nombre: string; correo: string;
  numAuditorias: number; promedioNota: number; positivo: string; mejorar: string;
}

// Agrupa las auditorías de `fecha` (YYYY-MM-DD) por asesora.
async function auditoriasPorAsesora(fecha: string): Promise<Map<string, AuditoriaDia[]>> {
  const filas = await readRange(sheetIdMetricas(), "Consolidado!A:AA", { unformatted: true });
  const porAsesor = new Map<string, AuditoriaDia[]>();
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const d = parseSheetDate(f?.[COL.fecha]);
    if (!d || ymd(d) !== fecha) continue;
    const asesor = txt(f, COL.asesor);
    if (!asesor) continue;
    // Sheets guarda "100%" como fracción (1.0); leída sin formato vuelve 1, 0.33…
    // Si viene como fracción (0..1), se lleva a escala 0..100.
    let nraw = parseFloat(txt(f, COL.nota).replace("%", "").replace(",", ".")) || 0;
    if (nraw > 0 && nraw <= 1) nraw = nraw * 100;
    const nota = Math.round(nraw);
    const lista = porAsesor.get(asesor) ?? [];
    lista.push({ idGestion: txt(f, COL.idGestion), nota, tipoNota: txt(f, COL.tipoNota), hallazgos: txt(f, COL.hallazgos), mejora: txt(f, COL.mejora) });
    porAsesor.set(asesor, lista);
  }
  return porAsesor;
}

// La IA redacta el resumen consolidado (positivo + mejorar). Si no hay OpenAI
// configurado, cae a concatenar los hallazgos/mejoras de las auditorías.
async function sintetizar(nombre: string, audits: AuditoriaDia[]): Promise<{ positivo: string; mejorar: string }> {
  const fallback = () => ({
    positivo: audits.map((a) => a.hallazgos).filter(Boolean).join(" ").slice(0, 1200) || "Sin observaciones positivas registradas.",
    mejorar: audits.map((a) => a.mejora).filter(Boolean).join(" ").slice(0, 1200) || "Sin puntos de mejora registrados.",
  });
  const cfg = await obtenerConfigIA();
  if (cfg.motor !== "openai" || !cfg.openaiKey) return fallback();

  const insumo = audits
    .map((a, i) => `Auditoría ${i + 1} (${a.tipoNota}, ${a.nota}%):\n- Hallazgos: ${a.hallazgos || "N/A"}\n- Mejora: ${a.mejora || "N/A"}`)
    .join("\n\n");
  const prompt = `Eres Duván, Coordinador de Formación y Calidad de Cofrem en People BPO. Estas son las ${audits.length} auditoría(s) de HOY de la asesora ${nombre}. Redacta UN resumen consolidado para ella, hablándole en SEGUNDA persona ("mostraste", "manejaste"), en tono cercano, directo y humano. Devuelve ÚNICAMENTE un JSON válido con dos campos:
{
  "positivo": "Sus fortalezas reales del día, con detalles concretos tomados de las auditorías. 2 a 4 frases.",
  "mejorar": "Lo que debe mejorar, con acciones claras y accionables. 2 a 4 frases. Si todo salió muy bien, dilo con sinceridad."
}
REGLA CRÍTICA DEL TRATO: el agente SIEMPRE debe tratar de "usted". El TUTEO (tú/te/ti/tu/tuyo) NO es aceptable en NINGÚN caso. NUNCA, jamás, recomiendes tutear ni sugieras un "trato más cercano con tú" ni "generar cercanía con el tuteo". Si en los insumos aparece que hubo tuteo, es una FALTA a corregir: la mejora es mantener SIEMPRE el trato de usted.
Otras reglas: básate ÚNICAMENTE en los insumos (no inventes). Nunca uses la palabra "cliente", usa "usuario". No menciones distorsiones del nombre Cofrem como error.

INSUMOS:
${insumo}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.openaiKey}` },
      body: JSON.stringify({
        model: cfg.modelo, max_tokens: 700, temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback();
    const parsed = JSON.parse(content) as { positivo?: string; mejorar?: string };
    const fb = fallback();
    return {
      positivo: (parsed.positivo ?? "").trim() || fb.positivo,
      mejorar: (parsed.mejorar ?? "").trim() || fb.mejorar,
    };
  } catch {
    return fallback();
  }
}

// Genera (IA) y GUARDA en Supabase el resumen del día por asesora. Idempotente
// por (fecha, asesor): upsert. Devuelve los resúmenes listos para notificar.
export async function generarResumenesDelDia(fecha: string): Promise<ResumenAsesora[]> {
  const porAsesor = await auditoriasPorAsesora(fecha);
  if (porAsesor.size === 0) return [];

  const directorio = await obtenerFuncionariosParaSelector();
  const mapaDir = new Map(directorio.map((f) => [f.asesor.trim().toUpperCase(), f]));

  const supabase = getSupabase();
  const salida: ResumenAsesora[] = [];

  for (const [asesorCodigo, audits] of porAsesor) {
    const dir = mapaDir.get(asesorCodigo.trim().toUpperCase());
    const nombre = dir?.nombre?.trim() || asesorCodigo;
    const correo = dir?.correo?.trim() || "";
    const promedio = Math.round(audits.reduce((s, a) => s + a.nota, 0) / audits.length);
    const { positivo, mejorar } = await sintetizar(nombre, audits);

    await supabase.from("resumen_diario").upsert(
      {
        fecha, asesor_codigo: asesorCodigo, nombre, correo,
        num_auditorias: audits.length, promedio_nota: promedio, positivo, mejorar,
      },
      { onConflict: "fecha,asesor_codigo" }
    );
    salida.push({ asesorCodigo, nombre, correo, numAuditorias: audits.length, promedioNota: promedio, positivo, mejorar });
  }
  return salida;
}

function correoHtml(nombre: string, r: ResumenAsesora, url: string, fecha: string): string {
  return `
  <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.08);">
      <div style="background:#21175d;padding:18px 22px;"><h2 style="margin:0;color:#fff;font-size:18px;">Tu retroalimentación de calidad — ${fecha}</h2></div>
      <div style="height:4px;background:#C1E12A;"></div>
      <div style="padding:22px;color:#2f2f2f;line-height:1.6;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Este es el resumen de tus <strong>${r.numAuditorias} auditoría(s)</strong> de hoy (calidad promedio <strong>${r.promedioNota}%</strong>).</p>
        <div style="background:#eafaf1;border:1px solid #b7e6cd;border-radius:10px;padding:14px 16px;margin:14px 0;">
          <b style="color:#158a55;">✅ Lo positivo</b><p style="margin:6px 0 0;">${r.positivo}</p>
        </div>
        <div style="background:#fff7e6;border:1px solid #ffe2a8;border-radius:10px;padding:14px 16px;margin:14px 0;">
          <b style="color:#8a5a00;">🎯 Para mejorar</b><p style="margin:6px 0 0;">${r.mejorar}</p>
        </div>
        <p>Por favor <strong>acusa recibo con una sola firma</strong> y deja tu compromiso de mejora del día:</p>
        <p style="text-align:center;margin:22px 0;">
          <a href="${url}" style="background:#21175d;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-weight:bold;display:inline-block;">Ver y firmar mi retroalimentación</a>
        </p>
        <p style="margin-top:22px;">Con aprecio,<br><strong>Duván Ramos</strong><br>Coordinador de Formación y Calidad · People BPO</p>
      </div>
    </div>
  </div>`;
}

export interface ResultadoNotificacionResumen {
  asesorasNotificadas: number;
  sinCorreo: number;
  fallidas: number;
  detalle: { nombre: string; estado: string }[];
}

// Genera y ENVÍA un correo por asesora con su resumen del día. Marca enviado_en.
export async function notificarResumenesDelDia(fecha: string): Promise<ResultadoNotificacionResumen> {
  const resumenes = await generarResumenesDelDia(fecha);
  const url = `${appUrl()}/mi-retroalimentacion`;
  const supabase = getSupabase();
  const detalle: { nombre: string; estado: string }[] = [];
  let notificadas = 0, sinCorreo = 0, fallidas = 0;

  for (const r of resumenes) {
    if (!r.correo) { sinCorreo++; detalle.push({ nombre: r.nombre, estado: "Sin correo" }); continue; }
    // Idempotencia: si ya se notificó hoy, NO se reenvía (evita doble correo),
    // pero igual cuenta como notificada y el ciclo se marcará abajo.
    const { data: yaEnv } = await supabase.from("resumen_diario").select("enviado_en").eq("fecha", fecha).eq("asesor_codigo", r.asesorCodigo).maybeSingle();
    if (yaEnv?.enviado_en) { notificadas++; detalle.push({ nombre: r.nombre, estado: "Ya notificada (no se reenvió)" }); continue; }
    const { destino } = correoDeEnvio(r.correo);
    try {
      const envio = await enviarCorreoIndividual(destino, `Tu retroalimentación de calidad — ${fecha}`, correoHtml(r.nombre, r, url, fecha), FROM_CALIDAD);
      if (envio.aceptado) {
        notificadas++;
        detalle.push({ nombre: r.nombre, estado: "Notificada" });
        await supabase.from("resumen_diario").update({ enviado_en: new Date().toISOString() }).eq("fecha", fecha).eq("asesor_codigo", r.asesorCodigo);
      } else {
        fallidas++; detalle.push({ nombre: r.nombre, estado: "Falló el envío" });
      }
    } catch {
      fallidas++; detalle.push({ nombre: r.nombre, estado: "Falló el envío" });
    }
  }

  // CONEXIÓN con el módulo Calidad: crea/marca los ciclos del día como NOTIFICADA
  // (sin reenviar el correo de lote). Así el tablero de Calidad muestra los
  // pendientes de acuse y, si no firman a tiempo, el cron los escala a Coordinación.
  // Best-effort: si falla, la notificación por correo igual quedó hecha.
  try {
    await enviarLoteAuditorias(fecha, undefined, { soloMarcar: true });
  } catch (e) {
    console.error("[resumen-diario] marcar ciclos NOTIFICADA falló:", e instanceof Error ? e.message : e);
  }

  return { asesorasNotificadas: notificadas, sinCorreo, fallidas, detalle };
}

// PRUEBA: genera el resumen de UNA asesora (match por nombre o código) y lo
// envía a un correo indicado, para ver cómo llega. No marca enviado_en.
export async function enviarResumenPrueba(
  fecha: string, filtroAsesora: string, correoDestino: string
): Promise<{ ok: boolean; mensaje: string; asesora?: string }> {
  const porAsesor = await auditoriasPorAsesora(fecha);
  if (porAsesor.size === 0) return { ok: false, mensaje: `No hay auditorías registradas el ${fecha}.` };

  const directorio = await obtenerFuncionariosParaSelector();
  const mapaDir = new Map(directorio.map((f) => [f.asesor.trim().toUpperCase(), f]));
  const f = norm(filtroAsesora);

  for (const [asesorCodigo, audits] of porAsesor) {
    const dir = mapaDir.get(asesorCodigo.trim().toUpperCase());
    const nombre = dir?.nombre?.trim() || asesorCodigo;
    if (!(norm(nombre).includes(f) || norm(asesorCodigo).includes(f))) continue;

    const promedio = Math.round(audits.reduce((s, a) => s + a.nota, 0) / audits.length);
    const { positivo, mejorar } = await sintetizar(nombre, audits);
    const r: ResumenAsesora = { asesorCodigo, nombre, correo: correoDestino, numAuditorias: audits.length, promedioNota: promedio, positivo, mejorar };
    const html = correoHtml(nombre, r, `${appUrl()}/mi-retroalimentacion`, fecha);
    const envio = await enviarCorreoIndividual(correoDestino, `[PRUEBA] Tu retroalimentación de calidad — ${fecha}`, html, FROM_CALIDAD);
    return {
      ok: envio.aceptado,
      asesora: nombre,
      mensaje: envio.aceptado ? `Enviado a ${correoDestino} (resumen de ${nombre}, ${audits.length} auditoría(s)).` : `No se aceptó el envío: ${envio.respuestaServidor ?? ""}`,
    };
  }
  return { ok: false, mensaje: `No se encontró ninguna asesora que coincida con "${filtroAsesora}" con auditorías del ${fecha}.` };
}

// Pendiente de firma para el Home de la asesora: el resumen más reciente que ya
// fue NOTIFICADO (enviado_en) pero AÚN NO firmado. null si no hay nada que firmar.
export interface PendienteFirma { fecha: string; numAuditorias: number; }
export async function obtenerPendienteFirmaResumen(nombre: string): Promise<PendienteFirma | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("resumen_diario")
    .select("fecha, num_auditorias, nombre, enviado_en, firmado_en")
    .not("enviado_en", "is", null)
    .is("firmado_en", null)
    .order("fecha", { ascending: false })
    .limit(60);
  const match = (data ?? []).find((r) => norm(String(r.nombre)) === norm(nombre));
  if (!match) return null;
  return { fecha: String(match.fecha), numAuditorias: Number(match.num_auditorias ?? 0) };
}

// ── Lado de la asesora: ver y firmar ──
export interface ResumenParaFirma {
  fecha: string; nombre: string; numAuditorias: number; promedioNota: number;
  positivo: string; mejorar: string; firmado: boolean; compromiso: string; firmadoEn: string | null;
}

// Busca el resumen de la asesora por NOMBRE (de su sesión) para una fecha. Si no
// se pasa fecha, toma el más reciente.
export async function obtenerResumenParaFirma(nombre: string, fecha?: string): Promise<ResumenParaFirma | null> {
  const supabase = getSupabase();
  let q = supabase.from("resumen_diario").select("*").ilike("nombre", (nombre ?? "").trim());
  if (fecha) q = q.eq("fecha", fecha);
  const { data, error } = await q.order("fecha", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) {
    // Fallback: cruce tolerante por nombre normalizado.
    const { data: todos } = await supabase.from("resumen_diario").select("*").order("fecha", { ascending: false }).limit(300);
    const match = (todos ?? []).find((r) => norm(String(r.nombre)) === norm(nombre) && (!fecha || r.fecha === fecha));
    if (!match) return null;
    return mapFila(match);
  }
  return mapFila(data[0]);
}

function mapFila(r: Record<string, unknown>): ResumenParaFirma {
  return {
    fecha: String(r.fecha), nombre: String(r.nombre),
    numAuditorias: Number(r.num_auditorias ?? 0), promedioNota: Number(r.promedio_nota ?? 0),
    positivo: String(r.positivo ?? ""), mejorar: String(r.mejorar ?? ""),
    firmado: !!r.firmado_en, compromiso: String(r.compromiso ?? ""), firmadoEn: r.firmado_en ? String(r.firmado_en) : null,
  };
}

// Firma única: marca firmado_en + guarda el compromiso general. Cubre TODAS las
// auditorías de la asesora de ese día.
export async function firmarResumenDiario(nombre: string, fecha: string, compromiso: string): Promise<{ ok: boolean; error?: string }> {
  const comp = (compromiso ?? "").trim();
  if (!comp) return { ok: false, error: "Escribe tu compromiso de mejora antes de firmar." };
  const supabase = getSupabase();
  // Resuelve la fila exacta por nombre tolerante + fecha.
  const { data: todos } = await supabase.from("resumen_diario").select("id, nombre, fecha, asesor_codigo, firmado_en").eq("fecha", fecha);
  const fila = (todos ?? []).find((r) => norm(String(r.nombre)) === norm(nombre));
  if (!fila) return { ok: false, error: "No se encontró tu resumen del día." };
  if (fila.firmado_en) return { ok: true }; // ya firmado (idempotente)
  const { error } = await supabase.from("resumen_diario").update({ firmado_en: new Date().toISOString(), compromiso: comp }).eq("id", fila.id);
  if (error) return { ok: false, error: error.message };

  // CONEXIÓN con el módulo Calidad: una sola firma ACUSA todas sus auditorías del
  // día; en las que requieren compromiso (PENC) registra el MISMO compromiso.
  // Best-effort por auditoría: no bloquea la firma del resumen.
  const codigo = String(fila.asesor_codigo ?? "").trim();
  if (codigo) {
    try {
      const porAsesor = await auditoriasPorAsesora(fecha);
      const audits = porAsesor.get(codigo) ?? [];
      for (const a of audits) {
        if (!a.idGestion) continue;
        try {
          const res = await registrarAcuse(a.idGestion, codigo);
          if (res.estado === "COMPROMISO_PENDIENTE") {
            await registrarCompromisoCiclo(a.idGestion, codigo, comp);
          }
        } catch (e) {
          console.error("[resumen-diario] acuse/compromiso ciclo falló:", a.idGestion, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.error("[resumen-diario] acuse en bloque falló:", e instanceof Error ? e.message : e);
    }
  }

  return { ok: true };
}
