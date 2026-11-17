"use server";

import { auth } from "@/auth";
import { firmarResumenDiario } from "@/lib/resumen-diario";

// Firma única del resumen del día. La identidad sale de la SESIÓN (server-side),
// nunca del navegador: la asesora solo firma lo suyo.
export async function firmarMiResumenAction(
  fecha: string,
  compromiso: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const nombre = session?.user?.nombre;
  if (!nombre) return { ok: false, error: "No autorizado." };
  return firmarResumenDiario(nombre, fecha, compromiso);
}
