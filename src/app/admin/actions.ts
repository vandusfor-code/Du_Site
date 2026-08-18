"use server";

import { auth } from "@/auth";
import {
  procesarTranscripciones,
  generarResumenCortes,
  cargarTranscripcionesCsv,
  obtenerDashboardAuditorias,
  obtenerFuncionariosParaSelector,
  guardarAuditoriaManual,
  type ResultadoProcesamiento,
  type ResultadoCargaCsv,
  type DashboardAuditorias,
  type DashboardFiltros,
  type FuncionarioOpcion,
  type AuditoriaManualInput,
} from "@/lib/auditorias-admin";

async function requireAdminAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    throw new Error("No autorizado");
  }
}

export async function ejecutarAuditoriasAction(): Promise<ResultadoProcesamiento> {
  await requireAdminAction();
  return procesarTranscripciones();
}

export async function generarResumenCortesAction(): Promise<number> {
  await requireAdminAction();
  return generarResumenCortes();
}

export async function cargarTranscripcionesAction(formData: FormData): Promise<ResultadoCargaCsv> {
  await requireAdminAction();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    throw new Error("No se recibió ningún archivo.");
  }
  const contenido = await archivo.text();
  return cargarTranscripcionesCsv(contenido);
}

export async function obtenerDashboardAuditoriasAction(
  filtros: DashboardFiltros
): Promise<DashboardAuditorias> {
  await requireAdminAction();
  return obtenerDashboardAuditorias(filtros);
}

export async function obtenerFuncionariosAction(): Promise<FuncionarioOpcion[]> {
  await requireAdminAction();
  return obtenerFuncionariosParaSelector();
}

export async function guardarAuditoriaManualAction(
  input: AuditoriaManualInput
): Promise<{ nota: string; tipoNota: string }> {
  await requireAdminAction();
  return guardarAuditoriaManual(input);
}
