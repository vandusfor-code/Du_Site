"use server";

import { auth } from "@/auth";
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
