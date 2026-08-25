import "server-only";
import { getSupabase } from "./supabase";
import { sumarDiasHabiles } from "./dias-habiles-colombia";
import { enviarCorreoIndividual } from "./mailer";
import { correoRecordatorioAcuse, correoRecordatorioCompromiso } from "./emailTemplates";
import {
  construirUrlAuditoria,
  revalidarCorreoAsesor,
  correoDeEnvio,
  resolverNombreAsesor,
} from "./notificacion-por-enviar";
import { CORTE_HISTORICO_CALIDAD, obtenerEventosNotificacionPorCiclo } from "./gestion-calidad";

// ============================================================
// MÓDULO CALIDAD — Recordatorios (bloque 1 del roadmap post-Etapa 3)
//
// Dos relojes independientes, mismo patrón de detección/envío que
// notificacion-por-enviar.ts (Fase 1) — reutiliza sus funciones de
// identidad/envío/URL en vez de duplicarlas:
//   - ACUSE: ciclos NOTIFICADA. fechaBase = fecha del evento
//     notificacion_enviada (vía obtenerEventosNotificacionPorCiclo, ya
//     usada por el panel de Calidad).
//   - COMPROMISO: ciclos COMPROMISO_PENDIENTE. fechaBase = fecha_acuse.
//
// "Día hábil 1" = sumarDiasHabiles(fechaBase, 1) — falta exactamente 1 día
// hábil para el límite (dias_habiles_compromiso=2). "Día hábil 2" =
// sumarDiasHabiles(fechaBase, 2) — el mismo día del límite, último aviso
// antes de que el semáforo pase a "vencida". Ambos son fechas de
// calendario UTC (mismo criterio que sumarDiasHabiles/fecha_prometida en
// todo el sistema): se envía si HOY cae en esa fecha, ni antes ni después.
//
// Respeta el mismo corte histórico que el panel (CORTE_HISTORICO_CALIDAD):
// no se envían recordatorios para el backlog de ~1090 ciclos de Fase 1.
//
// NO ESTÁ LISTO PARA CRON todavía — misma advertencia que
// procesarNotificacionesPendientes(): el chequeo de "ya enviado" es una
// consulta defensiva a nivel de aplicación, no una restricción de base de
// datos. Aceptable para invocación manual de a una ejecución por vez; la
// etapa de Automatización debe resolver la concurrencia antes de conectar
// un Cron real.
// ============================================================

export type RelojRecordatorio = "ACUSE" | "COMPROMISO";
export type DiaRecordatorio = 1 | 2;

interface CandidatoRecordatorio {
  id: string;
  idGestion: string;
  asesorCodigo: string;
  correoSnapshot: string | null;
  fechaBase: string; // ISO
  reloj: RelojRecordatorio;
}

function mismaFechaUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// null si hoy no corresponde a ninguno de los dos días de recordatorio
// (todavía falta más de 1 día hábil, o ya pasó el límite — eso último es
// "vencida", tarea de escalamiento, no de recordatorios).
function diaRecordatorioHoy(fechaBase: Date, ahora: Date): DiaRecordatorio | null {
  const dia1 = sumarDiasHabiles(fechaBase, 1);
  if (mismaFechaUTC(ahora, dia1)) return 1;
  const dia2 = sumarDiasHabiles(fechaBase, 2);
  if (mismaFechaUTC(ahora, dia2)) return 2;
  return null;
}

async function obtenerCandidatosAcuse(soloIdGestion?: string): Promise<CandidatoRecordatorio[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("ciclo_auditoria")
    .select("id, id_gestion, asesor_codigo, correo_notificacion")
    .eq("estado", "NOTIFICADA")
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);
  if (soloIdGestion) query = query.eq("id_gestion", soloIdGestion);

  const { data, error } = await query;
  if (error) throw new Error(`Supabase (candidatos recordatorio acuse): ${error.message}`);

  const filas = (data ?? []) as {
    id: string;
    id_gestion: string;
    asesor_codigo: string;
    correo_notificacion: string | null;
  }[];
  if (filas.length === 0) return [];

  const eventos = await obtenerEventosNotificacionPorCiclo(filas.map((f) => f.id));

  const candidatos: CandidatoRecordatorio[] = [];
  for (const f of filas) {
    const fechaNotificacion = eventos.get(f.id)?.fechaNotificacion;
    // No debería faltar en NOTIFICADA, pero no se asume — sin fecha base
    // no hay reloj que calcular.
    if (!fechaNotificacion) continue;
    candidatos.push({
      id: f.id,
      idGestion: f.id_gestion,
      asesorCodigo: f.asesor_codigo,
      correoSnapshot: f.correo_notificacion,
      fechaBase: fechaNotificacion,
      reloj: "ACUSE",
    });
  }
  return candidatos;
}

async function obtenerCandidatosCompromiso(soloIdGestion?: string): Promise<CandidatoRecordatorio[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("ciclo_auditoria")
    .select("id, id_gestion, asesor_codigo, correo_notificacion, fecha_acuse")
    .eq("estado", "COMPROMISO_PENDIENTE")
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);
  if (soloIdGestion) query = query.eq("id_gestion", soloIdGestion);

  const { data, error } = await query;
  if (error) throw new Error(`Supabase (candidatos recordatorio compromiso): ${error.message}`);

  const filas = (data ?? []) as {
    id: string;
    id_gestion: string;
    asesor_codigo: string;
    correo_notificacion: string | null;
    fecha_acuse: string | null;
  }[];

  return filas
    .filter((f) => !!f.fecha_acuse)
    .map((f) => ({
      id: f.id,
      idGestion: f.id_gestion,
      asesorCodigo: f.asesor_codigo,
      correoSnapshot: f.correo_notificacion,
      fechaBase: f.fecha_acuse as string,
      reloj: "COMPROMISO" as const,
    }));
}

const TIPO_EVENTO_POR_RELOJ: Record<RelojRecordatorio, string> = {
  ACUSE: "recordatorio_acuse_enviado",
  COMPROMISO: "recordatorio_compromiso_enviado",
};

// Chequeo defensivo (no atómico) de duplicado — ver advertencia de Cron
// en el encabezado del archivo. detalle->>dia distingue el recordatorio
// día 1 del día 2: son dos envíos legítimos, nunca uno duplicado del otro.
async function yaEnviadoHoy(cicloId: string, tipoEvento: string, dia: DiaRecordatorio): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("evento_ciclo")
    .select("id")
    .eq("ciclo_id", cicloId)
    .eq("tipo_evento", tipoEvento)
    .eq("detalle->>dia", String(dia))
    .maybeSingle();
  if (error) throw new Error(`Supabase (chequeo recordatorio existente): ${error.message}`);
  return !!data;
}

// ============================================================
// DRY-RUN — solo lectura. No llama al mailer, no escribe en Supabase.
// ============================================================

export interface CasoDryRunRecordatorio {
  idGestion: string;
  asesor: string;
  reloj: RelojRecordatorio;
  dia: DiaRecordatorio;
  fechaBase: string;
  yaEnviado: boolean;
}

export interface ReporteDryRunRecordatorios {
  candidatosDetectados: number;
  casosParaEnviarHoy: CasoDryRunRecordatorio[];
}

export async function dryRunRecordatorios(soloIdGestion?: string): Promise<ReporteDryRunRecordatorios> {
  const ahora = new Date();
  const [acuse, compromiso] = await Promise.all([
    obtenerCandidatosAcuse(soloIdGestion),
    obtenerCandidatosCompromiso(soloIdGestion),
  ]);
  const todos = [...acuse, ...compromiso];

  const casos: CasoDryRunRecordatorio[] = [];
  for (const c of todos) {
    const dia = diaRecordatorioHoy(new Date(c.fechaBase), ahora);
    if (!dia) continue;
    const yaEnviado = await yaEnviadoHoy(c.id, TIPO_EVENTO_POR_RELOJ[c.reloj], dia);
    casos.push({
      idGestion: c.idGestion,
      asesor: c.asesorCodigo,
      reloj: c.reloj,
      dia,
      fechaBase: c.fechaBase,
      yaEnviado,
    });
  }

  return { candidatosDetectados: todos.length, casosParaEnviarHoy: casos };
}

// ============================================================
// ENVÍO REAL
// ============================================================

export type AccionRecordatorio =
  | "ENVIADO"
  | "YA_ENVIADO_HOY"
  | "NO_APLICA_HOY"
  | "CORREO_NO_COINCIDE"
  | "SIN_CORREO_VALIDO"
  | "FALLO_ENVIO";

export interface CasoRecordatorio {
  idGestion: string;
  asesor: string;
  reloj: RelojRecordatorio;
  accion: AccionRecordatorio;
  detalle?: string;
}

export interface ResultadoRecordatorios {
  candidatosDetectados: number;
  enviados: number;
  fallidos: number;
  casos: CasoRecordatorio[];
}

// A propósito NO registra un evento_ciclo de fallo (no existe ese tipo en
// el CHECK de la migración 0003) — mismo criterio que
// registrarNotificacionFallida() aplicaría si tuviera que inventar un tipo
// fuera de ese CHECK: no se inventa, solo se deja constancia en logs.
function registrarRecordatorioFallido(cicloId: string, reloj: RelojRecordatorio, motivo: string): void {
  console.error(`[recordatorios-calidad] fallo enviando recordatorio ${reloj} para ciclo ${cicloId}: ${motivo}`);
}

export async function procesarRecordatoriosPendientes(soloIdGestion?: string): Promise<ResultadoRecordatorios> {
  const ahora = new Date();
  const supabase = getSupabase();
  const [acuse, compromiso] = await Promise.all([
    obtenerCandidatosAcuse(soloIdGestion),
    obtenerCandidatosCompromiso(soloIdGestion),
  ]);
  const candidatos = [...acuse, ...compromiso];

  let enviados = 0;
  let fallidos = 0;
  const casos: CasoRecordatorio[] = [];

  for (const c of candidatos) {
    try {
      const dia = diaRecordatorioHoy(new Date(c.fechaBase), ahora);
      if (!dia) {
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "NO_APLICA_HOY" });
        continue;
      }

      const tipoEvento = TIPO_EVENTO_POR_RELOJ[c.reloj];
      if (await yaEnviadoHoy(c.id, tipoEvento, dia)) {
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "YA_ENVIADO_HOY" });
        continue;
      }

      const identidad = await revalidarCorreoAsesor(c.asesorCodigo);
      if (identidad.estado !== "ELEGIBLE") {
        fallidos++;
        const motivo = `Identidad no ELEGIBLE al revalidar: ${identidad.estado}`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "SIN_CORREO_VALIDO", detalle: motivo });
        registrarRecordatorioFallido(c.id, c.reloj, motivo);
        continue;
      }

      const snapshotNorm = (c.correoSnapshot ?? "").trim().toLowerCase();
      if (identidad.correo !== snapshotNorm) {
        fallidos++;
        const motivo = `Correo actual ("${identidad.correo}") no coincide con snapshot ("${c.correoSnapshot}")`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "CORREO_NO_COINCIDE", detalle: motivo });
        registrarRecordatorioFallido(c.id, c.reloj, motivo);
        continue;
      }

      const nombre = await resolverNombreAsesor(c.asesorCodigo);
      const url = construirUrlAuditoria(c.idGestion);
      const html =
        c.reloj === "ACUSE" ? correoRecordatorioAcuse(nombre, url, dia) : correoRecordatorioCompromiso(nombre, url, dia);
      const asunto =
        c.reloj === "ACUSE"
          ? dia === 2
            ? "Último día para acusar tu auditoría de calidad"
            : "Recordatorio: acuse pendiente de tu auditoría de calidad"
          : dia === 2
            ? "Último día para registrar tu compromiso de mejora"
            : "Recordatorio: compromiso de mejora pendiente de registrar";

      const { destino: destinatarioFisico, modoPrueba } = correoDeEnvio(identidad.correo);
      const envio = await enviarCorreoIndividual(destinatarioFisico, asunto, html);

      if (!envio.aceptado) {
        fallidos++;
        const motivo = `SMTP no confirmó aceptar el destinatario: ${envio.respuestaServidor ?? "sin respuesta"}`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "FALLO_ENVIO", detalle: motivo });
        registrarRecordatorioFallido(c.id, c.reloj, motivo);
        continue;
      }

      const { error: errEvento } = await supabase.from("evento_ciclo").insert({
        ciclo_id: c.id,
        tipo_evento: tipoEvento,
        origen: "automatico",
        actor: null,
        detalle: {
          dia,
          destinatario: identidad.correo,
          destinatario_envio_real: destinatarioFisico,
          modo_prueba: modoPrueba,
          message_id: envio.messageId,
          timestamp: new Date().toISOString(),
        },
      });
      if (errEvento) throw new Error(`insert evento_ciclo: ${errEvento.message}`);

      enviados++;
      casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "ENVIADO" });
    } catch (e) {
      fallidos++;
      const motivo = e instanceof Error ? e.message : String(e);
      casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, reloj: c.reloj, accion: "FALLO_ENVIO", detalle: motivo });
      registrarRecordatorioFallido(c.id, c.reloj, motivo);
    }
  }

  return { candidatosDetectados: candidatos.length, enviados, fallidos, casos };
}
