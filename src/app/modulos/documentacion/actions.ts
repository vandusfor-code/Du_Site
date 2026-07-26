"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
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

// Todas estas acciones son administrativas (dashboard + asignación). Requieren
// módulo documentacion Y Rol = Admin, comprobado server-side: una asesora no
// puede invocarlas manualmente aunque el modal no se le muestre.
async function requireDocumentacionAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.modulos.includes("documentacion")) {
    throw new Error("No autorizado");
  }
  if (!esAdmin(session)) {
    throw new Error("No autorizado");
  }
  return session.user.nombre || "Sistema";
}

export async function obtenerDashboardDocumentacionAction(): Promise<DashboardDocumentacion> {
  await requireDocumentacionAdmin();
  return obtenerDashboardDocumentacion();
}

export async function obtenerAplicativosActivosAction(): Promise<AplicativoOpcion[]> {
  await requireDocumentacionAdmin();
  return obtenerAplicativosActivos();
}

export async function obtenerAsesorasAction(): Promise<AsesoraOpcion[]> {
  await requireDocumentacionAdmin();
  return obtenerAsesorasDoc();
}

export async function crearProcedimientoYAsignacionAction(
  input: NuevaAsignacionInput
): Promise<ResultadoAsignacion> {
  const usuario = await requireDocumentacionAdmin();
  return crearProcedimientoYAsignacion(input, usuario);
}
