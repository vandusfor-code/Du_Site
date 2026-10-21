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
export async function guardarAuditoriaChatGPTAction(
  input: AuditoriaManualInput
): Promise<{ nota: string; tipoNota: string }> {
  await requireAdminAction();
  return guardarAuditoriaChatGPT(input);
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
