"use server";

import { requireModuloOAdmin } from "@/lib/auth-helpers";
import { obtenerSeguimientoResumen, type FiltrosSeguimiento, type FilaSeguimiento, type KpisSeguimiento } from "@/lib/seguimiento-resumen";

export async function obtenerSeguimientoAction(
  filtros: FiltrosSeguimiento
): Promise<{ kpis: KpisSeguimiento; filas: FilaSeguimiento[] }> {
  await requireModuloOAdmin("calidad");
  return obtenerSeguimientoResumen(filtros);
}
