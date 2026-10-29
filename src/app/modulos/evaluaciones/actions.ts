"use server";

import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import {
  crearQuiz,
  listarQuizzes,
  activarQuiz,
  obtenerResultadosQuiz,
  avisarEvaluaciones,
  obtenerPanelAsesora,
  iniciarQuizAsesora,
  verificarRespuestaAsesora,
  finalizarQuizAsesora,
  obtenerRevisionAsesora,
  type CrearQuizInput,
  type QuizResumen,
  type FilaResultado,
  type PanelAsesora,
  type QuizParaPresentar,
  type ResultadoPresentacion,
  type RevisionAsesora,
} from "@/lib/evaluaciones";
import type { Letra } from "@/lib/evaluaciones-tipos";

type Resultado = { ok: true; id?: string; numPreguntas?: number } | { ok: false; error: string };

async function requireGestion() {
  const session = await auth();
  if (!esAdminOCoordinadora(session)) throw new Error("No autorizado");
  return session!;
}

export async function listarQuizzesAction(): Promise<QuizResumen[]> {
  await requireGestion();
  return listarQuizzes();
}

export async function crearQuizAction(input: Omit<CrearQuizInput, "creadoPor">): Promise<Resultado> {
  const session = await requireGestion();
  return crearQuiz({ ...input, creadoPor: session.user.nombre });
}

export async function activarQuizAction(quizId: string, activo: boolean): Promise<Resultado> {
  await requireGestion();
  return activarQuiz(quizId, activo);
}

export async function obtenerResultadosQuizAction(quizId: string): Promise<FilaResultado[]> {
  await requireGestion();
  return obtenerResultadosQuiz(quizId);
}

export async function avisarEvaluacionesAction(): Promise<{ enviados: number }> {
  await requireGestion();
  return avisarEvaluaciones();
}

// ── Lado asesora (presentar). Identidad = sesión del servidor. ──
async function requireUsuario(): Promise<string> {
  const session = await auth();
  const usuario = session?.user?.usuario;
  if (!usuario) throw new Error("No autenticado");
  // Debe tener el módulo asignado, o ser Admin/Coordinadora (para probar).
  if (!session!.user.modulos.includes("evaluaciones") && !esAdminOCoordinadora(session)) {
    throw new Error("No autorizado");
  }
  return usuario;
}

export async function obtenerPanelAsesoraAction(): Promise<PanelAsesora> {
  const usuario = await requireUsuario();
  return obtenerPanelAsesora(usuario);
}

export async function iniciarQuizAction(quizId: string): Promise<{ ok: true; data: QuizParaPresentar } | { ok: false; error: string }> {
  const usuario = await requireUsuario();
  return iniciarQuizAsesora(usuario, quizId);
}

export async function verificarRespuestaAction(quizId: string, idPregunta: string, letra: Letra): Promise<{ ok: true; correcta: boolean; letraCorrecta: Letra } | { ok: false; error: string }> {
  await requireUsuario();
  return verificarRespuestaAsesora(quizId, idPregunta, letra);
}

export async function finalizarQuizAction(quizId: string, respuestas: Record<string, Letra>): Promise<{ ok: true; data: ResultadoPresentacion } | { ok: false; error: string }> {
  const usuario = await requireUsuario();
  return finalizarQuizAsesora(usuario, quizId, respuestas);
}

export async function obtenerRevisionAction(quizId: string): Promise<{ ok: true; data: RevisionAsesora } | { ok: false; error: string }> {
  const usuario = await requireUsuario();
  return obtenerRevisionAsesora(usuario, quizId);
}
