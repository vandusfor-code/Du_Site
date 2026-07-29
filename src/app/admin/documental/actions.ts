"use server";

import { auth } from "@/auth";
import { procesarArchivoPqrsf, obtenerDashboardDocumental } from "@/lib/documental";
import type { ResultadoImportacionUI, DashboardDocumental } from "./tipos";

async function requireAdminAction() {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) throw new Error("No autorizado");
  return session;
}

// Los .xls de la plataforma vienen en windows-1252. Decodifica con detección
// (UTF-8 primero; si hay caracteres de reemplazo, usa windows-1252).
function decodificar(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
}

export async function subirArchivoDocumentalAction(formData: FormData): Promise<ResultadoImportacionUI> {
  const session = await requireAdminAction();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("No se recibió ningún archivo.");
  const contenido = decodificar(await archivo.arrayBuffer());
  const r = await procesarArchivoPqrsf(contenido, archivo.name, session.user.nombre);
  return {
    audId: r.audId, archivo: r.archivo, encontrados: r.encontrados, nuevos: r.nuevos, duplicados: r.duplicados,
    procesados: r.procesados, conErrores: r.conErrores, sinNovedades: r.sinNovedades, requierenRevision: r.requierenRevision,
    promedioCalidad: r.promedioCalidad, asesoras: r.asesoras, camposNoGuardados: r.camposNoGuardados,
  };
}

export async function obtenerDashboardDocumentalAction(): Promise<DashboardDocumental> {
  await requireAdminAction();
  return obtenerDashboardDocumental();
}
