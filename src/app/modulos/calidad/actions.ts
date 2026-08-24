"use server";

import { requireModuloOAdmin } from "@/lib/auth-helpers";
import {
  obtenerPanelCalidad,
  obtenerKPIsPanelCalidad,
  obtenerDetalleAuditoriaCalidad,
  type FiltrosPanelCalidad,
  type ResultadoPanelCalidad,
  type KPIsPanelCalidad,
  type DetalleAuditoriaCalidad,
} from "@/lib/gestion-calidad";

// Etapa 2 — solo lectura. Ninguna Server Action de esta fase escribe en
// Supabase; verificar cumplimiento es la siguiente etapa.

export async function cargarPanelCalidadAction(
  filtros: FiltrosPanelCalidad,
  pagina: number
): Promise<ResultadoPanelCalidad> {
  await requireModuloOAdmin("calidad");
  return obtenerPanelCalidad(filtros, pagina);
}

export async function cargarKPIsCalidadAction(): Promise<KPIsPanelCalidad> {
  await requireModuloOAdmin("calidad");
  return obtenerKPIsPanelCalidad();
}

export async function cargarDetalleAuditoriaCalidadAction(idGestion: string): Promise<DetalleAuditoriaCalidad> {
  await requireModuloOAdmin("calidad");
  return obtenerDetalleAuditoriaCalidad(idGestion);
}
