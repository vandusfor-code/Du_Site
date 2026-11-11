"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import {
  procesarTranscripciones,
  generarResumenCortes,
  cargarTranscripcionesCsv,
  obtenerDashboardAuditorias,
  obtenerFuncionariosParaSelector,
  guardarAuditoriaManual,
  guardarAuditoriaChatGPT,
  type ResultadoProcesamiento,
  type ResultadoCargaCsv,
  type DashboardAuditorias,
  type DashboardFiltros,
  type FuncionarioOpcion,
  type AuditoriaManualInput,
} from "@/lib/auditorias-admin";
import { obtenerEnvioAuditorias, enviarLoteAuditorias, type ResultadoEnvioLote } from "@/lib/envio-auditorias";
import type { FiltrosEnvio, ResumenEnvio } from "@/lib/envio-auditorias-tipos";

// Corregido: verificaba session.user.modulos.includes("admin") — el
// módulo "admin" es asignable a cualquier usuario en Usuarios (es la
// tarjeta "Auditorías" de Home) e independiente de la columna Rol. Eso
// permitía que un usuario sin Rol=Admin invocara estas Server Actions
// reales (ejecutar auditorías con IA, cargar CSVs, generar cortes) si
// llegaba a obtener su referencia. La única fuente oficial del privilegio
// administrativo es esAdmin() (columna Rol).
async function requireAdminAction(): Promise<void> {
  const session = await auth();
  if (!esAdmin(session)) {
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

// Auditoría ChatGPT: valida admin, revalida el asesor seleccionado contra
// Funcionarios y resuelve su correo oficial server-side (ver guardarAuditoriaChatGPT).
// Devuelve el error como DATO (no lo lanza): en producción Next.js oculta el
// mensaje de un error lanzado desde una Server Action y lo reemplaza por uno
// genérico ("An error occurred in the Server Components render…"). Retornándolo,
// el usuario ve el motivo real (p. ej. "Ya existe una auditoría con ese ID").
export type ResultadoGuardadoAuditoria =
  | { ok: true; nota: string; tipoNota: string }
  | { ok: false; error: string };

export async function guardarAuditoriaChatGPTAction(
  input: AuditoriaManualInput
): Promise<ResultadoGuardadoAuditoria> {
  try {
    await requireAdminAction();
    const r = await guardarAuditoriaChatGPT(input);
    return { ok: true, nota: r.nota, tipoNota: r.tipoNota };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la auditoría." };
  }
}

// ── Envío de auditorías por asesora (sección de Auditoría ChatGPT) ──
export async function obtenerEnvioAuditoriasAction(filtros: FiltrosEnvio): Promise<ResumenEnvio> {
  await requireAdminAction();
  return obtenerEnvioAuditorias(filtros);
}

// `asesora` vacío/indefinido = envía las pendientes de TODAS las asesoras de la
// fecha (botón general); con código = solo esa asesora (botón por grupo).
export async function enviarLoteAuditoriasAction(fecha: string, asesora?: string): Promise<ResultadoEnvioLote> {
  await requireAdminAction();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida.");
  return enviarLoteAuditorias(fecha, asesora);
}
