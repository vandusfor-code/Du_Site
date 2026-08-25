import "server-only";
import { getSupabase } from "./supabase";
import { enviarCorreoIndividual } from "./mailer";
import { correoEscalamientoCalidad, type MotivoEscalamientoCalidad } from "./emailTemplates";
import { resolverNombreAsesor, correoDeEnvio } from "./notificacion-por-enviar";
import { idsVencidosSinAcuse, idsVencidosSinCompromiso, idsCompromisoVencido } from "./gestion-calidad";

// ============================================================
// MÓDULO CALIDAD — Escalamiento a Coordinación (roadmap post-Recordatorios)
//
// Reutiliza EXACTAMENTE las tres rutas ya construidas para el filtro
// "Vencidas" del panel (idsVencidosSinAcuse/idsVencidosSinCompromiso/
// idsCompromisoVencido en gestion-calidad.ts) — no se reimplementa nada
// de la detección: mismo CORTE_HISTORICO_CALIDAD, mismo sumarDiasHabiles(),
// mismos tres estados. Esas funciones ya expresan exactamente las reglas
// SIN_ACUSE / SIN_COMPROMISO / COMPROMISO_VENCIDO del diseño.
//
// A diferencia de recordatorios-calidad.ts (dos envíos individuales por
// asesora), esto es UN SOLO correo consolidado a Coordinación
// (monica.hernandez@peoplebpo.com) agrupando todos los ciclos vencidos de
// las tres rutas — nunca un correo por auditoría.
//
// NO ESTÁ LISTO PARA CRON todavía — misma advertencia que
// recordatorios-calidad.ts: el chequeo de "ya escalado hoy" es una
// consulta defensiva a nivel de aplicación (por ciclo), no una
// restricción de base de datos. Aceptable para invocación manual de a una
// ejecución por vez.
// ============================================================

const DESTINATARIO_ESCALAMIENTO = "monica.hernandez@peoplebpo.com";
const NOMBRE_DESTINATARIO_ESCALAMIENTO = "Mónica";
// Igual que TAMANO_LOTE_EVENTOS en gestion-calidad.ts: un IN() con muchos
// UUIDs arma una URL que el API gateway de Supabase rechaza.
const TAMANO_LOTE_IDS = 150;

function appUrl(): string {
  const base = process.env.APP_URL;
  if (!base) throw new Error("Falta la variable APP_URL");
  return base.replace(/\/$/, "");
}

function construirUrlCalidad(): string {
  return `${appUrl()}/modulos/calidad`;
}

interface CicloEscalable {
  id: string;
  idGestion: string;
  asesorCodigo: string;
  motivo: MotivoEscalamientoCalidad;
}

// Detalle (id_gestion, asesor_codigo) en lotes — las tres rutas solo
// devuelven ids; aquí se completa lo mínimo para armar el correo.
async function completarDetalle(
  candidatos: { id: string; motivo: MotivoEscalamientoCalidad }[]
): Promise<CicloEscalable[]> {
  if (candidatos.length === 0) return [];
  const supabase = getSupabase();
  const detallePorId = new Map<string, { id_gestion: string; asesor_codigo: string }>();

  const ids = candidatos.map((c) => c.id);
  for (let i = 0; i < ids.length; i += TAMANO_LOTE_IDS) {
    const lote = ids.slice(i, i + TAMANO_LOTE_IDS);
    const { data, error } = await supabase.from("ciclo_auditoria").select("id, id_gestion, asesor_codigo").in("id", lote);
    if (error) throw new Error(`Supabase (detalle ciclos escalables): ${error.message}`);
    for (const fila of data ?? []) {
      const f = fila as { id: string; id_gestion: string; asesor_codigo: string };
      detallePorId.set(f.id, { id_gestion: f.id_gestion, asesor_codigo: f.asesor_codigo });
    }
  }

  return candidatos
    .map((c) => {
      const d = detallePorId.get(c.id);
      if (!d) return null;
      return { id: c.id, idGestion: d.id_gestion, asesorCodigo: d.asesor_codigo, motivo: c.motivo };
    })
    .filter((c): c is CicloEscalable => c !== null);
}

// Las tres rutas son mutuamente excluyentes por estado (NOTIFICADA /
// COMPROMISO_PENDIENTE / EN_SEGUIMIENTO nunca se solapan para un mismo
// ciclo) — mismo razonamiento que obtenerIdsVencidas() en gestion-calidad.ts.
async function obtenerCiclosEscalables(soloIdGestion?: string): Promise<CicloEscalable[]> {
  const [idsA, idsB, idsC] = await Promise.all([idsVencidosSinAcuse(), idsVencidosSinCompromiso(), idsCompromisoVencido()]);

  const candidatos: { id: string; motivo: MotivoEscalamientoCalidad }[] = [
    ...idsA.map((id) => ({ id, motivo: "SIN_ACUSE" as const })),
    ...idsB.map((id) => ({ id, motivo: "SIN_COMPROMISO" as const })),
    ...idsC.map((id) => ({ id, motivo: "COMPROMISO_VENCIDO" as const })),
  ];

  let ciclos = await completarDetalle(candidatos);
  if (soloIdGestion) ciclos = ciclos.filter((c) => c.idGestion === soloIdGestion);
  return ciclos;
}

function mismaFechaUTC(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Chequeo defensivo (no atómico, ver advertencia de Cron en el
// encabezado): un ciclo ya escalado HOY no se vuelve a incluir en un
// segundo envío del mismo día (doble clic, refresh). Al día siguiente, si
// sigue vencido, sí vuelve a escalarse — el escalamiento es recurrente
// mientras el problema no se resuelva, no un aviso de una sola vez.
async function yaEscaladoHoy(cicloId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("evento_ciclo")
    .select("creado_en")
    .eq("ciclo_id", cicloId)
    .eq("tipo_evento", "escalamiento_incluido")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase (chequeo escalamiento existente): ${error.message}`);
  if (!data) return false;
  return mismaFechaUTC(new Date((data as { creado_en: string }).creado_en), new Date());
}

// ============================================================
// DRY-RUN — solo lectura. No llama al mailer, no escribe en Supabase.
// ============================================================

export interface CasoDryRunEscalamiento {
  idGestion: string;
  asesor: string;
  motivo: MotivoEscalamientoCalidad;
  yaEscaladoHoy: boolean;
}

export interface ReporteDryRunEscalamiento {
  candidatosDetectados: number;
  destinatario: string;
  casos: CasoDryRunEscalamiento[];
}

export async function dryRunEscalamiento(soloIdGestion?: string): Promise<ReporteDryRunEscalamiento> {
  const ciclos = await obtenerCiclosEscalables(soloIdGestion);
  const casos: CasoDryRunEscalamiento[] = [];
  for (const c of ciclos) {
    casos.push({
      idGestion: c.idGestion,
      asesor: c.asesorCodigo,
      motivo: c.motivo,
      yaEscaladoHoy: await yaEscaladoHoy(c.id),
    });
  }
  return { candidatosDetectados: ciclos.length, destinatario: DESTINATARIO_ESCALAMIENTO, casos };
}

// ============================================================
// ENVÍO REAL — un solo correo consolidado, un evento escalamiento_incluido
// por cada ciclo efectivamente incluido en ese correo.
// ============================================================

export interface CasoEscalamiento {
  idGestion: string;
  asesor: string;
  motivo: MotivoEscalamientoCalidad;
  incluido: boolean; // false si ya se había escalado hoy — no se duplica
}

export interface ResultadoEscalamiento {
  candidatosDetectados: number;
  incluidosEnCorreo: number;
  enviado: boolean;
  destinatario: string;
  destinatarioEnvioReal: string | null;
  modoPrueba: boolean;
  messageId: string | null;
  casos: CasoEscalamiento[];
}

export async function procesarEscalamiento(soloIdGestion?: string): Promise<ResultadoEscalamiento> {
  const ciclos = await obtenerCiclosEscalables(soloIdGestion);

  const incluibles: (CicloEscalable & { nombreAsesora: string })[] = [];
  const casos: CasoEscalamiento[] = [];

  for (const c of ciclos) {
    if (await yaEscaladoHoy(c.id)) {
      casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, motivo: c.motivo, incluido: false });
      continue;
    }
    const nombreAsesora = await resolverNombreAsesor(c.asesorCodigo);
    incluibles.push({ ...c, nombreAsesora });
    casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, motivo: c.motivo, incluido: true });
  }

  if (incluibles.length === 0) {
    return {
      candidatosDetectados: ciclos.length,
      incluidosEnCorreo: 0,
      enviado: false,
      destinatario: DESTINATARIO_ESCALAMIENTO,
      destinatarioEnvioReal: null,
      modoPrueba: false,
      messageId: null,
      casos,
    };
  }

  const html = correoEscalamientoCalidad(
    NOMBRE_DESTINATARIO_ESCALAMIENTO,
    incluibles.map((c) => ({ idGestion: c.idGestion, asesora: c.nombreAsesora, motivo: c.motivo })),
    construirUrlCalidad()
  );
  const asunto = `Escalamiento de Calidad — ${incluibles.length} auditoría(s) vencida(s)`;

  // Mismo override de prueba que el resto del sistema (NOTIFICACION_CORREO_PRUEBA)
  // — nunca una segunda decisión de a quién llega físicamente el correo.
  const { destino: destinatarioFisico, modoPrueba } = correoDeEnvio(DESTINATARIO_ESCALAMIENTO);
  const envio = await enviarCorreoIndividual(destinatarioFisico, asunto, html);

  if (!envio.aceptado) {
    throw new Error(`SMTP no confirmó aceptar el destinatario: ${envio.respuestaServidor ?? "sin respuesta"}`);
  }

  const supabase = getSupabase();
  const timestamp = new Date().toISOString();
  const filasEvento = incluibles.map((c) => ({
    ciclo_id: c.id,
    tipo_evento: "escalamiento_incluido",
    origen: "automatico" as const,
    actor: null,
    // Exactamente la forma pedida: { destinatario, message_id, timestamp, motivo }.
    detalle: {
      destinatario: DESTINATARIO_ESCALAMIENTO,
      message_id: envio.messageId,
      timestamp,
      motivo: c.motivo,
    },
  }));
  const { error: errEventos } = await supabase.from("evento_ciclo").insert(filasEvento);
  if (errEventos) throw new Error(`Supabase (insertar escalamiento_incluido): ${errEventos.message}`);

  return {
    candidatosDetectados: ciclos.length,
    incluidosEnCorreo: incluibles.length,
    enviado: true,
    destinatario: DESTINATARIO_ESCALAMIENTO,
    destinatarioEnvioReal: destinatarioFisico,
    modoPrueba,
    messageId: envio.messageId,
    casos,
  };
}
