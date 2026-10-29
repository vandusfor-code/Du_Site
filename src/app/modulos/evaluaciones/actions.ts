"use server";

import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import {
  crearQuiz,
  listarQuizzes,
  activarQuiz,
  obtenerResultadosQuiz,
  avisarEvaluaciones,
  type CrearQuizInput,
  type QuizResumen,
  type FilaResultado,
} from "@/lib/evaluaciones";

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
