"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import {
  procesarLoteDocumental,
  registrarHistorialDocumental,
  obtenerDashboardDocumental,
  type LoteResultado,
  type HistorialStats,
} from "@/lib/documental";
import type { DashboardDocumental } from "./tipos";

// Corregido: verificaba el módulo asignable "admin", independiente de la
// columna Rol — ver mismo comentario en src/app/admin/actions.ts. Mismo
// patrón de dos chequeos que requireAdmin() en auth-helpers.ts, necesario
// para que TypeScript pueda angostar session a no-nulo después.
async function requireAdminAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (!esAdmin(session)) throw new Error("No autorizado");
  return session;
}

// Los .xls de la plataforma vienen en windows-1252. Decodifica con detección
// (UTF-8 primero; si hay caracteres de reemplazo, usa windows-1252).
function decodificar(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
}

// Procesa UN lote de registros nuevos. El cliente la llama repetidamente (con el
// mismo archivo + audId) hasta `completado`, para no exceder el límite de tiempo.
export async function subirLoteDocumentalAction(formData: FormData): Promise<LoteResultado> {
  await requireAdminAction();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("No se recibió ningún archivo.");
  const audId = String(formData.get("audId") ?? "");
  const contenido = decodificar(await archivo.arrayBuffer());
  return procesarLoteDocumental(contenido, audId);
}

// Registra una fila de historial de importación con las estadísticas acumuladas.
export async function finalizarImportacionDocumentalAction(
  audId: string,
  archivo: string,
  stats: HistorialStats
): Promise<void> {
  const session = await requireAdminAction();
  await registrarHistorialDocumental(audId, archivo, session.user.nombre, stats);
}

export async function obtenerDashboardDocumentalAction(): Promise<DashboardDocumental> {
  await requireAdminAction();
  return obtenerDashboardDocumental();
}
