"use server";

import { auth } from "@/auth";
import {
  obtenerPerfil,
  obtenerDatosCompletos,
  obtenerPreguntas,
  guardarResultado,
  hablarConIA,
  actualizarPingConexion,
  obtenerDatosAdmin,
  asignarModulosUsuario,
  enviarCorreoGeneral,
  obtenerLeaderboard,
  type Perfil,
  type DatosCompletos,
  type Pregunta,
  type MensajeIA,
  type DatosAdmin,
  type LeaderboardEntry,
} from "@/lib/duacademy";

async function perfilActual(): Promise<Perfil> {
  const session = await auth();
  const nombre = session?.user?.nombre;
  if (!nombre) throw new Error("No autenticado");
  const perfil = await obtenerPerfil(nombre);
  if (!perfil) throw new Error("No se encontró tu perfil en DuAcademy");
  return perfil;
}

async function requireAdmin(): Promise<Perfil> {
  const perfil = await perfilActual();
  if (perfil.rol.trim().toLowerCase() !== "admin") {
    throw new Error("No tienes permisos de administrador");
  }
  return perfil;
}

export async function obtenerDatosCompletosAction(): Promise<DatosCompletos | null> {
  const perfil = await perfilActual();
  return obtenerDatosCompletos(perfil.nombre);
}

export async function obtenerLeaderboardAction(): Promise<LeaderboardEntry[]> {
  await perfilActual();
  return obtenerLeaderboard();
}

export async function obtenerPreguntasAction(idCurso: string): Promise<Pregunta[]> {
  await perfilActual();
  return obtenerPreguntas(idCurso);
}

export async function guardarResultadoAction(
  idItem: string,
  nota: number,
  errores = ""
): Promise<void> {
  const perfil = await perfilActual();
  await guardarResultado(perfil.email, idItem, nota, errores);
}

export async function hablarConIAAction(
  mensajeUsuario: string,
  idSimulacion: string,
  historialAnterior: MensajeIA[]
): Promise<string> {
  const perfil = await perfilActual();
  return hablarConIA(mensajeUsuario, idSimulacion, historialAnterior, perfil.email);
}

export async function actualizarPingConexionAction(): Promise<void> {
  const perfil = await perfilActual();
  await actualizarPingConexion(perfil.email);
}

export async function obtenerDatosAdminAction(): Promise<DatosAdmin> {
  await requireAdmin();
  return obtenerDatosAdmin();
}

export async function asignarModulosUsuarioAction(
  email: string,
  cursos: string,
  sims: string
): Promise<boolean> {
  await requireAdmin();
  return asignarModulosUsuario(email, cursos, sims);
}

export async function enviarCorreoGeneralAction(): Promise<{ enviados: number }> {
  await requireAdmin();
  return enviarCorreoGeneral();
}
