import "server-only";
// Imports relativos (no "@/lib/...") a propósito: este archivo se puede
// ejecutar tanto dentro de Next como directamente con `node` (ver
// scripts/run-adopcion-fase1.ts) para las pruebas de integración de Fase 1.
// Los alias "@/..." solo los resuelve el bundler de Next.
import { readRange } from "./sheets";
import { getSupabase } from "./supabase";
import { resolverIdentidadAsesor, type FilaFuncionario } from "./identidad-ciclo";

// ============================================================
// GESTIÓN DEL CICLO DE AUDITORÍAS — FASE 1
//
// Capa nueva, separada del motor de auditoría (auditorias-admin.ts, al que
// esta librería NUNCA llama ni modifica). Lee Consolidado y Funcionarios de
// Google Sheets, y escribe exclusivamente en Supabase (ciclo_auditoria,
// evento_ciclo). Nunca escribe en Consolidado ni en ninguna hoja.
//
// Alcance de Fase 1: solo "adopción" (detectar auditorías nuevas y crear su
// registro de ciclo en estado CREADA o NO_ELEGIBLE). Las transiciones
// posteriores (notificación, acuse, compromiso, seguimiento, escalamiento)
// se implementan en fases futuras y NO existen todavía en este archivo.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

// Índices de Consolidado relevantes para Fase 1 (mismo layout que usa
// auditorias-admin.ts; no se leen ni tocan las demás columnas).
const COL_ASESOR = 2;
const COL_ID_GESTION = 6;
const COL_TIPO_NOTA = 17;

export type EstadoCiclo =
  | "CREADA"
  | "NOTIFICADA"
  | "ACUSADA"
  | "COMPROMISO_PENDIENTE"
  | "COMPROMISO_REGISTRADO"
  | "EN_SEGUIMIENTO"
  | "CERRADA"
  | "NO_ELEGIBLE";

interface CicloAuditoriaInsert {
  id_gestion: string;
  resultado: string;
  asesor_codigo: string;
  estado: "CREADA" | "NO_ELEGIBLE";
  motivo_no_elegible: string | null;
  correo_notificacion: string | null;
}

export interface ResultadoAdopcion {
  filasConsolidado: number;
  idsGestionUnicos: number;
  yaExistian: number;
  nuevosCreados: number;
  elegibles: number;
  noElegibles: number;
  errores: { idGestion: string; motivo: string }[];
}

export async function adoptarAuditorias(): Promise<ResultadoAdopcion> {
  const id = sheetId();
  const supabase = getSupabase();

  const [consolidadoRaw, funcionariosRaw] = await Promise.all([
    readRange(id, "Consolidado!A2:R", { unformatted: true }),
    readRange(id, "Funcionarios", { unformatted: true }),
  ]);

  const filasConsolidado = consolidadoRaw.filter((r) => texto(r, COL_ID_GESTION).trim());

  // Dedupe por ID Gestión: los duplicados conocidos en Consolidado
  // pertenecen siempre al mismo asesor (verificado en Fase 0), así que
  // cuál de las filas repetidas se use es indiferente para la identidad
  // y el resultado — se conserva la primera y se ignoran las demás.
  const filaPorIdGestion = new Map<string, unknown[]>();
  for (const r of filasConsolidado) {
    const idg = texto(r, COL_ID_GESTION).trim();
    if (!filaPorIdGestion.has(idg)) filaPorIdGestion.set(idg, r);
  }

  const asesoresConsolidado = filasConsolidado.map((r) => texto(r, COL_ASESOR));
  const funcionarios: FilaFuncionario[] = funcionariosRaw
    .slice(1)
    .filter((r) => texto(r, 0).trim())
    .map((r) => ({ codigo: texto(r, 0), correo: texto(r, 1) }));

  const errores: { idGestion: string; motivo: string }[] = [];

  // Resolución de identidad: función pura, sin red — se puede construir en
  // memoria TODA la lista de candidatos antes de tocar Supabase.
  const candidatos: CicloAuditoriaInsert[] = [];
  for (const [idGestion, fila] of filaPorIdGestion) {
    try {
      const asesorRaw = texto(fila, COL_ASESOR);
      const resultado = texto(fila, COL_TIPO_NOTA).trim().toUpperCase(); // "OK" | "PENC"
      const identidad = resolverIdentidadAsesor(asesorRaw, asesoresConsolidado, funcionarios);

      candidatos.push(
        identidad.estado === "ELEGIBLE"
          ? {
              id_gestion: idGestion,
              resultado,
              asesor_codigo: identidad.asesorCodigo,
              estado: "CREADA",
              motivo_no_elegible: null,
              correo_notificacion: identidad.correo,
            }
          : {
              id_gestion: idGestion,
              resultado,
              asesor_codigo: identidad.estado === "SIN_CORREO" ? identidad.asesorCodigo : asesorRaw.trim().toUpperCase(),
              estado: "NO_ELEGIBLE",
              motivo_no_elegible: identidad.estado,
              correo_notificacion: null,
            }
      );
    } catch (e) {
      errores.push({ idGestion, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  // Inserción en lotes (no fila por fila): con ~1000+ auditorías, insertar
  // una a una implicaba miles de idas y vueltas secuenciales a Supabase y
  // superaba el tiempo límite de la función serverless (ERR_CONNECTION_RESET
  // en la primera corrida real). upsert + ignoreDuplicates hace en una sola
  // sentencia SQL lo que antes era un SELECT previo más un INSERT por fila:
  // "INSERT ... ON CONFLICT (id_gestion) DO NOTHING", que además resuelve
  // la carrera de idempotencia a nivel de base de datos sin necesitar el
  // código 23505 explícito. RETURNING (el .select() encadenado) trae SOLO
  // las filas que de verdad se insertaron, nunca las que ya existían.
  const LOTE = 300;
  const insertados: { id: string; estado: string; motivo_no_elegible: string | null }[] = [];
  for (let i = 0; i < candidatos.length; i += LOTE) {
    const lote = candidatos.slice(i, i + LOTE);
    const { data, error } = await supabase
      .from("ciclo_auditoria")
      .upsert(lote, { onConflict: "id_gestion", ignoreDuplicates: true })
      .select("id, estado, motivo_no_elegible");
    if (error) {
      throw new Error(
        `Supabase (upsert ciclo_auditoria): ${error.message || "sin mensaje"} | code=${error.code ?? "?"} details=${error.details ?? "?"} hint=${error.hint ?? "?"}`
      );
    }
    for (const row of data ?? []) insertados.push(row as { id: string; estado: string; motivo_no_elegible: string | null });
  }

  // Eventos solo para lo que de verdad se creó en esta pasada (nunca para
  // lo que ya existía) — también en lotes, por la misma razón de arriba.
  const eventos = insertados.map((c) => ({
    ciclo_id: c.id,
    tipo_evento: c.estado === "NO_ELEGIBLE" ? "auditoria_no_elegible" : "auditoria_creada",
    origen: "automatico" as const,
    detalle: c.estado === "NO_ELEGIBLE" ? { motivo: c.motivo_no_elegible } : null,
  }));

  for (let i = 0; i < eventos.length; i += LOTE) {
    const lote = eventos.slice(i, i + LOTE);
    const { error } = await supabase.from("evento_ciclo").insert(lote);
    if (error) {
      throw new Error(
        `Supabase (insert evento_ciclo): ${error.message || "sin mensaje"} | code=${error.code ?? "?"} details=${error.details ?? "?"} hint=${error.hint ?? "?"}`
      );
    }
  }

  const elegibles = insertados.filter((c) => c.estado !== "NO_ELEGIBLE").length;
  const noElegibles = insertados.filter((c) => c.estado === "NO_ELEGIBLE").length;

  return {
    filasConsolidado: filasConsolidado.length,
    idsGestionUnicos: filaPorIdGestion.size,
    yaExistian: filaPorIdGestion.size - insertados.length,
    nuevosCreados: insertados.length,
    elegibles,
    noElegibles,
    errores,
  };
}
