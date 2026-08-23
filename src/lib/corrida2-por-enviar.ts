import "server-only";
import { readRange } from "./sheets";
import { getSupabase } from "./supabase";

// ============================================================
// CORRIDA 2 REAL — "Por enviar" → requiere_compromiso
//
// Única escritura permitida en esta corrida: ciclo_auditoria.requiere_compromiso
// / requiere_compromiso_detectado_en, y un evento evento_ciclo por ciclo.
// NUNCA escribe en Consolidado, NUNCA cambia estado/resultado/identidad,
// NUNCA envía correos ni dispara nada de notificación/seguimiento — eso
// pertenece a fases futuras que todavía no existen.
//
// Idempotente por diseño: el UPDATE lleva WHERE requiere_compromiso = false,
// así que una segunda ejecución no encuentra nada que actualizar para un
// ciclo ya procesado. Además se verifica que no exista ya un evento
// compromiso_solicitado_por_calidad para ese ciclo antes de insertar uno.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

const COL_ASESOR = 2;
const COL_ID_GESTION = 6;
const COL_POR_ENVIAR = 28; // Columna AC
const LARGO_MAXIMO_ID_GESTION = 500;

type AccionCaso =
  | "REQUIERE_COMPROMISO_ACTIVADO"
  | "YA_ESTABA_ACTIVO_SIN_CAMBIOS"
  | "ESTADO_NO_CONTEMPLADO"
  | "SIN_CICLO";

export interface CasoCorrida2 {
  idGestion: string;
  asesor: string;
  estado: string;
  accion: AccionCaso;
}

export interface ResultadoCorrida2PorEnviar {
  candidatosDetectados: number;
  actualizaciones: number;
  eventosCreados: number;
  yaProcesados: number;
  errores: { idGestion: string; motivo: string }[];
  casos: CasoCorrida2[];
}

export async function ejecutarCorrida2PorEnviar(): Promise<ResultadoCorrida2PorEnviar> {
  const id = sheetId();
  const supabase = getSupabase();

  const consolidadoRaw = await readRange(id, "Consolidado!A2:AC", { unformatted: true });

  const filaPorIdGestion = new Map<string, unknown[]>();
  for (const r of consolidadoRaw) {
    const idg = texto(r, COL_ID_GESTION).trim();
    if (!idg || idg.length > LARGO_MAXIMO_ID_GESTION) continue; // mismo criterio que Fase 1
    if (!filaPorIdGestion.has(idg)) filaPorIdGestion.set(idg, r);
  }

  const idsCandidatos: string[] = [];
  for (const [idGestion, fila] of filaPorIdGestion) {
    const porEnviarNorm = texto(fila, COL_POR_ENVIAR).trim().toUpperCase();
    if (porEnviarNorm === "OK") idsCandidatos.push(idGestion);
  }

  const errores: { idGestion: string; motivo: string }[] = [];
  const casos: CasoCorrida2[] = [];
  let actualizaciones = 0;
  let eventosCreados = 0;
  let yaProcesados = 0;

  for (const idGestion of idsCandidatos) {
    try {
      const fila = filaPorIdGestion.get(idGestion)!;
      const asesor = texto(fila, COL_ASESOR);

      const { data: ciclo, error: errSelect } = await supabase
        .from("ciclo_auditoria")
        .select("id, estado, requiere_compromiso")
        .eq("id_gestion", idGestion)
        .maybeSingle();
      if (errSelect) throw new Error(`select ciclo_auditoria: ${errSelect.message}`);

      if (!ciclo) {
        casos.push({ idGestion, asesor, estado: "SIN_CICLO", accion: "SIN_CICLO" });
        continue;
      }

      // Fase 1 solo produce estos dos estados; cualquier otro es inesperado
      // hoy y se reporta en vez de tocarlo a ciegas.
      if (ciclo.estado !== "CREADA" && ciclo.estado !== "NO_ELEGIBLE") {
        casos.push({ idGestion, asesor, estado: ciclo.estado, accion: "ESTADO_NO_CONTEMPLADO" });
        continue;
      }

      if (ciclo.requiere_compromiso) {
        yaProcesados++;
        casos.push({ idGestion, asesor, estado: ciclo.estado, accion: "YA_ESTABA_ACTIVO_SIN_CAMBIOS" });
        continue;
      }

      // UPDATE condicional: solo aplica si SIGUE en false en este instante.
      // Es lo que hace la corrida idempotente a nivel de base de datos, no
      // solo de lógica de aplicación — una segunda ejecución (o una
      // concurrente) no encuentra fila que cumpla el WHERE.
      const { data: actualizado, error: errUpdate } = await supabase
        .from("ciclo_auditoria")
        .update({
          requiere_compromiso: true,
          requiere_compromiso_detectado_en: new Date().toISOString(),
        })
        .eq("id", ciclo.id)
        .eq("requiere_compromiso", false)
        .select("id")
        .maybeSingle();
      if (errUpdate) throw new Error(`update ciclo_auditoria: ${errUpdate.message}`);

      if (!actualizado) {
        // Cambió entre el SELECT y el UPDATE (ejecución concurrente).
        yaProcesados++;
        casos.push({ idGestion, asesor, estado: ciclo.estado, accion: "YA_ESTABA_ACTIVO_SIN_CAMBIOS" });
        continue;
      }
      actualizaciones++;

      // Defensivo: no crear un segundo evento aunque, por lo que sea, ya
      // exista uno para este ciclo.
      const { data: eventoExistente, error: errCheckEvento } = await supabase
        .from("evento_ciclo")
        .select("id")
        .eq("ciclo_id", ciclo.id)
        .eq("tipo_evento", "compromiso_solicitado_por_calidad")
        .maybeSingle();
      if (errCheckEvento) throw new Error(`select evento_ciclo: ${errCheckEvento.message}`);

      if (!eventoExistente) {
        const { error: errInsertEvento } = await supabase.from("evento_ciclo").insert({
          ciclo_id: ciclo.id,
          tipo_evento: "compromiso_solicitado_por_calidad",
          origen: "automatico",
          actor: null,
          detalle: { fuente_decision: "calidad", campo: "Por enviar", valor: "OK" },
        });
        if (errInsertEvento) throw new Error(`insert evento_ciclo: ${errInsertEvento.message}`);
        eventosCreados++;
      }

      casos.push({ idGestion, asesor, estado: ciclo.estado, accion: "REQUIERE_COMPROMISO_ACTIVADO" });
    } catch (e) {
      errores.push({ idGestion, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    candidatosDetectados: idsCandidatos.length,
    actualizaciones,
    eventosCreados,
    yaProcesados,
    errores,
    casos,
  };
}

export interface VerificacionCasoCorrida2 {
  idGestion: string;
  estado: string;
  requiereCompromiso: boolean;
  requiereCompromisoDetectadoEn: string | null;
  cantidadEventosCompromisoSolicitado: number;
}

// Verifica, leyendo directamente de Supabase, el estado final de cada
// candidato detectado — para no depender de lo que reportó la escritura.
export async function verificarCorrida2PorEnviar(idsGestion: string[]): Promise<VerificacionCasoCorrida2[]> {
  const supabase = getSupabase();
  const resultado: VerificacionCasoCorrida2[] = [];

  for (const idGestion of idsGestion) {
    const { data: ciclo, error: errCiclo } = await supabase
      .from("ciclo_auditoria")
      .select("id, estado, requiere_compromiso, requiere_compromiso_detectado_en")
      .eq("id_gestion", idGestion)
      .maybeSingle();
    if (errCiclo) throw new Error(`select ciclo_auditoria (verificación): ${errCiclo.message}`);
    if (!ciclo) {
      resultado.push({
        idGestion,
        estado: "SIN_CICLO",
        requiereCompromiso: false,
        requiereCompromisoDetectadoEn: null,
        cantidadEventosCompromisoSolicitado: 0,
      });
      continue;
    }

    const { data: eventos, error: errEventos } = await supabase
      .from("evento_ciclo")
      .select("id")
      .eq("ciclo_id", ciclo.id)
      .eq("tipo_evento", "compromiso_solicitado_por_calidad");
    if (errEventos) throw new Error(`select evento_ciclo (verificación): ${errEventos.message}`);

    resultado.push({
      idGestion,
      estado: ciclo.estado,
      requiereCompromiso: ciclo.requiere_compromiso,
      requiereCompromisoDetectadoEn: ciclo.requiere_compromiso_detectado_en,
      cantidadEventosCompromisoSolicitado: (eventos ?? []).length,
    });
  }

  return resultado;
}
