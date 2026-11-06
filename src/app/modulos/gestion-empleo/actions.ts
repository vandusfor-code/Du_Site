"use server";

import { auth } from "@/auth";
import { esAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import { getSupabase } from "@/lib/supabase";
import { parsearPdfPila } from "@/lib/empleo/pila-parser";
import { validarPila } from "@/lib/empleo/pila-motor";
import type { TipoTrabajador, ResultadoValidacion, MetaTrabajador } from "@/lib/empleo/pila-tipos";
import {
  guardarValidacion,
  listarValidaciones,
  obtenerValidacion,
  actualizarObservacionAsesor,
  obtenerEstadisticas,
  obtenerConfigReglas,
  guardarConfigReglas,
  observacionAutomatica,
  type FilaHistorial,
  type FiltrosHistorial,
  type ValidacionCompleta,
  type Estadisticas,
} from "@/lib/empleo/empleo-store";
import type { ConfigReglas } from "@/lib/empleo/pila-tipos";

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
  id: string;
  meta: MetaTrabajador;
  resultado: ResultadoValidacion;
  observacionAuto: string;
  asesorNombre: string;
  archivoNombre: string;
  advertenciasLectura: string[];
}
export type RespValidar = ResultadoProcesado | { ok: false; error: string };

// Sube el PDF original a un bucket privado (best-effort). Si storage no está
// disponible, no bloquea: la validación igual se guarda (reproducible por los
// registros). Devuelve la ruta o null.
async function guardarArchivoPrivado(bytes: Uint8Array, nombre: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    const bucket = "empleo-pila";
    // asegurar bucket privado
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === bucket)) {
      await sb.storage.createBucket(bucket, { public: false });
    }
    const safe = nombre.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
    const ruta = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from(bucket).upload(ruta, bytes, { contentType: "application/pdf", upsert: false });
    if (error) return null;
    return `${bucket}/${ruta}`;
  } catch {
    return null;
  }
}

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

    // 1) Parsear  2) Validar (con config vigente)  3) Persistir.
    const parseo = await parsearPdfPila(bytes);
    const config = await obtenerConfigReglas();
    const resultado = validarPila(parseo.registros, tipo, fechaSolicitud, config);

    const asesorNombre = session.user.nombre;
    const asesorCodigo = session.user.usuario;
    const ruta = await guardarArchivoPrivado(bytes, archivo.name);

    const id = await guardarValidacion({
      asesorCodigo, asesorNombre, meta: parseo.meta,
      archivoNombre: archivo.name, archivoRuta: ruta,
      resultado, registros: parseo.registros,
    });

    return {
      ok: true, id, meta: parseo.meta, resultado,
      observacionAuto: observacionAutomatica(resultado),
      asesorNombre, archivoNombre: archivo.name,
      advertenciasLectura: parseo.advertencias,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el documento." };
  }
}

// Historial: un asesor ve solo lo suyo; Admin/Coordinación ven todo.
export async function listarValidacionesAction(f: FiltrosHistorial): Promise<FilaHistorial[]> {
  const session = await requireAcceso();
  const filtros: FiltrosHistorial = { ...f };
  if (!esAdminOCoordinadora(session)) filtros.asesorCodigo = session.user.usuario;
  return listarValidaciones(filtros);
}

export async function obtenerValidacionAction(id: string): Promise<ValidacionCompleta | null> {
  const session = await requireAcceso();
  const v = await obtenerValidacion(id);
  if (!v) return null;
  // Un asesor solo puede abrir sus propias validaciones.
  if (!esAdminOCoordinadora(session) && String(v.cabecera.asesor_codigo) !== session.user.usuario) return null;
  return v;
}

export async function guardarObservacionAction(id: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAcceso();
  const v = await obtenerValidacion(id);
  if (!v) return { ok: false, error: "No existe la validación." };
  if (!esAdminOCoordinadora(session) && String(v.cabecera.asesor_codigo) !== session.user.usuario) return { ok: false, error: "No autorizado." };
  try { await actualizarObservacionAsesor(id, texto); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error" }; }
}

export async function obtenerEstadisticasAction(f: FiltrosHistorial): Promise<Estadisticas> {
  await requireSupervision();
  return obtenerEstadisticas(f);
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
