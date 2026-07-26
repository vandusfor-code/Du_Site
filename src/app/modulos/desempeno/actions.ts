"use server";

import { auth } from "@/auth";
import {
  obtenerDashboardDesempeno,
  cerrarMes,
  type DashboardDesempeno,
  type DesempenoFiltros,
  type ResultadoCierre,
} from "@/lib/desempeno";

async function requireDesempeno(): Promise<void> {
  const session = await auth();
  if (!session?.user?.modulos.includes("desempeno")) {
    throw new Error("No autorizado");
  }
}

export async function obtenerDashboardDesempenoAction(filtros: DesempenoFiltros): Promise<DashboardDesempeno> {
  await requireDesempeno();
  return obtenerDashboardDesempeno(filtros);
}

export async function cerrarMesAction(): Promise<ResultadoCierre> {
  await requireDesempeno();
  return cerrarMes();
}
