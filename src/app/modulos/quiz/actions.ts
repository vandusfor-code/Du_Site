"use server";

import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import {
  crearCurso,
  listarCursos,
  activarCurso,
  eliminarCurso,
  obtenerResultadosCurso,
  listarBase,
  crearTemaBase,
  eliminarTemaBase,
  obtenerLeaderboard,
  obtenerPanelCursos,
  abrirCurso,
  iniciarExamen,
  verificarRespuesta,
  finalizarExamen,
  obtenerMiProgreso,
  type CrearCursoInput,
  type CursoResumen,
  type FilaResultadoCurso,
  type TemaBase,
  type LeaderboardEntry,
  type PanelCursos,
  type CursoDetalle,
  type ExamenParaPresentar,
  type ResultadoExamen,
} from "@/lib/duacademy-cursos";
import type { Letra } from "@/lib/evaluaciones-tipos";

async function requireSesion() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  return session;
}
async function requireGestion() {
  const session = await requireSesion();
  if (!esAdminOCoordinadora(session)) throw new Error("No autorizado");
  return session;
}

/* ── Admin ── */

export async function crearCursoAction(input: Omit<CrearCursoInput, "creadoPor">): Promise<{ ok: true; id: string; numPreguntas: number } | { ok: false; error: string }> {
  const session = await requireGestion();
  return crearCurso({ ...input, creadoPor: session.user.nombre });
}
export async function listarCursosAction(): Promise<CursoResumen[]> {
  await requireGestion();
  return listarCursos();
}
export async function activarCursoAction(id: string, activo: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireGestion();
  return activarCurso(id, activo);
}
export async function eliminarCursoAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireGestion();
  return eliminarCurso(id);
}
export async function obtenerResultadosCursoAction(id: string): Promise<FilaResultadoCurso[]> {
  await requireGestion();
  return obtenerResultadosCurso(id);
}
export async function listarBaseAction(): Promise<TemaBase[]> {
  await requireGestion();
  return listarBase();
}
export async function crearTemaBaseAction(tema: string, info: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireGestion();
  return crearTemaBase(tema, info);
}
export async function eliminarTemaBaseAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireGestion();
  return eliminarTemaBase(id);
}
export async function obtenerLeaderboardAction(): Promise<LeaderboardEntry[]> {
  await requireGestion();
  return obtenerLeaderboard();
}

/* ── Asesora ── */

export async function obtenerPanelCursosAction(): Promise<PanelCursos> {
  const session = await requireSesion();
  return obtenerPanelCursos(session.user.usuario);
}
export async function abrirCursoAction(cursoId: string): Promise<{ ok: true; data: CursoDetalle } | { ok: false; error: string }> {
  const session = await requireSesion();
  return abrirCurso(session.user.usuario, cursoId);
}
export async function iniciarExamenAction(cursoId: string): Promise<{ ok: true; data: ExamenParaPresentar } | { ok: false; error: string }> {
  const session = await requireSesion();
  return iniciarExamen(session.user.usuario, cursoId);
}
export async function verificarRespuestaAction(cursoId: string, idPregunta: string, letra: Letra): Promise<{ ok: true; correcta: boolean; letraCorrecta: Letra } | { ok: false; error: string }> {
  await requireSesion();
  return verificarRespuesta(cursoId, idPregunta, letra);
}
export async function finalizarExamenAction(cursoId: string, respuestas: Record<string, Letra>): Promise<{ ok: true; data: ResultadoExamen } | { ok: false; error: string }> {
  const session = await requireSesion();
  return finalizarExamen(session.user.usuario, cursoId, respuestas);
}
export async function obtenerMiProgresoAction(): Promise<{ completados: number; aprobados: number; promedio: number; racha: number }> {
  const session = await requireSesion();
  return obtenerMiProgreso(session.user.usuario);
}
