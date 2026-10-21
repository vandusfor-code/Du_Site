import "server-only";
import { getSupabase } from "./supabase";
import { sumarDiasHabiles } from "./dias-habiles-colombia";
import { estadoTrasAcuse, type EstadoCicloEnvio } from "./envio-auditorias-tipos";

// ============================================================
// ACUSE y COMPROMISO del ciclo (las transiciones que faltaban).
//
// Completa el flujo: NOTIFICADA -> (acuse) -> COMPROMISO_PENDIENTE | ACUSADA
// -> (compromiso) -> EN_SEGUIMIENTO. Reutiliza ciclo_auditoria / evento_ciclo /
// compromiso ya existentes (migración 0003) — NO crea tablas ni columnas.
//
// Toda operación:
//  - recibe la IDENTIDAD de la asesora resuelta desde la SESIÓN del servidor
//    (nunca de la URL ni del navegador) y verifica propiedad del ciclo;
//  - es idempotente mediante UPDATE condicional (WHERE estado esperado) +
//    .select().maybeSingle(), igual que notificacion-por-enviar.ts y
//    verificarCumplimiento();
//  - registra su evento en el historial.
//
// Fuente autoritativa del ciclo de seguimiento = Supabase. El registro en la
// hoja Compromisos (metricas.ts) se conserva como ESPEJO para las vistas
// actuales de la asesora; ante discrepancia, Supabase manda. Ver
// docs/envio-auditorias.md.
// ============================================================

const DIAS_HABILES_COMPROMISO_POR_DEFECTO = 5;

export interface ResultadoTransicion {
  aplicado: boolean; // false si la solicitud llegó tarde (ya estaba en el estado destino)
  estado: EstadoCicloEnvio;
  detalle?: string;
}

interface CicloMinimo {
  id: string;
  estado: EstadoCicloEnvio;
  asesor_codigo: string;
  requiere_compromiso: boolean;
}

async function cargarCicloDeAsesora(idGestion: string, asesorCodigoSesion: string): Promise<CicloMinimo> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ciclo_auditoria")
    .select("id, estado, asesor_codigo, requiere_compromiso")
    .eq("id_gestion", idGestion)
    .maybeSingle();
  if (error) throw new Error(`Supabase (ciclo_auditoria): ${error.message}`);
  if (!data) throw new Error(`No existe ciclo para id_gestion=${idGestion}`);
  const ciclo = data as CicloMinimo;

  // Propiedad: el ciclo debe pertenecer a la asesora autenticada. Comparación
  // en servidor; nunca se confía en un código enviado por el cliente.
  if ((ciclo.asesor_codigo ?? "").trim().toUpperCase() !== (asesorCodigoSesion ?? "").trim().toUpperCase()) {
    throw new Error("No autorizado: esta auditoría no pertenece a la asesora autenticada.");
  }
  return ciclo;
}

/**
 * Acuse de recibo. NOTIFICADA -> COMPROMISO_PENDIENTE (si requiere compromiso)
 * o -> ACUSADA (si no). Registra fecha_acuse (hora del servidor) + evento.
 * Idempotente: si ya fue acusada, devuelve aplicado=false con el estado actual.
 */
export async function registrarAcuse(idGestion: string, asesorCodigoSesion: string): Promise<ResultadoTransicion> {
  const supabase = getSupabase();
  const ciclo = await cargarCicloDeAsesora(idGestion, asesorCodigoSesion);

  if (ciclo.estado !== "NOTIFICADA") {
    // Ya acusada (o más allá), o aún no notificada. No es error; refleja realidad.
    return { aplicado: false, estado: ciclo.estado, detalle: `El ciclo no está NOTIFICADA (actual: ${ciclo.estado}).` };
  }

  const destino = estadoTrasAcuse(ciclo.requiere_compromiso);
  const ahoraIso = new Date().toISOString();

  const { data: actualizado, error: errUpd } = await supabase
    .from("ciclo_auditoria")
    .update({ estado: destino, fecha_acuse: ahoraIso })
    .eq("id", ciclo.id)
    .eq("estado", "NOTIFICADA") // gate de concurrencia
    .select("id")
    .maybeSingle();
  if (errUpd) throw new Error(`Supabase (update acuse): ${errUpd.message}`);

  if (!actualizado) {
    // Otra solicitud ganó la carrera: relee y devuelve el estado real.
    const { data: actual } = await supabase.from("ciclo_auditoria").select("estado").eq("id", ciclo.id).maybeSingle();
    return { aplicado: false, estado: ((actual?.estado as EstadoCicloEnvio) ?? ciclo.estado) };
  }

  const { error: errEvento } = await supabase.from("evento_ciclo").insert({
    ciclo_id: ciclo.id,
    tipo_evento: "acuse_registrado",
    origen: "asesora",
    actor: asesorCodigoSesion,
    detalle: { fecha_acuse: ahoraIso, estado_resultante: destino },
  });
  if (errEvento) throw new Error(`Supabase (evento acuse_registrado): ${errEvento.message}`);

  return { aplicado: true, estado: destino };
}

async function diasHabilesCompromiso(): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase.from("configuracion_ciclo").select("dias_habiles_compromiso").maybeSingle();
  const n = (data as { dias_habiles_compromiso?: number } | null)?.dias_habiles_compromiso;
  return typeof n === "number" && n > 0 ? n : DIAS_HABILES_COMPROMISO_POR_DEFECTO;
}

/**
 * Registro del compromiso de mejora, ligado inequívocamente a su auditoría.
 * COMPROMISO_PENDIENTE -> EN_SEGUIMIENTO. Crea la fila `compromiso` (PENDIENTE)
 * con fecha_prometida calculada por días hábiles. Idempotente mediante el
 * UPDATE condicional del estado (gate); compensa si el insert falla.
 */
export async function registrarCompromisoCiclo(
  idGestion: string,
  asesorCodigoSesion: string,
  textoCompromiso: string
): Promise<ResultadoTransicion> {
  const supabase = getSupabase();
  const texto = (textoCompromiso ?? "").trim();
  if (!texto) throw new Error("El compromiso no puede estar vacío.");

  const ciclo = await cargarCicloDeAsesora(idGestion, asesorCodigoSesion);
  if (ciclo.estado !== "COMPROMISO_PENDIENTE") {
    return { aplicado: false, estado: ciclo.estado, detalle: `El ciclo no está COMPROMISO_PENDIENTE (actual: ${ciclo.estado}).` };
  }

  // Gate de concurrencia: solo una solicitud mueve COMPROMISO_PENDIENTE->EN_SEGUIMIENTO.
  const { data: reclamado, error: errClaim } = await supabase
    .from("ciclo_auditoria")
    .update({ estado: "EN_SEGUIMIENTO" })
    .eq("id", ciclo.id)
    .eq("estado", "COMPROMISO_PENDIENTE")
    .select("id")
    .maybeSingle();
  if (errClaim) throw new Error(`Supabase (claim compromiso): ${errClaim.message}`);
  if (!reclamado) {
    const { data: actual } = await supabase.from("ciclo_auditoria").select("estado").eq("id", ciclo.id).maybeSingle();
    return { aplicado: false, estado: ((actual?.estado as EstadoCicloEnvio) ?? ciclo.estado) };
  }

  const dias = await diasHabilesCompromiso();
  const ahora = new Date();
  const fechaPrometida = sumarDiasHabiles(ahora, dias).toISOString();

  const { error: errInsert } = await supabase.from("compromiso").insert({
    ciclo_id: ciclo.id,
    texto_compromiso: texto,
    fecha_registro: ahora.toISOString(),
    registrado_por: asesorCodigoSesion,
    fecha_prometida_original: fechaPrometida,
    fecha_prometida: fechaPrometida,
    cumplimiento: "PENDIENTE",
  });
  if (errInsert) {
    // Compensa: devuelve el ciclo a COMPROMISO_PENDIENTE para no dejarlo
    // EN_SEGUIMIENTO sin fila de compromiso (estado inconsistente).
    await supabase.from("ciclo_auditoria").update({ estado: "COMPROMISO_PENDIENTE" }).eq("id", ciclo.id).eq("estado", "EN_SEGUIMIENTO");
    throw new Error(`Supabase (insert compromiso): ${errInsert.message}`);
  }

  const { error: errEvento } = await supabase.from("evento_ciclo").insert({
    ciclo_id: ciclo.id,
    tipo_evento: "compromiso_registrado",
    origen: "asesora",
    actor: asesorCodigoSesion,
    detalle: { fecha_prometida: fechaPrometida, dias_habiles: dias },
  });
  if (errEvento) throw new Error(`Supabase (evento compromiso_registrado): ${errEvento.message}`);

  return { aplicado: true, estado: "EN_SEGUIMIENTO" };
}
