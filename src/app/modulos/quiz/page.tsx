import Link from "next/link";
import { requireModulo } from "@/lib/auth-helpers";
import { obtenerPerfil } from "@/lib/duacademy";
import QuizDashboard from "./QuizDashboard";

export default async function QuizPage() {
  const session = await requireModulo("quiz");

  let perfil;
  let error: string | null = null;
  try {
    perfil = await obtenerPerfil(session.user.nombre);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar tu perfil de DuAcademy";
  }

  if (error || !perfil) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-semibold text-red-600">
          {error ? "No se pudo cargar DuAcademy." : "No se encontró tu perfil en DuAcademy."}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {error ?? "Contacta a un administrador para que te registre en la hoja de usuarios de este módulo."}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return <QuizDashboard nombre={perfil.nombre} rol={perfil.rol} />;
}
