"use server";

import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import type { EstadoSNC } from "@/lib/radicaciones-snc-tipos";
import {
  obtenerAsesores,
  guardarRadicacion,
  obtenerResumenHoy,
  obtenerHistorial,
  buscarSNC,
  buscarGeneral,
  marcarSolucionado,
  obtenerNotificaciones,
  marcarRecibido,
  obtenerChat,
  enviarMensajeChat,
  obtenerHorarioHoy,
  verificarHorarios,
  registrarSNC,
  obtenerSNCDeAsesora,
  cambiarEstadoSNC,
  obtenerSNCTodas,
  type Asesor,
  type DatosRadicacion,
  type ResultadoGuardarRadicacion,
  type ResumenHoy,
  type HistorialItem,
  type SncResultado,
  type BusquedaGeneralResultado,
  type Notificacion,
  type MensajeChat,
  type HorarioHoy,
  type ResultadoSNC,
  type SNCDeAsesora,
  type SNCEquipo,
} from "@/lib/radicaciones";

async function usuarioActual(): Promise<{ usuario: string; nombre: string }> {
  const session = await auth();
  const usuario = session?.user?.usuario;
  const nombre = session?.user?.nombre;
  if (!usuario || !nombre) throw new Error("No autenticado");
  return { usuario, nombre };
}

export async function obtenerAsesoresAction(): Promise<Asesor[]> {
  await usuarioActual();
  return obtenerAsesores();
}

export async function guardarRadicacionAction(
  data: DatosRadicacion
): Promise<ResultadoGuardarRadicacion> {
  const { nombre } = await usuarioActual();
  return guardarRadicacion(data, nombre);
}

export async function obtenerResumenHoyAction(): Promise<ResumenHoy> {
  const { nombre } = await usuarioActual();
  return obtenerResumenHoy(nombre);
}

export async function obtenerHistorialAction(): Promise<HistorialItem[]> {
  const { nombre } = await usuarioActual();
  return obtenerHistorial(nombre);
}

export async function buscarSNCAction(radicado: string): Promise<SncResultado | null> {
  await usuarioActual();
  return buscarSNC(radicado);
}

export async function buscarGeneralAction(radicado: string): Promise<BusquedaGeneralResultado | null> {
  await usuarioActual();
  return buscarGeneral(radicado);
}

export async function marcarSolucionadoAction(rowId: number): Promise<void> {
  await usuarioActual();
  await marcarSolucionado(rowId);
}

export async function obtenerNotificacionesAction(): Promise<Notificacion[]> {
  const { nombre } = await usuarioActual();
  return obtenerNotificaciones(nombre);
}

export async function marcarRecibidoAction(id: number): Promise<void> {
  await usuarioActual();
  await marcarRecibido(id);
}

export async function obtenerChatAction(): Promise<MensajeChat[]> {
  const { nombre } = await usuarioActual();
  return obtenerChat(nombre);
}

export async function enviarMensajeChatAction(mensaje: string, destinatario: string): Promise<void> {
  const { nombre } = await usuarioActual();
  await enviarMensajeChat(nombre, mensaje, destinatario);
}

export async function obtenerHorarioHoyAction(): Promise<HorarioHoy | null> {
  const { nombre } = await usuarioActual();
  return obtenerHorarioHoy(nombre);
}

export async function verificarHorariosAction(): Promise<void> {
  const { nombre } = await usuarioActual();
  await verificarHorarios(nombre);
}

/* ── Salidas No Conformes (SNC) ── */

export async function registrarSNCAction(radicado: string, motivo: string, noCorresponde = false): Promise<ResultadoSNC> {
  const { nombre } = await usuarioActual();
  return registrarSNC(nombre, radicado, motivo, "", noCorresponde);
}

export async function obtenerSNCAction(): Promise<SNCDeAsesora> {
  const { nombre } = await usuarioActual();
  return obtenerSNCDeAsesora(nombre);
}

export async function cambiarEstadoSNCAction(fila: number, nuevoEstado: EstadoSNC, nota: string): Promise<ResultadoSNC> {
  const { nombre } = await usuarioActual();
  return cambiarEstadoSNC(fila, nombre, nuevoEstado, nota);
}

/* ── Gestión de SNC (Admin / Coordinadora) ── */

async function gestionActual(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if (!esAdminOCoordinadora(session)) throw new Error("No autorizado");
  return session.user.nombre;
}

export async function obtenerSNCTodasAction(): Promise<SNCEquipo> {
  await gestionActual();
  return obtenerSNCTodas();
}

// Admin/Coordinadora registra una SNC y la asigna a la asesora responsable.
export async function registrarSNCAsignadaAction(asesora: string, radicado: string, motivo: string): Promise<ResultadoSNC> {
  const gestor = await gestionActual();
  return registrarSNC(asesora, radicado, motivo, gestor);
}
