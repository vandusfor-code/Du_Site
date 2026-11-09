"use server";

import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import {
  obtenerDashboardDesempeno,
  obtenerDashboardTodasAreas,
  cerrarMes,
  guardarMetricasDesempeno,
  borrarMetricasDesempeno,
  sincronizarAutomaticas,
  type DashboardDesempeno,
  type DesempenoFiltros,
  type ResultadoCierre,
  type Area,
  type CampoDesempeno,
  type ResultadoGuardarMetricas,
  type ResultadoSincronizar,
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

// Trae TODAS las vistas de área de un mes en una sola llamada (para que el front
// cambie de pestaña al instante). Clave "" = Todos.
export async function obtenerDashboardTodasAreasAction(
  mes?: string
): Promise<{ areas: string[]; vistas: Record<string, DashboardDesempeno> }> {
  await requireGestion();
  return obtenerDashboardTodasAreas(mes);
}

export async function cerrarMesAction(): Promise<ResultadoCierre> {
  await requireGestion();
  return cerrarMes();
}

// Trae las automáticas (PEC/PENC/#auditorías) del mes en curso desde las
// auditorías del Consolidado y las escribe en TO.
export async function sincronizarAutomaticasAction(): Promise<ResultadoSincronizar> {
  await requireGestion();
  return sincronizarAutomaticas();
}

// Guarda las métricas MANUALES editadas de un funcionario en Du Site (Supabase).
// Solo se guardan las manuales del área; las automáticas las calcula la plataforma.
export async function guardarMetricasAction(
  usuario: string,
  area: Area,
  cambios: Partial<Record<CampoDesempeno, string>>
): Promise<ResultadoGuardarMetricas> {
  await requireGestion();
  return guardarMetricasDesempeno(usuario, area, cambios);
}

// Borra las métricas manuales capturadas de un asesor (limpiar datos de prueba).
export async function borrarMetricasAction(usuario: string): Promise<{ ok: boolean; error?: string }> {
  await requireGestion();
  return borrarMetricasDesempeno(usuario);
}
