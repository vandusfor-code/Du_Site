"use server";

import { auth } from "@/auth";
import {
  obtenerAuditoriasConEstado,
  guardarCompromiso,
  type AuditoriaConEstado,
} from "@/lib/metricas";
import { registrarAcuse, registrarCompromisoCiclo, type ResultadoTransicion } from "@/lib/acuse-compromiso-ciclo";

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

// Acuse de recibo (ciclo de Supabase). La identidad es la de la SESIÓN; el
// servidor verifica que la auditoría pertenece a la asesora. Idempotente.
export async function registrarAcuseAction(idGestion: string): Promise<ResultadoTransicion> {
  const usuario = await usuarioActual();
  return registrarAcuse(idGestion, usuario);
}

// Firma del compromiso de mejora. Supabase es la fuente AUTORITATIVA del ciclo;
// la hoja Compromisos se conserva como ESPEJO (best-effort) para las vistas
// actuales. Si el espejo falla, no se revierte el ciclo (Supabase manda).
export async function firmarCompromisoAction(
  idGestion: string,
  fechaAuditoria: string,
  texto: string
): Promise<ResultadoTransicion> {
  const usuario = await usuarioActual();
  const resultado = await registrarCompromisoCiclo(idGestion, usuario, texto);
  if (resultado.aplicado) {
    try {
      await guardarCompromiso(usuario, idGestion, fechaAuditoria, texto);
    } catch {
      /* espejo best-effort: el ciclo en Supabase ya quedó registrado */
    }
  }
  return resultado;
}
