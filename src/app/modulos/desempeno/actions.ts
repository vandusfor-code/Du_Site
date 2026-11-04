"use server";

import { auth } from "@/auth";
import { esAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import {
  obtenerDashboardDesempeno,
  cerrarMes,
  guardarMetricasDesempeno,
  type DashboardDesempeno,
  type DesempenoFiltros,
  type ResultadoCierre,
  type CampoDesempeno,
  type ResultadoGuardarMetricas,
} from "@/lib/desempeno";

async function requireGestion() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if (!esAdminOCoordinadora(session)) throw new Error("No autorizado");
  return session;
}

export async function obtenerDashboardDesempenoAction(filtros: DesempenoFiltros): Promise<DashboardDesempeno> {
  await requireGestion();
  return obtenerDashboardDesempeno(filtros);
}

export async function cerrarMesAction(): Promise<ResultadoCierre> {
  await requireGestion();
  return cerrarMes();
}

// Guarda las métricas editadas de un funcionario. El Coordinador no puede tocar
// los campos automáticos (se filtran en el servidor); el Admin sí.
export async function guardarMetricasAction(
  usuario: string,
  cambios: Partial<Record<CampoDesempeno, string>>
): Promise<ResultadoGuardarMetricas> {
  const session = await requireGestion();
  return guardarMetricasDesempeno(usuario, cambios, esAdmin(session));
}
