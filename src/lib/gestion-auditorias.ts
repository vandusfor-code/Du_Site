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

  const idsAAdoptar = [...filaPorIdGestion.keys()];
  const errores: { idGestion: string; motivo: string }[] = [];

  // Una sola consulta para saber qué ya tiene ciclo, en vez de una por fila.
  const yaExisten = new Set<string>();
  const LOTE = 500; // Supabase/PostgREST tiene límite práctico de tamaño de .in(); se lotea por seguridad.
  for (let i = 0; i < idsAAdoptar.length; i += LOTE) {
    const lote = idsAAdoptar.slice(i, i + LOTE);
    const { data, error } = await supabase.from("ciclo_auditoria").select("id_gestion").in("id_gestion", lote);
    if (error) throw new Error(`Supabase (select existentes): ${error.message}`);
    for (const row of data ?? []) yaExisten.add((row as { id_gestion: string }).id_gestion);
  }

  let nuevosCreados = 0;
  let elegibles = 0;
  let noElegibles = 0;

  for (const [idGestion, fila] of filaPorIdGestion) {
    if (yaExisten.has(idGestion)) continue;

    try {
      const asesorRaw = texto(fila, COL_ASESOR);
      const resultado = texto(fila, COL_TIPO_NOTA).trim().toUpperCase(); // "OK" | "PENC"
      const identidad = resolverIdentidadAsesor(asesorRaw, asesoresConsolidado, funcionarios);

      const filaInsertar: CicloAuditoriaInsert =
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
            };

      const { data: insertado, error: errInsert } = await supabase
        .from("ciclo_auditoria")
        .insert(filaInsertar)
        .select("id")
        .single();

      if (errInsert) {
        // 23505 = choque contra UNIQUE(id_gestion): otra ejecución concurrente
        // ya creó este ciclo entre el SELECT de arriba y este INSERT. No es un
        // error real — es exactamente el caso de idempotencia bajo carrera.
        if (errInsert.code === "23505") continue;
        throw new Error(errInsert.message);
      }

      const tipoEvento = identidad.estado === "ELEGIBLE" ? "auditoria_creada" : "auditoria_no_elegible";
      const detalle = identidad.estado === "ELEGIBLE" ? null : { motivo: identidad.estado };

      const { error: errEvento } = await supabase.from("evento_ciclo").insert({
        ciclo_id: insertado.id,
        tipo_evento: tipoEvento,
        origen: "automatico",
        detalle,
      });
      if (errEvento) throw new Error(errEvento.message);

      nuevosCreados++;
      if (identidad.estado === "ELEGIBLE") elegibles++;
      else noElegibles++;
    } catch (e) {
      // Un error en una fila no debe abortar la adopción de las demás —
      // se registra explícitamente en vez de fallar en silencio o tumbar
      // todo el proceso por un caso puntual.
      errores.push({ idGestion, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    filasConsolidado: filasConsolidado.length,
    idsGestionUnicos: idsAAdoptar.length,
    yaExistian: yaExisten.size,
    nuevosCreados,
    elegibles,
    noElegibles,
    errores,
  };
}
