import "server-only";
import { getSupabase } from "@/lib/supabase";
import type { Letra } from "@/lib/evaluaciones-tipos";

// ============================================================
// Almacenamiento NATIVO de las Evaluaciones (Supabase). Reemplaza las pestañas
// EVAL_QUIZZES / EVAL_PREGUNTAS / EVAL_RESULTADOS de Google Sheets. La lógica
// (parseo, calificación, un intento por asesora) vive en evaluaciones.ts; aquí
// solo se lee y escribe.
// ============================================================

const T_QUIZ = "eval_quizzes";
const T_PREG = "eval_preguntas";
const T_RES = "eval_resultados";

export interface QuizRow {
  id: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  umbral: number;
  numPreguntas: number;
  activo: boolean;
  creadoPor: string;
  creadoEn: string;
}

export interface PreguntaRow {
  num: number;
  idPregunta: string;
  pregunta: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  correcta: Letra;
  explicacion: string;
}

export interface ResultadoRow {
  usuario: string;
  quizId: string;
  fecha: string;
  aciertos: number;
  total: number;
  puntaje: number;
  resultado: string;
  respuestas: Record<string, Letra>;
  falladas: string;
}

/* ── Quizzes ── */

export async function listarQuizzesStore(): Promise<QuizRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_QUIZ)
      .select("id,nombre,descripcion,duracion_min,umbral,num_preguntas,activo,creado_por,creado_en")
      .order("creado_en", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre ?? "").trim() || String(r.id),
      descripcion: String(r.descripcion ?? ""),
      duracionMin: Number(r.duracion_min ?? 5),
      umbral: Number(r.umbral ?? 60),
      numPreguntas: Number(r.num_preguntas ?? 0),
      activo: Boolean(r.activo),
      creadoPor: String(r.creado_por ?? ""),
      creadoEn: String(r.creado_en ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function idsQuizzesStore(): Promise<Set<string>> {
  const quizzes = await listarQuizzesStore();
  return new Set(quizzes.map((q) => q.id));
}

export async function insertarQuizStore(q: {
  id: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  umbral: number;
  numPreguntas: number;
  creadoPor: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_QUIZ).insert({
    id: q.id,
    nombre: q.nombre,
    descripcion: q.descripcion,
    duracion_min: q.duracionMin,
    umbral: q.umbral,
    num_preguntas: q.numPreguntas,
    activo: false,
    creado_por: q.creadoPor,
  });
  if (error) throw new Error(`No se pudo crear el módulo: ${error.message}`);
}

export async function insertarPreguntasStore(
  quizId: string,
  preguntas: PreguntaRow[]
): Promise<void> {
  if (preguntas.length === 0) return;
  const sb = getSupabase();
  const filas = preguntas.map((p) => ({
    quiz_id: quizId,
    num: p.num,
    id_pregunta: p.idPregunta,
    pregunta: p.pregunta,
    opcion_a: p.opcionA,
    opcion_b: p.opcionB,
    opcion_c: p.opcionC,
    opcion_d: p.opcionD,
    correcta: p.correcta,
    explicacion: p.explicacion,
  }));
  const { error } = await sb.from(T_PREG).insert(filas);
  if (error) throw new Error(`No se pudieron guardar las preguntas: ${error.message}`);
}

export async function eliminarQuizStore(quizId: string): Promise<void> {
  const sb = getSupabase();
  // Las preguntas caen por FK on delete cascade; los resultados se borran aparte.
  await sb.from(T_RES).delete().eq("quiz_id", quizId);
  const { error } = await sb.from(T_QUIZ).delete().eq("id", quizId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}

// Devuelve true si el quiz existía y se actualizó.
export async function activarQuizStore(quizId: string, activo: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(T_QUIZ)
    .update({ activo })
    .eq("id", quizId)
    .select("id");
  if (error) throw new Error(`No se pudo actualizar: ${error.message}`);
  return (data ?? []).length > 0;
}

/* ── Preguntas ── */

export async function leerPreguntasStore(quizId: string): Promise<PreguntaRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_PREG)
      .select("num,id_pregunta,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,correcta,explicacion")
      .eq("quiz_id", quizId)
      .order("num", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      num: Number(r.num ?? 0),
      idPregunta: String(r.id_pregunta ?? ""),
      pregunta: String(r.pregunta ?? ""),
      opcionA: String(r.opcion_a ?? ""),
      opcionB: String(r.opcion_b ?? ""),
      opcionC: String(r.opcion_c ?? ""),
      opcionD: String(r.opcion_d ?? ""),
      correcta: String(r.correcta ?? "").trim().toUpperCase() as Letra,
      explicacion: String(r.explicacion ?? ""),
    }));
  } catch {
    return [];
  }
}

/* ── Resultados (un intento por asesora) ── */

function mapResultado(r: Record<string, unknown>): ResultadoRow {
  let respuestas: Record<string, Letra> = {};
  const raw = r.respuestas_json;
  if (raw && typeof raw === "object") respuestas = raw as Record<string, Letra>;
  else if (typeof raw === "string") {
    try { respuestas = JSON.parse(raw || "{}"); } catch { respuestas = {}; }
  }
  return {
    usuario: String(r.usuario ?? ""),
    quizId: String(r.quiz_id ?? ""),
    fecha: String(r.fecha ?? ""),
    aciertos: Number(r.aciertos ?? 0),
    total: Number(r.total ?? 0),
    puntaje: Number(r.puntaje ?? 0),
    resultado: String(r.resultado ?? ""),
    respuestas,
    falladas: String(r.falladas ?? ""),
  };
}

export async function obtenerResultadoStore(usuario: string, quizId: string): Promise<ResultadoRow | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_RES)
      .select("*")
      .eq("usuario", usuario.trim().toUpperCase())
      .eq("quiz_id", quizId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapResultado(data) : null;
  } catch {
    return null;
  }
}

export async function obtenerResultadosDeQuizStore(quizId: string): Promise<ResultadoRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_RES).select("*").eq("quiz_id", quizId);
    if (error) throw error;
    return (data ?? []).map(mapResultado);
  } catch {
    return [];
  }
}

// Guarda el intento (idempotente por usuario+quiz: no sobreescribe si ya existe).
export async function guardarResultadoStore(r: {
  usuario: string;
  quizId: string;
  aciertos: number;
  total: number;
  puntaje: number;
  resultado: string;
  respuestas: Record<string, Letra>;
  falladas: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_RES).upsert(
    {
      usuario: r.usuario.trim().toUpperCase(),
      quiz_id: r.quizId,
      aciertos: r.aciertos,
      total: r.total,
      puntaje: r.puntaje,
      resultado: r.resultado,
      respuestas_json: r.respuestas,
      falladas: r.falladas,
      fecha: new Date().toISOString(),
    },
    { onConflict: "usuario,quiz_id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`No se pudo guardar el resultado: ${error.message}`);
}
