"use server";

import { auth } from "@/auth";
import { esAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import { parsearPdfPila } from "@/lib/empleo/pila-parser";
import { validarPila } from "@/lib/empleo/pila-motor";
import type { TipoTrabajador, ResultadoValidacion, MetaTrabajador, ConfigReglas } from "@/lib/empleo/pila-tipos";
import { obtenerConfigReglas, guardarConfigReglas, observacionAutomatica } from "@/lib/empleo/empleo-store";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

async function requireAcceso() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if (!esAdmin(session) && !session.user.modulos.includes("gestion-empleo")) throw new Error("No autorizado");
  return session;
}
async function requireSupervision() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  if (!esAdminOCoordinadora(session)) throw new Error("No autorizado");
  return session;
}

export interface ResultadoProcesado {
  ok: true;
  meta: MetaTrabajador;
  resultado: ResultadoValidacion;
  observacionAuto: string;
  asesorNombre: string;
  archivoNombre: string;
  advertenciasLectura: string[];
}
export type RespValidar = ResultadoProcesado | { ok: false; error: string };

// Valida y devuelve el resultado. NO guarda nada: el PDF se procesa en memoria
// y se descarta; no se persiste la validación ni el documento. Es solo una
// herramienta de verificación en el momento.
export async function validarPilaAction(formData: FormData): Promise<RespValidar> {
  const session = await requireAcceso();
  try {
    const tipo = String(formData.get("tipo") ?? "") as TipoTrabajador;
    const fechaSolicitud = String(formData.get("fechaSolicitud") ?? "");
    const archivo = formData.get("archivo");
    if (tipo !== "dependiente" && tipo !== "independiente") return { ok: false, error: "Selecciona el tipo de trabajador." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaSolicitud)) return { ok: false, error: "Indica una fecha de solicitud válida." };
    if (!(archivo instanceof File)) return { ok: false, error: "Adjunta el reporte PDF." };
    if (!/\.pdf$/i.test(archivo.name) || (archivo.type && !/pdf/i.test(archivo.type))) return { ok: false, error: "El archivo debe ser un PDF." };
    if (archivo.size > MAX_BYTES) return { ok: false, error: "El PDF supera el tamaño máximo (12 MB)." };
    if (archivo.size === 0) return { ok: false, error: "El PDF está vacío." };

    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const parseo = await parsearPdfPila(bytes);
    const config = await obtenerConfigReglas();
    const resultado = validarPila(parseo.registros, tipo, fechaSolicitud, config);

    return {
      ok: true, meta: parseo.meta, resultado,
      observacionAuto: observacionAutomatica(resultado),
      asesorNombre: session.user.nombre, archivoNombre: archivo.name,
      advertenciasLectura: parseo.advertencias,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el documento." };
  }
}

export async function obtenerConfigAction(): Promise<ConfigReglas> {
  await requireAcceso();
  return obtenerConfigReglas();
}
export async function guardarConfigAction(cfg: ConfigReglas): Promise<{ ok: boolean; error?: string }> {
  await requireSupervision();
  try { await guardarConfigReglas(cfg); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error" }; }
}
