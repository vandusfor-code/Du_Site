"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { aprobarProcedimiento, solicitarCorreccion } from "@/lib/documentacion-editor";
import type { ResultadoAsignacion } from "@/lib/documentacion-tipos";

// Revisión = exclusiva de Admin. Se revalida sesión + rol server-side en cada acción.
async function requireAdminDocumentacion(): Promise<string> {
  const session = await auth();
  if (!session?.user?.modulos.includes("documentacion") || !esAdmin(session)) {
    throw new Error("No autorizado");
  }
  return session.user.nombre || "Revisor";
}

export async function aprobarProcedimientoAction(procedimientoId: string): Promise<ResultadoAsignacion> {
  try {
    await requireAdminDocumentacion();
    return await aprobarProcedimiento(procedimientoId);
  } catch (e) {
    console.error("[documentacion] aprobarProcedimientoAction:", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo aprobar el procedimiento." };
  }
}

export async function solicitarCorreccionAction(
  procedimientoId: string,
  comentario: string
): Promise<ResultadoAsignacion> {
  try {
    const revisor = await requireAdminDocumentacion();
    return await solicitarCorreccion(procedimientoId, comentario, revisor);
  } catch (e) {
    console.error("[documentacion] solicitarCorreccionAction:", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo solicitar la corrección." };
  }
}
