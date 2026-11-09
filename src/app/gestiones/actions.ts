"use server";

import { requireAdminOCoordinadora } from "@/lib/auth-helpers";
import { listarRegistrosRadicacion, eliminarRadicacion, type RegistroRadicacion } from "@/lib/radicaciones";
import { listarRegistrosPQRSF, eliminarPQRSF, type RegistroPQRSF } from "@/lib/lineaAmiga";

export type TipoGestion = "pqrsf" | "radicaciones";

// Recarga el listado (tras eliminar). Solo Admin/Coordinación.
export async function listarGestionesAction(
  tipo: TipoGestion
): Promise<(RegistroRadicacion | RegistroPQRSF)[]> {
  await requireAdminOCoordinadora();
  return tipo === "pqrsf" ? listarRegistrosPQRSF() : listarRegistrosRadicacion();
}

// Elimina un registro por su radicado. Solo Admin/Coordinación. Borra la fila
// ENTERA de la hoja (acción irreversible); por eso la UI pide confirmación.
export async function eliminarGestionAction(
  tipo: TipoGestion,
  radicado: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminOCoordinadora();
  const rad = (radicado ?? "").trim();
  if (!rad) return { ok: false, error: "Radicado vacío" };
  try {
    const borrado = tipo === "pqrsf" ? await eliminarPQRSF(rad) : await eliminarRadicacion(rad);
    return borrado
      ? { ok: true }
      : { ok: false, error: "No se encontró el registro (quizá ya fue eliminado)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar" };
  }
}
