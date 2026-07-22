"use server";

import { auth } from "@/auth";
import {
  guardarPQRSF,
  buscarPQRSF,
  getAgentes,
  getHistorial,
  getMensajes,
  enviarMensaje,
  getNotificaciones,
  marcarNotificacionRecibida,
  buscarSimilitudPQRSF,
  obtenerHorarioHoy,
  verificarHorarios,
  type DatosPQRSF,
  type ResultadoGuardarPQRSF,
  type PQRSFEncontrado,
  type ResultadoHistorial,
  type MensajeChat,
  type Notificacion,
  type SugerenciaPQRSF,
  type HorarioHoy,
} from "@/lib/lineaAmiga";

async function agenteActual(): Promise<string> {
  const session = await auth();
  const nombre = session?.user?.nombre;
  if (!nombre) throw new Error("No autenticado");
  return nombre;
}

export async function guardarPQRSFAction(datos: DatosPQRSF): Promise<ResultadoGuardarPQRSF> {
  const agente = await agenteActual();
  return guardarPQRSF(datos, agente);
}

export async function buscarPQRSFAction(radicado: string): Promise<PQRSFEncontrado | null> {
  await agenteActual();
  return buscarPQRSF(radicado);
}

export async function getAgentesAction(): Promise<string[]> {
  await agenteActual();
  return getAgentes();
}

export async function getHistorialAction(): Promise<ResultadoHistorial> {
  const agente = await agenteActual();
  return getHistorial(agente);
}

export async function getMensajesAction(): Promise<MensajeChat[]> {
  const agente = await agenteActual();
  return getMensajes(agente);
}

export async function enviarMensajeAction(mensaje: string, destinatario: string): Promise<void> {
  const agente = await agenteActual();
  await enviarMensaje(agente, mensaje, destinatario);
}

export async function getNotificacionesAction(): Promise<Notificacion[]> {
  const agente = await agenteActual();
  return getNotificaciones(agente);
}

export async function marcarNotificacionRecibidaAction(id: number): Promise<void> {
  await agenteActual();
  await marcarNotificacionRecibida(id);
}

export async function buscarSimilitudPQRSFAction(texto: string): Promise<SugerenciaPQRSF[]> {
  await agenteActual();
  return buscarSimilitudPQRSF(texto);
}

export async function obtenerHorarioHoyAction(): Promise<HorarioHoy | null> {
  const agente = await agenteActual();
  return obtenerHorarioHoy(agente);
}

export async function verificarHorariosAction(): Promise<void> {
  const agente = await agenteActual();
  await verificarHorarios(agente);
}
