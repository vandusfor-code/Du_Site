import "server-only";
import { readRange } from "./sheets";
import { getSupabase } from "./supabase";
import { resolverIdentidadAsesor, type FilaFuncionario, type ResultadoIdentidad } from "./identidad-ciclo";
import { enviarCorreoIndividual } from "./mailer";
import { correoNuevaAuditoria } from "./emailTemplates";
import { buscarUsuario } from "./usuarios";

// ============================================================
// FASE 1 — Notificación al asesor: CREADA + requiere_compromiso=true → NOTIFICADA
//
// NO implementa acuse, compromiso, seguimiento, escalamiento, cron ni
// recordatorios — eso pertenece a fases futuras. Este archivo solo:
//   1. encuentra ciclos que necesitan notificación,
//   2. revalida el correo actual contra el snapshot (fail-closed),
//   3. envía UN correo (reutilizando mailer.ts, sin sistema de correo nuevo),
//   4. si el SMTP confirma aceptación, transiciona CREADA -> NOTIFICADA y
//      registra notificacion_enviada,
//   5. si algo falla, deja el ciclo en CREADA y registra notificacion_fallida
//      (sin inventar un estado nuevo ni tocar Consolidado).
//
// procesarNotificacionesPendientes() NO ESTÁ LISTO PARA CRON: el envío
// ocurre antes del UPDATE condicional (para nunca marcar NOTIFICADA sin
// haber enviado), lo que deja una ventana de carrera donde dos ejecuciones
// verdaderamente simultáneas podrían enviar el correo dos veces antes de
// que cualquiera alcance a hacer el UPDATE. Aceptable hoy porque se invoca
// manualmente y de a una ejecución por vez; antes de conectar un Cron hace
// falta un mecanismo de "reclamo" atómico previo al envío.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function appUrl(): string {
  const base = process.env.APP_URL;
  if (!base) throw new Error("Falta la variable APP_URL");
  return base.replace(/\/$/, "");
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

const ASUNTO_NOTIFICACION = "Nueva auditoría de calidad disponible";
const TAMANO_PAGINA = 1000;

export interface CicloCandidato {
  id: string;
  idGestion: string;
  asesorCodigo: string;
  correoSnapshot: string | null;
}

async function obtenerCandidatos(soloIdGestion?: string): Promise<CicloCandidato[]> {
  const supabase = getSupabase();
  const candidatos: CicloCandidato[] = [];

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    let query = supabase
      .from("ciclo_auditoria")
      .select("id, id_gestion, asesor_codigo, correo_notificacion")
      .eq("estado", "CREADA")
      .eq("requiere_compromiso", true);
    if (soloIdGestion) query = query.eq("id_gestion", soloIdGestion);

    const { data, error } = await query.range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(`Supabase (ciclo_auditoria candidatos): ${error.message}`);

    const pagina = data ?? [];
    for (const row of pagina) {
      const r = row as { id: string; id_gestion: string; asesor_codigo: string; correo_notificacion: string | null };
      candidatos.push({ id: r.id, idGestion: r.id_gestion, asesorCodigo: r.asesor_codigo, correoSnapshot: r.correo_notificacion });
    }
    if (pagina.length < TAMANO_PAGINA) break;
  }

  return candidatos;
}

// Relee Funcionarios en el momento del envío y reutiliza la MISMA función de
// identidad de Fase 1 (nunca coincidencia aproximada). Se pasa [asesorCodigo]
// como "asesoresConsolidado" a propósito: ya sabemos que existe (el ciclo
// está en CREADA); lo único que interesa revalidar aquí es el correo.
async function revalidarCorreoAsesor(asesorCodigo: string): Promise<ResultadoIdentidad> {
  const id = sheetId();
  const funcionariosRaw = await readRange(id, "Funcionarios", { unformatted: true });
  const funcionarios: FilaFuncionario[] = funcionariosRaw
    .slice(1)
    .filter((r) => texto(r, 0).trim())
    .map((r) => ({ codigo: texto(r, 0), correo: texto(r, 1) }));

  return resolverIdentidadAsesor(asesorCodigo, [asesorCodigo], funcionarios);
}

// La hoja Funcionarios NO tiene un campo de nombre real (solo código, correo,
// canal) — nunca se fabrica un nombre a partir del código. Usuarios (la
// misma hoja del login, identidad ya unificada desde Fase 0) sí tiene un
// nombre real bajo la misma clave. Si por lo que sea no se encuentra, se usa
// el código tal cual — nunca se inventa. Esto es solo para el saludo del
// correo, no es una condición para enviar o no.
async function resolverNombreAsesor(asesorCodigo: string): Promise<string> {
  try {
    const usuario = await buscarUsuario(asesorCodigo);
    return usuario?.nombre || asesorCodigo;
  } catch {
    return asesorCodigo;
  }
}

export function construirUrlAuditoria(idGestion: string): string {
  return `${appUrl()}/modulos/metricas?seccion=auditorias&id=${encodeURIComponent(idGestion)}`;
}

// Modo de prueba explícito y temporal: si NOTIFICACION_CORREO_PRUEBA existe,
// TODO envío de esta ejecución se entrega físicamente a esa dirección en vez
// del correo real del asesor. No cambia nada de la resolución de identidad
// ni de la comparación snapshot-vs-actual (ambas siguen evaluándose contra
// el correo real) — es el ÚNICO punto donde se decide a qué dirección
// física llega el correo. Sin esta variable (comportamiento normal en
// producción), correoDeEnvio() devuelve exactamente el correo real.
function correoDeEnvio(correoReal: string): { destino: string; modoPrueba: boolean } {
  const override = process.env.NOTIFICACION_CORREO_PRUEBA;
  return override ? { destino: override, modoPrueba: true } : { destino: correoReal, modoPrueba: false };
}

async function registrarNotificacionFallida(cicloId: string, motivo: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("evento_ciclo").insert({
    ciclo_id: cicloId,
    tipo_evento: "notificacion_fallida",
    origen: "automatico",
    actor: null,
    detalle: { motivo, timestamp: new Date().toISOString() },
  });
  // Un fallo registrando el fallo no debe reventar el proceso — ya se
  // reporta igual en el resultado de la función que llama a esto.
  if (error) console.error("[notificacion-por-enviar] no se pudo registrar notificacion_fallida:", error.message);
}

// ============================================================
// DRY-RUN — solo lectura. No llama al mailer, no escribe en Supabase ni
// en Sheets.
// ============================================================

export interface CasoDryRunNotificacion {
  idGestion: string;
  asesor: string;
  estadoActual: "CREADA";
  requiereCompromiso: true;
  correoSnapshot: string | null;
  correoActual: string | null;
  correosCoinciden: boolean | null;
  nombreQueSeUsaria: string;
  urlQueSeEnviaria: string;
  asunto: string;
  // Reflejan exactamente lo que haría procesarNotificacionesPendientes():
  // destinatarioEnvioReal es a quién llegaría físicamente el correo, que
  // difiere de correoActual solo si NOTIFICACION_CORREO_PRUEBA está activo.
  destinatarioEnvioReal: string | null;
  modoPrueba: boolean;
  problema: string | null;
}

export interface ReporteDryRunNotificacion {
  candidatosDetectados: number;
  casos: CasoDryRunNotificacion[];
}

export async function dryRunNotificaciones(soloIdGestion?: string): Promise<ReporteDryRunNotificacion> {
  const candidatos = await obtenerCandidatos(soloIdGestion);
  const casos: CasoDryRunNotificacion[] = [];

  for (const c of candidatos) {
    const identidad = await revalidarCorreoAsesor(c.asesorCodigo);
    const nombre = await resolverNombreAsesor(c.asesorCodigo);
    const url = construirUrlAuditoria(c.idGestion);

    let correoActual: string | null = null;
    let correosCoinciden: boolean | null = null;
    let destinatarioEnvioReal: string | null = null;
    let modoPrueba = false;
    let problema: string | null = null;

    if (identidad.estado === "ELEGIBLE") {
      correoActual = identidad.correo;
      correosCoinciden = (c.correoSnapshot ?? "").trim().toLowerCase() === identidad.correo;
      if (!correosCoinciden) {
        problema = `El correo actual en Funcionarios ("${identidad.correo}") no coincide con el snapshot guardado ("${c.correoSnapshot}")`;
      } else {
        const envio = correoDeEnvio(identidad.correo);
        destinatarioEnvioReal = envio.destino;
        modoPrueba = envio.modoPrueba;
      }
    } else {
      problema = `No se pudo confirmar un correo único al revalidar: ${identidad.estado}`;
    }

    casos.push({
      idGestion: c.idGestion,
      asesor: c.asesorCodigo,
      estadoActual: "CREADA",
      requiereCompromiso: true,
      correoSnapshot: c.correoSnapshot,
      correoActual,
      correosCoinciden,
      nombreQueSeUsaria: nombre,
      urlQueSeEnviaria: url,
      asunto: ASUNTO_NOTIFICACION,
      destinatarioEnvioReal,
      modoPrueba,
      problema,
    });
  }

  return { candidatosDetectados: candidatos.length, casos };
}

// ============================================================
// ENVÍO REAL
// ============================================================

export type AccionNotificacion = "NOTIFICADA" | "CORREO_NO_COINCIDE" | "SIN_CORREO_VALIDO" | "FALLO_ENVIO";

export interface CasoNotificacion {
  idGestion: string;
  asesor: string;
  accion: AccionNotificacion;
  detalle?: string;
}

export interface ResultadoNotificaciones {
  candidatosDetectados: number;
  notificadas: number;
  fallidas: number;
  casos: CasoNotificacion[];
}

export async function procesarNotificacionesPendientes(soloIdGestion?: string): Promise<ResultadoNotificaciones> {
  const candidatos = await obtenerCandidatos(soloIdGestion);
  const supabase = getSupabase();
  const casos: CasoNotificacion[] = [];
  let notificadas = 0;
  let fallidas = 0;

  for (const c of candidatos) {
    try {
      const identidad = await revalidarCorreoAsesor(c.asesorCodigo);

      if (identidad.estado !== "ELEGIBLE") {
        fallidas++;
        const detalle = `Identidad no ELEGIBLE al revalidar: ${identidad.estado}`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, accion: "SIN_CORREO_VALIDO", detalle });
        await registrarNotificacionFallida(c.id, detalle);
        continue;
      }

      const snapshotNorm = (c.correoSnapshot ?? "").trim().toLowerCase();
      if (identidad.correo !== snapshotNorm) {
        fallidas++;
        const detalle = `Correo actual ("${identidad.correo}") no coincide con snapshot ("${c.correoSnapshot}")`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, accion: "CORREO_NO_COINCIDE", detalle });
        await registrarNotificacionFallida(c.id, detalle);
        continue;
      }

      const nombre = await resolverNombreAsesor(c.asesorCodigo);
      const url = construirUrlAuditoria(c.idGestion);
      const html = correoNuevaAuditoria(nombre, url);

      const { destino: destinatarioFisico, modoPrueba } = correoDeEnvio(identidad.correo);
      const envio = await enviarCorreoIndividual(destinatarioFisico, ASUNTO_NOTIFICACION, html);

      if (!envio.aceptado) {
        fallidas++;
        const detalle = `SMTP no confirmó aceptar el destinatario: ${envio.respuestaServidor ?? "sin respuesta"}`;
        casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, accion: "FALLO_ENVIO", detalle });
        await registrarNotificacionFallida(c.id, detalle);
        continue;
      }

      // Transición condicional: solo si SIGUE en CREADA (mismo patrón que
      // requiere_compromiso en Corrida 2). El correo ya se envió en este
      // punto — si el UPDATE no encuentra la fila en CREADA, alguien más ya
      // la marcó NOTIFICADA mientras se enviaba (ver nota de concurrencia).
      const { data: actualizado, error: errUpdate } = await supabase
        .from("ciclo_auditoria")
        .update({ estado: "NOTIFICADA" })
        .eq("id", c.id)
        .eq("estado", "CREADA")
        .select("id")
        .maybeSingle();
      if (errUpdate) throw new Error(`update ciclo_auditoria: ${errUpdate.message}`);

      if (!actualizado) {
        casos.push({
          idGestion: c.idGestion,
          asesor: c.asesorCodigo,
          accion: "NOTIFICADA",
          detalle: "el ciclo ya estaba NOTIFICADA (carrera); el correo se envió de todas formas",
        });
        continue;
      }

      const { error: errEvento } = await supabase.from("evento_ciclo").insert({
        ciclo_id: c.id,
        tipo_evento: "notificacion_enviada",
        origen: "automatico",
        actor: null,
        detalle: {
          destinatario: identidad.correo,
          destinatario_envio_real: destinatarioFisico,
          modo_prueba: modoPrueba,
          tipo_notificacion: "auditoria_creada",
          message_id: envio.messageId,
          timestamp: new Date().toISOString(),
        },
      });
      if (errEvento) throw new Error(`insert evento_ciclo: ${errEvento.message}`);

      notificadas++;
      casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, accion: "NOTIFICADA" });
    } catch (e) {
      fallidas++;
      const motivo = e instanceof Error ? e.message : String(e);
      casos.push({ idGestion: c.idGestion, asesor: c.asesorCodigo, accion: "FALLO_ENVIO", detalle: motivo });
      await registrarNotificacionFallida(c.id, motivo);
    }
  }

  return { candidatosDetectados: candidatos.length, notificadas, fallidas, casos };
}

// ============================================================
// VERIFICACIÓN — solo lectura. Para confirmar, después del envío, el estado
// real del ciclo y el contenido exacto de los eventos registrados, sin
// depender de lo que haya reportado la escritura.
// ============================================================

export interface VerificacionNotificacion {
  idGestion: string;
  estado: string;
  requiereCompromiso: boolean;
  eventos: {
    tipoEvento: string;
    origen: string;
    actor: string | null;
    detalle: unknown;
    creadoEn: string;
  }[];
}

export async function verificarNotificacion(idGestion: string): Promise<VerificacionNotificacion> {
  const supabase = getSupabase();

  const { data: ciclo, error: errCiclo } = await supabase
    .from("ciclo_auditoria")
    .select("id, estado, requiere_compromiso")
    .eq("id_gestion", idGestion)
    .maybeSingle();
  if (errCiclo) throw new Error(`Supabase (ciclo_auditoria): ${errCiclo.message}`);
  if (!ciclo) throw new Error(`No existe ciclo_auditoria para id_gestion=${idGestion}`);

  const { data: eventos, error: errEventos } = await supabase
    .from("evento_ciclo")
    .select("tipo_evento, origen, actor, detalle, creado_en")
    .eq("ciclo_id", ciclo.id)
    .in("tipo_evento", ["notificacion_enviada", "notificacion_fallida"])
    .order("creado_en", { ascending: true });
  if (errEventos) throw new Error(`Supabase (evento_ciclo): ${errEventos.message}`);

  return {
    idGestion,
    estado: ciclo.estado,
    requiereCompromiso: ciclo.requiere_compromiso,
    eventos: (eventos ?? []).map((e) => ({
      tipoEvento: e.tipo_evento,
      origen: e.origen,
      actor: e.actor,
      detalle: e.detalle,
      creadoEn: e.creado_en,
    })),
  };
}
