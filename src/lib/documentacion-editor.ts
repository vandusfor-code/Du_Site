import "server-only";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatearFecha,
  type DetalleProcedimiento,
  type PasoProcedimiento,
  type ValidacionProcedimiento,
  type ErrorProcedimiento,
  type RelacionProcedimiento,
  type ProcedimientoBuscable,
  type PendienteDocumentacion,
} from "@/lib/documentacion-tipos";

// ============================================================
// Editor de documentación (experiencia de la asesora) — escritura y
// lectura server-side sobre Supabase. Toda función que reciba un
// procedimientoId/pasoId/etc. filtra siempre por ese procedimiento para
// evitar que un id de otra asesora se cuele por casualidad.
// ============================================================

const BUCKET = "documentacion-operativa";
const URL_TTL_SEGUNDOS = 600; // 10 min
const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

async function firmarImagen(sb: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SEGUNDOS);
  if (error) {
    console.error("[documentacion-editor] error firmando imagen:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

// ── Autorización / primera apertura ──

export interface AsignacionPropia {
  id: string;
  estado: string;
  fechaLimite: string | null;
  fechaInicio: string | null;
}

export async function obtenerAsignacionPropia(
  procedimientoId: string,
  asesoraId: string
): Promise<AsignacionPropia | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("asignaciones_documentacion")
    .select("id, estado, fecha_limite, fecha_inicio")
    .eq("procedimiento_id", procedimientoId)
    .eq("asesora_id", asesoraId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    estado: data.estado ?? "pendiente",
    fechaLimite: data.fecha_limite,
    fechaInicio: data.fecha_inicio,
  };
}

export async function marcarInicioSiCorresponde(asignacion: AsignacionPropia, procedimientoId: string): Promise<void> {
  if (asignacion.fechaInicio) return; // ya se marcó antes: no sobrescribir

  const sb = getSupabase();
  const ahora = new Date().toISOString();
  const nuevoEstadoAsignacion = asignacion.estado === "pendiente" ? "en_elaboracion" : asignacion.estado;

  const { error: e1 } = await sb
    .from("asignaciones_documentacion")
    .update({ fecha_inicio: ahora, estado: nuevoEstadoAsignacion })
    .eq("id", asignacion.id);
  if (e1) throw new Error(`Supabase: ${e1.message}`);

  const { data: proc, error: e2 } = await sb
    .from("procedimientos")
    .select("estado")
    .eq("id", procedimientoId)
    .maybeSingle();
  if (e2) throw new Error(`Supabase: ${e2.message}`);

  if (proc?.estado === "pendiente") {
    const { error: e3 } = await sb.from("procedimientos").update({ estado: "en_elaboracion" }).eq("id", procedimientoId);
    if (e3) throw new Error(`Supabase: ${e3.message}`);
  }
}

// ── Detalle completo ──

export async function obtenerDetalleProcedimiento(procedimientoId: string): Promise<DetalleProcedimiento> {
  const sb = getSupabase();

  const [procR, pasosR, valsR, errsR, relsR] = await Promise.all([
    sb
      .from("procedimientos")
      .select(
        "id, aplicativo_id, titulo, para_que_sirve, cuando_se_utiliza, resultado_esperado, resultado_no_aplica, validaciones_no_aplica, relaciones_no_aplica, errores_no_aplica, observaciones, observaciones_no_aplica, estado"
      )
      .eq("id", procedimientoId)
      .maybeSingle(),
    sb
      .from("pasos_procedimiento")
      .select("id, orden, instruccion, imagen_path, imagen_no_aplica")
      .eq("procedimiento_id", procedimientoId)
      .order("orden", { ascending: true }),
    sb
      .from("validaciones_procedimiento")
      .select("id, orden, descripcion")
      .eq("procedimiento_id", procedimientoId)
      .order("orden", { ascending: true }),
    sb
      .from("errores_procedimiento")
      .select("id, orden, descripcion")
      .eq("procedimiento_id", procedimientoId)
      .order("orden", { ascending: true }),
    sb
      .from("relaciones_procedimientos")
      .select("id, condicion, procedimiento_destino_id, procedimiento_propuesto, estado, created_at")
      .eq("procedimiento_origen_id", procedimientoId)
      .neq("estado", "descartado")
      .order("created_at", { ascending: true }),
  ]);

  for (const r of [procR, pasosR, valsR, errsR, relsR]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }
  if (!procR.data) throw new Error("Procedimiento no encontrado");
  const proc = procR.data;

  const destinoIds = Array.from(
    new Set((relsR.data ?? []).map((r) => r.procedimiento_destino_id).filter((x): x is string => !!x))
  );
  const destinos = new Map<string, { titulo: string; aplicativoId: string | null }>();
  if (destinoIds.length) {
    const { data: destData, error: destErr } = await sb
      .from("procedimientos")
      .select("id, titulo, aplicativo_id")
      .in("id", destinoIds);
    if (destErr) throw new Error(`Supabase: ${destErr.message}`);
    (destData ?? []).forEach((d) => destinos.set(d.id, { titulo: d.titulo ?? "—", aplicativoId: d.aplicativo_id }));
  }

  const aplicativoIds = Array.from(
    new Set([proc.aplicativo_id, ...Array.from(destinos.values()).map((d) => d.aplicativoId)].filter(
      (x): x is string => !!x
    ))
  );
  const apNombres = new Map<string, string>();
  if (aplicativoIds.length) {
    const { data: apData, error: apErr } = await sb.from("aplicativos").select("id, nombre").in("id", aplicativoIds);
    if (apErr) throw new Error(`Supabase: ${apErr.message}`);
    (apData ?? []).forEach((a) => apNombres.set(a.id, a.nombre ?? "—"));
  }

  const pasos: PasoProcedimiento[] = await Promise.all(
    (pasosR.data ?? []).map(async (p) => ({
      id: p.id,
      orden: p.orden,
      instruccion: p.instruccion ?? "",
      imagenPath: p.imagen_path ?? null,
      imagenNoAplica: !!p.imagen_no_aplica,
      imagenUrl: await firmarImagen(sb, p.imagen_path ?? null),
    }))
  );

  const validaciones: ValidacionProcedimiento[] = (valsR.data ?? []).map((v) => ({
    id: v.id,
    orden: v.orden,
    descripcion: v.descripcion ?? "",
  }));

  const errores: ErrorProcedimiento[] = (errsR.data ?? []).map((e) => ({
    id: e.id,
    orden: e.orden,
    descripcion: e.descripcion ?? "",
  }));

  const relaciones: RelacionProcedimiento[] = (relsR.data ?? []).map((r) => {
    const destino = r.procedimiento_destino_id ? destinos.get(r.procedimiento_destino_id) : undefined;
    return {
      id: r.id,
      condicion: r.condicion ?? "",
      destinoId: r.procedimiento_destino_id,
      destinoTitulo: destino ? destino.titulo : null,
      destinoAplicativo: destino?.aplicativoId ? apNombres.get(destino.aplicativoId) ?? "—" : destino ? "—" : null,
      propuesto: r.procedimiento_propuesto,
      estado: (r.estado ?? "vinculado") as RelacionProcedimiento["estado"],
    };
  });

  return {
    id: proc.id,
    titulo: proc.titulo ?? "—",
    aplicativo: proc.aplicativo_id ? apNombres.get(proc.aplicativo_id) ?? "—" : "—",
    estado: proc.estado ?? "pendiente",
    paraQueSirve: proc.para_que_sirve ?? "",
    cuandoSeUtiliza: proc.cuando_se_utiliza ?? "",
    pasos,
    resultadoEsperado: proc.resultado_esperado ?? "",
    resultadoNoAplica: !!proc.resultado_no_aplica,
    validaciones,
    validacionesNoAplica: !!proc.validaciones_no_aplica,
    relaciones,
    relacionesNoAplica: !!proc.relaciones_no_aplica,
    errores,
    erroresNoAplica: !!proc.errores_no_aplica,
    observaciones: proc.observaciones ?? "",
    observacionesNoAplica: !!proc.observaciones_no_aplica,
  };
}

// ── Preguntas de texto simple (1, 2) y texto con "no aplica" (4, 8) ──

export async function guardarTextoSeccion(
  procedimientoId: string,
  campo: "para_que_sirve" | "cuando_se_utiliza",
  valor: string
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("procedimientos").update({ [campo]: valor }).eq("id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function guardarTextoOpcional(
  procedimientoId: string,
  campo: "resultado_esperado" | "observaciones",
  valor: string
): Promise<void> {
  const sb = getSupabase();
  const campoNoAplica = campo === "resultado_esperado" ? "resultado_no_aplica" : "observaciones_no_aplica";
  const { error } = await sb
    .from("procedimientos")
    .update({ [campo]: valor, [campoNoAplica]: false })
    .eq("id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function marcarNoAplica(
  procedimientoId: string,
  seccion: "resultado" | "validaciones" | "relaciones" | "errores" | "observaciones",
  noAplica: boolean
): Promise<void> {
  const sb = getSupabase();
  const patch: Record<string, unknown> = { [`${seccion}_no_aplica`]: noAplica };
  if (noAplica) {
    if (seccion === "resultado") patch.resultado_esperado = null;
    if (seccion === "observaciones") patch.observaciones = null;
  }
  const { error } = await sb.from("procedimientos").update(patch).eq("id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);

  if (noAplica && seccion === "validaciones") {
    const { error: e2 } = await sb.from("validaciones_procedimiento").delete().eq("procedimiento_id", procedimientoId);
    if (e2) throw new Error(`Supabase: ${e2.message}`);
  }
  if (noAplica && seccion === "errores") {
    const { error: e2 } = await sb.from("errores_procedimiento").delete().eq("procedimiento_id", procedimientoId);
    if (e2) throw new Error(`Supabase: ${e2.message}`);
  }
  if (noAplica && seccion === "relaciones") {
    const { error: e2 } = await sb
      .from("relaciones_procedimientos")
      .delete()
      .eq("procedimiento_origen_id", procedimientoId);
    if (e2) throw new Error(`Supabase: ${e2.message}`);
  }
}

// ── Paso a paso (pregunta 3) ──

async function reindexarSecuencial(sb: SupabaseClient, tabla: string, procedimientoId: string): Promise<void> {
  const { data, error } = await sb
    .from(tabla)
    .select("id, orden")
    .eq("procedimiento_id", procedimientoId)
    .order("orden", { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);
  const filas = data ?? [];
  // Dos fases (temporal negativo, luego definitivo) para evitar colisiones
  // si existiera una restricción única sobre (procedimiento_id, orden).
  for (let i = 0; i < filas.length; i++) {
    await sb.from(tabla).update({ orden: -(i + 1) }).eq("id", filas[i].id);
  }
  for (let i = 0; i < filas.length; i++) {
    await sb.from(tabla).update({ orden: i + 1 }).eq("id", filas[i].id);
  }
}

export async function agregarPaso(procedimientoId: string): Promise<PasoProcedimiento> {
  const sb = getSupabase();
  const { data: existentes, error: e1 } = await sb
    .from("pasos_procedimiento")
    .select("orden")
    .eq("procedimiento_id", procedimientoId)
    .order("orden", { ascending: false })
    .limit(1);
  if (e1) throw new Error(`Supabase: ${e1.message}`);
  const siguienteOrden = (existentes?.[0]?.orden ?? 0) + 1;

  const { data, error } = await sb
    .from("pasos_procedimiento")
    .insert({ procedimiento_id: procedimientoId, orden: siguienteOrden, instruccion: "", imagen_path: null, imagen_no_aplica: false })
    .select("id, orden, instruccion, imagen_path, imagen_no_aplica")
    .single();
  if (error || !data) throw new Error(`Supabase: ${error?.message ?? "sin datos"}`);

  return {
    id: data.id,
    orden: data.orden,
    instruccion: data.instruccion ?? "",
    imagenPath: null,
    imagenNoAplica: false,
    imagenUrl: null,
  };
}

export async function actualizarInstruccionPaso(
  procedimientoId: string,
  pasoId: string,
  instruccion: string
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("pasos_procedimiento")
    .update({ instruccion })
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export async function eliminarPaso(procedimientoId: string, pasoId: string): Promise<void> {
  const sb = getSupabase();
  const { data: paso } = await sb
    .from("pasos_procedimiento")
    .select("imagen_path")
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId)
    .maybeSingle();
  if (paso?.imagen_path) {
    await sb.storage.from(BUCKET).remove([paso.imagen_path]);
  }
  const { error } = await sb
    .from("pasos_procedimiento")
    .delete()
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
  await reindexarSecuencial(sb, "pasos_procedimiento", procedimientoId);
}

export async function reordenarPasos(procedimientoId: string, idsEnOrden: string[]): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("pasos_procedimiento")
    .select("id")
    .eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
  const idsValidos = new Set((data ?? []).map((d) => d.id));
  if (idsEnOrden.length !== idsValidos.size || idsEnOrden.some((id) => !idsValidos.has(id))) {
    throw new Error("Los pasos no coinciden con el procedimiento.");
  }
  for (let i = 0; i < idsEnOrden.length; i++) {
    await sb.from("pasos_procedimiento").update({ orden: -(i + 1) }).eq("id", idsEnOrden[i]);
  }
  for (let i = 0; i < idsEnOrden.length; i++) {
    await sb.from("pasos_procedimiento").update({ orden: i + 1 }).eq("id", idsEnOrden[i]);
  }
}

export async function subirCapturaPaso(
  procedimientoId: string,
  pasoId: string,
  archivo: File
): Promise<{ imagenPath: string; imagenUrl: string | null }> {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    throw new Error("Formato no permitido. Usa PNG, JPG o WebP.");
  }
  if (archivo.size > TAMANO_MAXIMO) {
    throw new Error("La imagen supera el tamaño máximo de 5 MB.");
  }

  const sb = getSupabase();
  const { data: pasoActual, error: eSel } = await sb
    .from("pasos_procedimiento")
    .select("imagen_path")
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId)
    .maybeSingle();
  if (eSel) throw new Error(`Supabase: ${eSel.message}`);
  if (pasoActual === null) throw new Error("Paso no encontrado.");

  if (pasoActual.imagen_path) {
    await sb.storage.from(BUCKET).remove([pasoActual.imagen_path]);
  }

  const ext = archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
  const ruta = `procedimientos/${procedimientoId}/pasos/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const { error: upErr } = await sb.storage.from(BUCKET).upload(ruta, buffer, {
    contentType: archivo.type,
    upsert: false,
  });
  if (upErr) throw new Error(`Supabase storage: ${upErr.message}`);

  const { error: dbErr } = await sb
    .from("pasos_procedimiento")
    .update({ imagen_path: ruta, imagen_no_aplica: false })
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId);
  if (dbErr) {
    await sb.storage.from(BUCKET).remove([ruta]);
    throw new Error(`Supabase: ${dbErr.message}`);
  }

  return { imagenPath: ruta, imagenUrl: await firmarImagen(sb, ruta) };
}

export async function eliminarCapturaPaso(procedimientoId: string, pasoId: string): Promise<void> {
  const sb = getSupabase();
  const { data: paso, error } = await sb
    .from("pasos_procedimiento")
    .select("imagen_path")
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId)
    .maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (paso?.imagen_path) {
    await sb.storage.from(BUCKET).remove([paso.imagen_path]);
  }
  const { error: e2 } = await sb
    .from("pasos_procedimiento")
    .update({ imagen_path: null })
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId);
  if (e2) throw new Error(`Supabase: ${e2.message}`);
}

export async function marcarImagenNoAplica(procedimientoId: string, pasoId: string, noAplica: boolean): Promise<void> {
  const sb = getSupabase();
  if (noAplica) {
    const { data: paso } = await sb
      .from("pasos_procedimiento")
      .select("imagen_path")
      .eq("id", pasoId)
      .eq("procedimiento_id", procedimientoId)
      .maybeSingle();
    if (paso?.imagen_path) {
      await sb.storage.from(BUCKET).remove([paso.imagen_path]);
    }
  }
  const { error } = await sb
    .from("pasos_procedimiento")
    .update({ imagen_no_aplica: noAplica, imagen_path: noAplica ? null : undefined })
    .eq("id", pasoId)
    .eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ── Validaciones (pregunta 5) y errores frecuentes (pregunta 7) ──
// Misma forma de dato (orden + descripcion); una función parametrizada
// por tabla para no duplicar cinco veces la misma lógica de CRUD.

async function agregarItemLista(
  tabla: "validaciones_procedimiento" | "errores_procedimiento",
  campoNoAplica: "validaciones_no_aplica" | "errores_no_aplica",
  procedimientoId: string,
  descripcion: string
): Promise<ValidacionProcedimiento> {
  const sb = getSupabase();
  const { data: existentes, error: e1 } = await sb
    .from(tabla)
    .select("orden")
    .eq("procedimiento_id", procedimientoId)
    .order("orden", { ascending: false })
    .limit(1);
  if (e1) throw new Error(`Supabase: ${e1.message}`);
  const siguienteOrden = (existentes?.[0]?.orden ?? 0) + 1;

  const { data, error } = await sb
    .from(tabla)
    .insert({ procedimiento_id: procedimientoId, orden: siguienteOrden, descripcion: descripcion.trim() })
    .select("id, orden, descripcion")
    .single();
  if (error || !data) throw new Error(`Supabase: ${error?.message ?? "sin datos"}`);

  await sb.from("procedimientos").update({ [campoNoAplica]: false }).eq("id", procedimientoId);

  return { id: data.id, orden: data.orden, descripcion: data.descripcion ?? "" };
}

async function actualizarItemLista(
  tabla: "validaciones_procedimiento" | "errores_procedimiento",
  procedimientoId: string,
  id: string,
  descripcion: string
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(tabla).update({ descripcion }).eq("id", id).eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

async function eliminarItemLista(
  tabla: "validaciones_procedimiento" | "errores_procedimiento",
  procedimientoId: string,
  id: string
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(tabla).delete().eq("id", id).eq("procedimiento_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
  await reindexarSecuencial(sb, tabla, procedimientoId);
}

export const agregarValidacion = (procedimientoId: string, descripcion: string) =>
  agregarItemLista("validaciones_procedimiento", "validaciones_no_aplica", procedimientoId, descripcion);
export const actualizarValidacion = (procedimientoId: string, id: string, descripcion: string) =>
  actualizarItemLista("validaciones_procedimiento", procedimientoId, id, descripcion);
export const eliminarValidacion = (procedimientoId: string, id: string) =>
  eliminarItemLista("validaciones_procedimiento", procedimientoId, id);

export const agregarError = (procedimientoId: string, descripcion: string) =>
  agregarItemLista("errores_procedimiento", "errores_no_aplica", procedimientoId, descripcion) as Promise<ErrorProcedimiento>;
export const actualizarError = (procedimientoId: string, id: string, descripcion: string) =>
  actualizarItemLista("errores_procedimiento", procedimientoId, id, descripcion);
export const eliminarError = (procedimientoId: string, id: string) =>
  eliminarItemLista("errores_procedimiento", procedimientoId, id);

// ── Procedimientos relacionados (pregunta 6) ──

export async function buscarProcedimientosParaRelacionar(
  procedimientoId: string,
  texto: string
): Promise<ProcedimientoBuscable[]> {
  const sb = getSupabase();
  const q = texto.trim();
  let query = sb.from("procedimientos").select("id, titulo, aplicativo_id").neq("id", procedimientoId).limit(8);
  if (q) query = query.ilike("titulo", `%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase: ${error.message}`);

  const aplicativoIds = Array.from(new Set((data ?? []).map((d) => d.aplicativo_id).filter((x): x is string => !!x)));
  const apNombres = new Map<string, string>();
  if (aplicativoIds.length) {
    const { data: apData, error: apErr } = await sb.from("aplicativos").select("id, nombre").in("id", aplicativoIds);
    if (apErr) throw new Error(`Supabase: ${apErr.message}`);
    (apData ?? []).forEach((a) => apNombres.set(a.id, a.nombre ?? "—"));
  }

  return (data ?? []).map((d) => ({
    id: d.id,
    titulo: d.titulo ?? "—",
    aplicativo: d.aplicativo_id ? apNombres.get(d.aplicativo_id) ?? "—" : "—",
  }));
}

export async function agregarRelacionExistente(
  procedimientoId: string,
  condicion: string,
  destinoId: string
): Promise<RelacionProcedimiento> {
  if (destinoId === procedimientoId) throw new Error("Un procedimiento no puede relacionarse consigo mismo.");
  const sb = getSupabase();

  const { data: destino, error: eDest } = await sb
    .from("procedimientos")
    .select("id, titulo, aplicativo_id")
    .eq("id", destinoId)
    .maybeSingle();
  if (eDest) throw new Error(`Supabase: ${eDest.message}`);
  if (!destino) throw new Error("El procedimiento seleccionado no existe.");

  let aplicativo = "—";
  if (destino.aplicativo_id) {
    const { data: ap } = await sb.from("aplicativos").select("nombre").eq("id", destino.aplicativo_id).maybeSingle();
    aplicativo = ap?.nombre ?? "—";
  }

  const { data, error } = await sb
    .from("relaciones_procedimientos")
    .insert({
      procedimiento_origen_id: procedimientoId,
      condicion: condicion.trim(),
      procedimiento_destino_id: destinoId,
      procedimiento_propuesto: null,
      estado: "vinculado",
    })
    .select("id, condicion")
    .single();
  if (error || !data) throw new Error(`Supabase: ${error?.message ?? "sin datos"}`);

  await sb.from("procedimientos").update({ relaciones_no_aplica: false }).eq("id", procedimientoId);

  return {
    id: data.id,
    condicion: data.condicion ?? "",
    destinoId,
    destinoTitulo: destino.titulo ?? "—",
    destinoAplicativo: aplicativo,
    propuesto: null,
    estado: "vinculado",
  };
}

export async function agregarRelacionPropuesta(
  procedimientoId: string,
  condicion: string,
  nombrePropuesto: string
): Promise<RelacionProcedimiento> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("relaciones_procedimientos")
    .insert({
      procedimiento_origen_id: procedimientoId,
      condicion: condicion.trim(),
      procedimiento_destino_id: null,
      procedimiento_propuesto: nombrePropuesto.trim(),
      estado: "propuesto",
    })
    .select("id, condicion, procedimiento_propuesto")
    .single();
  if (error || !data) throw new Error(`Supabase: ${error?.message ?? "sin datos"}`);

  await sb.from("procedimientos").update({ relaciones_no_aplica: false }).eq("id", procedimientoId);

  return {
    id: data.id,
    condicion: data.condicion ?? "",
    destinoId: null,
    destinoTitulo: null,
    destinoAplicativo: null,
    propuesto: data.procedimiento_propuesto,
    estado: "propuesto",
  };
}

export async function eliminarRelacion(procedimientoId: string, id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("relaciones_procedimientos")
    .delete()
    .eq("id", id)
    .eq("procedimiento_origen_id", procedimientoId);
  if (error) throw new Error(`Supabase: ${error.message}`);
}

// ── Pendientes de documentación para la home (asesora autenticada) ──

export async function obtenerPendientesDocumentacion(asesoraId: string | null): Promise<PendienteDocumentacion[]> {
  if (!asesoraId) return [];
  const sb = getSupabase();

  const { data: asignaciones, error } = await sb
    .from("asignaciones_documentacion")
    .select("id, procedimiento_id, fecha_limite, estado")
    .eq("asesora_id", asesoraId)
    .in("estado", ["pendiente", "en_elaboracion", "correccion_requerida"]);
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!asignaciones || asignaciones.length === 0) return [];

  const procIds = Array.from(new Set(asignaciones.map((a) => a.procedimiento_id).filter((x): x is string => !!x)));
  const { data: procs, error: eProc } = await sb
    .from("procedimientos")
    .select("id, titulo, aplicativo_id")
    .in("id", procIds);
  if (eProc) throw new Error(`Supabase: ${eProc.message}`);

  const aplicativoIds = Array.from(new Set((procs ?? []).map((p) => p.aplicativo_id).filter((x): x is string => !!x)));
  const apNombres = new Map<string, string>();
  if (aplicativoIds.length) {
    const { data: apData, error: eAp } = await sb.from("aplicativos").select("id, nombre").in("id", aplicativoIds);
    if (eAp) throw new Error(`Supabase: ${eAp.message}`);
    (apData ?? []).forEach((a) => apNombres.set(a.id, a.nombre ?? "—"));
  }
  const procMap = new Map((procs ?? []).map((p) => [p.id, p]));

  return asignaciones
    .filter((a) => a.procedimiento_id && procMap.has(a.procedimiento_id))
    .map((a) => {
      const proc = procMap.get(a.procedimiento_id as string)!;
      return {
        asignacionId: a.id,
        procedimientoId: proc.id,
        titulo: proc.titulo ?? "—",
        aplicativo: proc.aplicativo_id ? apNombres.get(proc.aplicativo_id) ?? "—" : "—",
        fechaLimite: formatearFecha(a.fecha_limite),
        estado: a.estado ?? "pendiente",
        accion: a.estado === "pendiente" ? ("Comenzar" as const) : ("Continuar" as const),
      };
    });
}
