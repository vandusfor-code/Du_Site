import { requireModulo, esAdminOCoordinadora } from "@/lib/auth-helpers";
import { listarCursos, type CursoResumen } from "@/lib/duacademy-cursos";
import DuAcademyAdmin from "./DuAcademyAdmin";
import DuAcademyAsesora from "./DuAcademyAsesora";

export const maxDuration = 60;

// DuAcademy NATIVO (Supabase). Misma URL, dos experiencias por rol:
// Admin/Coordinadora → gestionar cursos; Asesora → estudiar y presentar.
export default async function QuizPage() {
  const session = await requireModulo("quiz");

  if (esAdminOCoordinadora(session)) {
    let cursos: CursoResumen[] = [];
    let error: string | null = null;
    try {
      cursos = await listarCursos();
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudieron cargar los cursos";
    }
    return <DuAcademyAdmin nombre={session.user.nombre} cursosIniciales={cursos} errorInicial={error} />;
  }

  return <DuAcademyAsesora nombre={session.user.nombre} />;
}
