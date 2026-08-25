"use server";

import { requireModuloOAdmin } from "@/lib/auth-helpers";
import {
  obtenerPanelCalidad,
  obtenerKPIsPanelCalidad,
  obtenerDetalleAuditoriaCalidad,
  verificarCumplimiento,
  type FiltrosPanelCalidad,
  type ResultadoPanelCalidad,
  type KPIsPanelCalidad,
  type DetalleAuditoriaCalidad,
  type ResultadoVerificacion,
  type ResultadoVerificarCumplimiento,
} from "@/lib/gestion-calidad";

// Etapa 2 — solo lectura.

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

// Etapa 3 — única Server Action de esta fase que escribe en Supabase.
// Autorización: Admin O módulo calidad (mismo helper que el resto del
// módulo). La idempotencia real vive en verificarCumplimiento() (UPDATE
// condicional); aquí solo se valida la regla de negocio de la observación
// obligatoria para INCUMPLIDO, en defensa además del control ya existente
// en la UI (el botón "Confirmar" del modal queda deshabilitado sin ella).
export async function verificarCumplimientoAction(
  idGestion: string,
  resultado: ResultadoVerificacion,
  observacion: string
): Promise<ResultadoVerificarCumplimiento> {
  const session = await requireModuloOAdmin("calidad");

  const observacionLimpia = observacion.trim();
  if (resultado === "INCUMPLIDO" && !observacionLimpia) {
    throw new Error("La observación es obligatoria para marcar un compromiso como INCUMPLIDO.");
  }

  const verificadoPor = session.user.usuario || session.user.nombre || "desconocido";
  return verificarCumplimiento(idGestion, resultado, observacionLimpia, verificadoPor);
}
