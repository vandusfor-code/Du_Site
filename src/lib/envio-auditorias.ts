import "server-only";
import { readRange, parseSheetDate } from "./sheets";
import { getSupabase } from "./supabase";
import {
  revalidarCorreoAsesor,
  resolverNombreAsesor,
  correoDeEnvio,
} from "./notificacion-por-enviar";
import { enviarCorreoIndividual } from "./mailer";
import { correoLoteAuditorias } from "./emailTemplates";
import {
  agruparAuditorias,
  type AuditoriaFilaEnvio,
  type EstadoCicloPorId,
  type EstadoCicloEnvio,
  type RegistroDirectorio,
  type FiltrosEnvio,
  type ResumenEnvio,
} from "./envio-auditorias-tipos";

// ============================================================
// ENVÍO DE AUDITORÍAS POR ASESORA (sección de Auditoría ChatGPT)
//
// Lee Consolidado + Funcionarios (Sheets) y ciclo_auditoria (Supabase), agrupa
// por asesora (lógica pura en envio-auditorias-tipos.ts) y envía UN correo por
// asesora enlazando al portal existente. Reutiliza los helpers de identidad ya
// exportados por notificacion-por-enviar.ts (revalidación de correo oficial,
// override de prueba) y el mailer existente — NO crea un segundo sistema de
// correo ni toca el flujo de notificacion-por-enviar.ts.
//
// LÍMITE DE IDEMPOTENCIA (documentado): el envío ocurre antes del UPDATE
// condicional CREADA->NOTIFICADA (para no marcar NOTIFICADA sin haber enviado),
// igual que en notificacion-por-enviar.ts. Es seguro para uso MANUAL de a una
// ejecución; para conectar un cron o permitir ejecuciones concurrentes hace
// falta una reclamación atómica previa al envío (estado intermedio ENVIANDO o
// columna de reclamo), que requiere una migración de Supabase — ver
// docs/envio-auditorias.md. El botón de la UI se deshabilita durante el proceso
// y el UPDATE condicional (WHERE estado='CREADA') hace que una segunda corrida
// no re-notifique lo ya notificado.
// ============================================================

const COL_FECHA = 0;
const COL_ASESOR = 2;
const COL_CANAL = 3;
const COL_ID_GESTION = 6;
const COL_TIPO_NOTA = 17;
const LARGO_MAXIMO_ID_GESTION = 500;
const TAMANO_LOTE_IN = 150;

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

// Fecha de REGISTRO de la auditoría (Consolidado!A) normalizada a "YYYY-MM-DD"
// como hora de pared (igual criterio que el resto de Fase 1). Acepta string
// "YYYY-MM-DD", "dd/MM/yyyy..." o número de serie de Sheets.
function fechaRegistroISO(valor: unknown): string | null {
  if (typeof valor === "string") {
    const s = valor.trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const d = parseSheetDate(valor);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

// Lee los estados de ciclo para un conjunto de idGestion (paginado por IN).
async function leerCiclosPorIdGestion(
  ids: string[]
): Promise<Map<string, { id: string; asesorCodigo: string; correoSnapshot: string | null; estado: EstadoCicloEnvio; requiereCompromiso: boolean }>> {
  const mapa = new Map<string, { id: string; asesorCodigo: string; correoSnapshot: string | null; estado: EstadoCicloEnvio; requiereCompromiso: boolean }>();
  if (ids.length === 0) return mapa;
  const supabase = getSupabase();
  for (let i = 0; i < ids.length; i += TAMANO_LOTE_IN) {
    const lote = ids.slice(i, i + TAMANO_LOTE_IN);
    const { data, error } = await supabase
      .from("ciclo_auditoria")
      .select("id, id_gestion, asesor_codigo, correo_notificacion, estado, requiere_compromiso")
      .in("id_gestion", lote);
    if (error) throw new Error(`Supabase (ciclo_auditoria envío): ${error.message}`);
    for (const row of data ?? []) {
      const r = row as { id: string; id_gestion: string; asesor_codigo: string; correo_notificacion: string | null; estado: EstadoCicloEnvio; requiere_compromiso: boolean };
      mapa.set(r.id_gestion, {
        id: r.id,
        asesorCodigo: r.asesor_codigo,
        correoSnapshot: r.correo_notificacion,
        estado: r.estado,
        requiereCompromiso: r.requiere_compromiso,
      });
    }
  }
  return mapa;
}

// Entrada compartida (Sheets) para la vista y para el envío, leída UNA sola vez.
async function leerBase(filtros: FiltrosEnvio): Promise<{
  filas: AuditoriaFilaEnvio[];
  directorio: Map<string, RegistroDirectorio>;
  ciclos: Map<string, { id: string; asesorCodigo: string; correoSnapshot: string | null; estado: EstadoCicloEnvio; requiereCompromiso: boolean }>;
}> {
  const id = sheetId();
  const [consolidadoRaw, funcionariosRaw] = await Promise.all([
    readRange(id, "Consolidado!A2:AC", { unformatted: true }),
    readRange(id, "Funcionarios", { unformatted: true }),
  ]);

  const directorio = new Map<string, RegistroDirectorio>();
  for (let i = 1; i < funcionariosRaw.length; i++) {
    const codigo = texto(funcionariosRaw[i], 0).trim().toUpperCase();
    if (!codigo) continue;
    // A código, B correo, C canal, D contraseña (NO se lee), E nombre.
    directorio.set(codigo, {
      correo: texto(funcionariosRaw[i], 1).trim(),
      canal: texto(funcionariosRaw[i], 2).trim(),
      nombre: texto(funcionariosRaw[i], 4).trim(),
    });
  }

  const filas: AuditoriaFilaEnvio[] = [];
  const vistos = new Set<string>();
  for (const r of consolidadoRaw) {
    const idg = texto(r, COL_ID_GESTION).trim();
    if (!idg || idg.length > LARGO_MAXIMO_ID_GESTION || vistos.has(idg)) continue;
    const fecha = fechaRegistroISO(r[COL_FECHA]);
    if (!fecha || fecha !== filtros.fecha.trim()) continue; // solo la fecha pedida
    vistos.add(idg);
    filas.push({
      idGestion: idg,
      asesorCodigo: texto(r, COL_ASESOR).trim().toUpperCase(),
      fecha,
      canalConsolidado: texto(r, COL_CANAL).trim(),
      resultado: texto(r, COL_TIPO_NOTA).trim().toUpperCase(),
    });
  }

  const ciclos = await leerCiclosPorIdGestion(filas.map((f) => f.idGestion));
  return { filas, directorio, ciclos };
}

export async function obtenerEnvioAuditorias(filtros: FiltrosEnvio): Promise<ResumenEnvio> {
  const { filas, directorio, ciclos } = await leerBase(filtros);
  const ciclosEstado = new Map<string, EstadoCicloPorId>();
  for (const [idg, c] of ciclos) ciclosEstado.set(idg, { estado: c.estado, requiereCompromiso: c.requiereCompromiso });
  return agruparAuditorias(filas, ciclosEstado, directorio, filtros);
}

// ============================================================
// ENVÍO REAL
// ============================================================

export type AccionLote = "NOTIFICADA" | "SIN_PENDIENTES" | "CORREO_NO_COINCIDE" | "SIN_CORREO_VALIDO" | "FALLO_ENVIO";

export interface ResultadoAsesoraLote {
  asesorCodigo: string;
  nombre: string;
  correoDestinoSeguro: string; // enmascarado, nunca el correo completo en claro
  accion: AccionLote;
  auditoriasEnviadas: number;
  detalle?: string;
}

export interface ResultadoEnvioLote {
  fecha: string;
  asesorasProcesadas: number;
  asesorasNotificadas: number;
  auditoriasNotificadas: number;
  fallidas: number;
  resultados: ResultadoAsesoraLote[];
}

function enmascararCorreo(correo: string): string {
  const [u, dom] = correo.split("@");
  if (!dom) return "—";
  const ini = u.slice(0, 2);
  return `${ini}${"*".repeat(Math.max(1, u.length - 2))}@${dom}`;
}

// Envía un correo por asesora para sus auditorías PENDIENTES (CREADA) de la
// fecha. `asesora` restringe a una; vacío = todas las de la fecha. Recalcula
// TODO server-side: nunca confía en ids enviados por el navegador.
export async function enviarLoteAuditorias(fecha: string, asesora?: string): Promise<ResultadoEnvioLote> {
  const filtros: FiltrosEnvio = { fecha, asesora, soloPendientes: true };
  const { filas, directorio, ciclos } = await leerBase(filtros);

  const ciclosEstado = new Map<string, EstadoCicloPorId>();
  for (const [idg, c] of ciclos) ciclosEstado.set(idg, { estado: c.estado, requiereCompromiso: c.requiereCompromiso });
  const resumen = agruparAuditorias(filas, ciclosEstado, directorio, filtros);

  const supabase = getSupabase();
  const fechaLabel = fecha;
  const resultados: ResultadoAsesoraLote[] = [];
  let asesorasNotificadas = 0;
  let auditoriasNotificadas = 0;
  let fallidas = 0;

  for (const grupo of resumen.grupos) {
    const base: ResultadoAsesoraLote = {
      asesorCodigo: grupo.asesorCodigo,
      nombre: grupo.nombre,
      correoDestinoSeguro: grupo.correo ? enmascararCorreo(grupo.correo) : "—",
      accion: "SIN_PENDIENTES",
      auditoriasEnviadas: 0,
    };

    const idsElegibles = grupo.idsPendientesElegibles;
    if (idsElegibles.length === 0) {
      resultados.push(base);
      continue;
    }

    // Revalidación de correo oficial EN VIVO (reutiliza la función de identidad
    // de Fase 1). Fail-closed: si no hay correo único actual, no se envía.
    const identidad = await revalidarCorreoAsesor(grupo.asesorCodigo);
    if (identidad.estado !== "ELEGIBLE") {
      fallidas++;
      resultados.push({ ...base, accion: "SIN_CORREO_VALIDO", detalle: `Identidad no ELEGIBLE: ${identidad.estado}` });
      continue;
    }

    // Comprueba el snapshot por ciclo (igual que el envío individual): solo se
    // notifican los ciclos cuyo correo_notificacion coincide con el actual.
    const idsCoinciden: { idGestion: string; cicloId: string }[] = [];
    for (const idg of idsElegibles) {
      const c = ciclos.get(idg);
      if (!c) continue;
      const snap = (c.correoSnapshot ?? "").trim().toLowerCase();
      if (snap && snap === identidad.correo) idsCoinciden.push({ idGestion: idg, cicloId: c.id });
    }
    if (idsCoinciden.length === 0) {
      fallidas++;
      resultados.push({ ...base, accion: "CORREO_NO_COINCIDE", detalle: "El correo actual no coincide con el registrado al crear el ciclo." });
      continue;
    }

    const nombre = await resolverNombreAsesor(grupo.asesorCodigo);
    const { destino, modoPrueba } = correoDeEnvio(identidad.correo);
    const url = `${appUrl()}/modulos/metricas?seccion=auditorias`;
    const html = correoLoteAuditorias(nombre, url, idsCoinciden.length, fechaLabel);

    let envio;
    try {
      envio = await enviarCorreoIndividual(destino, `Tienes ${idsCoinciden.length} auditoría(s) de calidad por revisar`, html);
    } catch (e) {
      fallidas++;
      resultados.push({ ...base, accion: "FALLO_ENVIO", detalle: e instanceof Error ? e.message : String(e) });
      continue;
    }
    if (!envio.aceptado) {
      fallidas++;
      // Registra el fallo por ciclo sin cambiar estado.
      for (const { cicloId } of idsCoinciden) {
        await supabase.from("evento_ciclo").insert({
          ciclo_id: cicloId,
          tipo_evento: "notificacion_fallida",
          origen: "automatico",
          actor: null,
          detalle: { motivo: `SMTP no aceptó: ${envio.respuestaServidor ?? "sin respuesta"}`, lote: true, timestamp: new Date().toISOString() },
        });
      }
      resultados.push({ ...base, accion: "FALLO_ENVIO", detalle: `SMTP no aceptó el destinatario.` });
      continue;
    }

    // Correo aceptado: marca cada ciclo CREADA->NOTIFICADA (condicional) + evento.
    let marcadas = 0;
    for (const { idGestion, cicloId } of idsCoinciden) {
      const { data: actualizado, error: errUpd } = await supabase
        .from("ciclo_auditoria")
        .update({ estado: "NOTIFICADA" })
        .eq("id", cicloId)
        .eq("estado", "CREADA")
        .select("id")
        .maybeSingle();
      if (errUpd) {
        await supabase.from("evento_ciclo").insert({
          ciclo_id: cicloId, tipo_evento: "notificacion_fallida", origen: "automatico", actor: null,
          detalle: { motivo: `update: ${errUpd.message}`, lote: true, timestamp: new Date().toISOString() },
        });
        continue;
      }
      if (!actualizado) continue; // ya estaba notificada (carrera); no se re-cuenta
      await supabase.from("evento_ciclo").insert({
        ciclo_id: cicloId,
        tipo_evento: "notificacion_enviada",
        origen: "automatico",
        actor: null,
        detalle: {
          destinatario: identidad.correo,
          destinatario_envio_real: destino,
          modo_prueba: modoPrueba,
          tipo_notificacion: "lote_auditorias",
          id_gestion: idGestion,
          lote_total: idsCoinciden.length,
          fecha_lote: fechaLabel,
          message_id: envio.messageId,
          timestamp: new Date().toISOString(),
        },
      });
      marcadas++;
    }

    auditoriasNotificadas += marcadas;
    if (marcadas > 0) asesorasNotificadas++;
    resultados.push({ ...base, accion: marcadas > 0 ? "NOTIFICADA" : "SIN_PENDIENTES", auditoriasEnviadas: marcadas });
  }

  return {
    fecha,
    asesorasProcesadas: resumen.grupos.length,
    asesorasNotificadas,
    auditoriasNotificadas,
    fallidas,
    resultados,
  };
}
