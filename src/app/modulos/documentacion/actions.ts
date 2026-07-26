"use server";

import { auth } from "@/auth";
import {
  obtenerDashboardDocumentacion,
  obtenerAplicativosActivos,
  obtenerAsesorasDoc,
  crearProcedimientoYAsignacion,
} from "@/lib/documentacion";
import type {
  DashboardDocumentacion,
  AplicativoOpcion,
  AsesoraOpcion,
  NuevaAsignacionInput,
  ResultadoAsignacion,
} from "@/lib/documentacion-tipos";

async function requireDocumentacion(): Promise<string> {
  const session = await auth();
  if (!session?.user?.modulos.includes("documentacion")) {
    throw new Error("No autorizado");
  }
  return session.user.nombre || "Sistema";
}

export async function obtenerDashboardDocumentacionAction(): Promise<DashboardDocumentacion> {
  await requireDocumentacion();
  return obtenerDashboardDocumentacion();
}

export async function obtenerAplicativosActivosAction(): Promise<AplicativoOpcion[]> {
  await requireDocumentacion();
  return obtenerAplicativosActivos();
}

export async function obtenerAsesorasAction(): Promise<AsesoraOpcion[]> {
  await requireDocumentacion();
  return obtenerAsesorasDoc();
}

export async function crearProcedimientoYAsignacionAction(
  input: NuevaAsignacionInput
): Promise<ResultadoAsignacion> {
  const usuario = await requireDocumentacion();
  return crearProcedimientoYAsignacion(input, usuario);
}
