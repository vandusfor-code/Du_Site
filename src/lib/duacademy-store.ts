import "server-only";
import { getSupabase } from "@/lib/supabase";
import type { Letra } from "@/lib/evaluaciones-tipos";

// ============================================================
// Almacenamiento NATIVO de DuAcademy (Supabase): cursos, preguntas de examen,
// progreso y base de conocimiento. La lógica vive en duacademy-cursos.ts.
// ============================================================

const T_CURSO = "duacademy_cursos";
const T_PREG = "duacademy_preguntas";
const T_PROG = "duacademy_progreso";
const T_BASE = "duacademy_base";

export interface CursoRow {
  id: string;
  titulo: string;
  descripcion: string;
  contenido: string;
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

export interface ProgresoRow {
  usuario: string;
  cursoId: string;
  nota: number;
  aprobado: boolean;
  fecha: string;
}

export interface BaseRow {
  id: number;
  tema: string;
  info: string;
}

/* ── Cursos ── */

function mapCurso(r: Record<string, unknown>): CursoRow {
  return {
    id: String(r.id),
    titulo: String(r.titulo ?? "").trim() || String(r.id),
    descripcion: String(r.descripcion ?? ""),
    contenido: String(r.contenido ?? ""),
    umbral: Number(r.umbral ?? 60),
    numPreguntas: Number(r.num_preguntas ?? 0),
    activo: Boolean(r.activo),
    creadoPor: String(r.creado_por ?? ""),
    creadoEn: String(r.creado_en ?? ""),
  };
}

export async function listarCursosStore(): Promise<CursoRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_CURSO)
      .select("id,titulo,descripcion,contenido,umbral,num_preguntas,activo,creado_por,creado_en")
      .order("creado_en", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapCurso);
  } catch {
    return [];
  }
}

export async function obtenerCursoStore(cursoId: string): Promise<CursoRow | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_CURSO).select("*").eq("id", cursoId).maybeSingle();
    if (error) throw error;
    return data ? mapCurso(data) : null;
  } catch {
    return null;
  }
}

export async function idsCursosStore(): Promise<Set<string>> {
  const cursos = await listarCursosStore();
  return new Set(cursos.map((c) => c.id));
}

export async function insertarCursoStore(c: {
  id: string;
  titulo: string;
  descripcion: string;
  contenido: string;
  umbral: number;
  numPreguntas: number;
  creadoPor: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_CURSO).insert({
    id: c.id, titulo: c.titulo, descripcion: c.descripcion, contenido: c.contenido,
    umbral: c.umbral, num_preguntas: c.numPreguntas, activo: false, creado_por: c.creadoPor,
  });
  if (error) throw new Error(`No se pudo crear el curso: ${error.message}`);
}

export async function insertarPreguntasStore(cursoId: string, preguntas: PreguntaRow[]): Promise<void> {
  if (preguntas.length === 0) return;
  const sb = getSupabase();
  const filas = preguntas.map((p) => ({
    curso_id: cursoId, num: p.num, id_pregunta: p.idPregunta, pregunta: p.pregunta,
    opcion_a: p.opcionA, opcion_b: p.opcionB, opcion_c: p.opcionC, opcion_d: p.opcionD,
    correcta: p.correcta, explicacion: p.explicacion,
  }));
  const { error } = await sb.from(T_PREG).insert(filas);
  if (error) throw new Error(`No se pudieron guardar las preguntas: ${error.message}`);
}

export async function activarCursoStore(cursoId: string, activo: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.from(T_CURSO).update({ activo }).eq("id", cursoId).select("id");
  if (error) throw new Error(`No se pudo actualizar: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function eliminarCursoStore(cursoId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_CURSO).delete().eq("id", cursoId);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}

/* ── Preguntas ── */

export async function leerPreguntasStore(cursoId: string): Promise<PreguntaRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_PREG)
      .select("num,id_pregunta,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,correcta,explicacion")
      .eq("curso_id", cursoId)
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

/* ── Progreso ── */

function mapProgreso(r: Record<string, unknown>): ProgresoRow {
  return {
    usuario: String(r.usuario ?? ""),
    cursoId: String(r.curso_id ?? ""),
    nota: Number(r.nota ?? 0),
    aprobado: Boolean(r.aprobado),
    fecha: String(r.fecha ?? ""),
  };
}

export async function obtenerProgresoUsuarioStore(usuario: string): Promise<ProgresoRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_PROG).select("*").eq("usuario", usuario.trim().toUpperCase());
    if (error) throw error;
    return (data ?? []).map(mapProgreso);
  } catch {
    return [];
  }
}

export async function obtenerProgresoCursoStore(cursoId: string): Promise<ProgresoRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_PROG).select("*").eq("curso_id", cursoId);
    if (error) throw error;
    return (data ?? []).map(mapProgreso);
  } catch {
    return [];
  }
}

export async function obtenerProgresoUnoStore(usuario: string, cursoId: string): Promise<ProgresoRow | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(T_PROG).select("*")
      .eq("usuario", usuario.trim().toUpperCase()).eq("curso_id", cursoId).maybeSingle();
    if (error) throw error;
    return data ? mapProgreso(data) : null;
  } catch {
    return null;
  }
}

export async function todoElProgresoStore(): Promise<ProgresoRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_PROG).select("*");
    if (error) throw error;
    return (data ?? []).map(mapProgreso);
  } catch {
    return [];
  }
}

export async function guardarProgresoStore(p: {
  usuario: string;
  cursoId: string;
  nota: number;
  aprobado: boolean;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_PROG).upsert(
    {
      usuario: p.usuario.trim().toUpperCase(),
      curso_id: p.cursoId,
      nota: p.nota,
      aprobado: p.aprobado,
      fecha: new Date().toISOString(),
    },
    { onConflict: "usuario,curso_id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`No se pudo guardar el progreso: ${error.message}`);
}

/* ── Base de conocimiento ── */

export async function listarBaseStore(): Promise<BaseRow[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(T_BASE).select("id,tema,info").order("creado_en", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: Number(r.id), tema: String(r.tema ?? ""), info: String(r.info ?? "") }));
  } catch {
    return [];
  }
}

export async function crearBaseStore(tema: string, info: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_BASE).insert({ tema, info });
  if (error) throw new Error(`No se pudo guardar el tema: ${error.message}`);
}

export async function eliminarBaseStore(id: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_BASE).delete().eq("id", id);
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
}
