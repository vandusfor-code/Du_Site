"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { obtenerDetalleRadicaciones, type DetalleRadicaciones } from "@/lib/radicaciones";

// Reagrega el detalle por asesora para un rango de fechas ("yyyy-mm-dd").
// Solo Admin. Si no se pasa rango, usa los últimos 7 días.
export async function filtrarDetalleAction(desde?: string, hasta?: string): Promise<DetalleRadicaciones> {
  const session = await auth();
  if (!session?.user || !esAdmin(session)) {
    return { resumen: { totalRadicadas: 0, pendientes: 0, exitosas: 0, devueltas: 0, sinGestion: 0 }, dias: [], asesoras: [] };
  }
  return obtenerDetalleRadicaciones(session.user.nombre, { desde, hasta });
}
