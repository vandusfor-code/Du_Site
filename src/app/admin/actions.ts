"use server";

import { auth } from "@/auth";
import {
  procesarTranscripciones,
  generarResumenCortes,
  obtenerEstadoAuditorias,
  cargarTranscripcionesCsv,
  type ResultadoProcesamiento,
  type EstadoAuditorias,
  type ResultadoCargaCsv,
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

export async function obtenerEstadoAuditoriasAction(): Promise<EstadoAuditorias> {
  await requireAdminAction();
  return obtenerEstadoAuditorias();
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
