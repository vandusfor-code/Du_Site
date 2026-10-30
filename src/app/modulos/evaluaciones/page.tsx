import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import { listarQuizzes, type QuizResumen } from "@/lib/evaluaciones";
import EvaluacionesAdmin from "./EvaluacionesAdmin";
import EvaluacionesAsesora from "./EvaluacionesAsesora";

export const maxDuration = 60;

// Misma URL, dos experiencias por rol: Admin/Coordinadora → panel de gestión;
// Asesora → presentar sus evaluaciones.
export default async function EvaluacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Evaluaciones es UNIVERSAL: toda persona autenticada puede entrar. Admin y
  // Coordinadora ven el panel de gestión; el resto presenta sus evaluaciones.
  const gestion = esAdminOCoordinadora(session);

  if (gestion) {
    let quizzes: QuizResumen[] = [];
    let error: string | null = null;
    try {
      quizzes = await listarQuizzes();
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudieron cargar las evaluaciones";
    }
    return <EvaluacionesAdmin nombre={session.user.nombre} quizzesIniciales={quizzes} errorInicial={error} />;
  }

  return <EvaluacionesAsesora nombre={session.user.nombre} />;
}
