"use server";

import { auth } from "@/auth";
import {
  obtenerAuditoriasConEstado,
  guardarCompromiso,
  type AuditoriaConEstado,
} from "@/lib/metricas";

async function usuarioActual(): Promise<string> {
  const session = await auth();
  const usuario = session?.user?.usuario;
  if (!usuario) throw new Error("No autenticado");
  return usuario;
}

export async function cargarAuditoriasAction(): Promise<AuditoriaConEstado[]> {
  const usuario = await usuarioActual();
  return obtenerAuditoriasConEstado(usuario);
}

export async function guardarCompromisoAction(
  idGestion: string,
  fechaAuditoria: string,
  comentario: string
): Promise<"OK" | "YA_EXISTE" | "ERROR"> {
  const usuario = await usuarioActual();
  return guardarCompromiso(usuario, idGestion, fechaAuditoria, comentario);
}
