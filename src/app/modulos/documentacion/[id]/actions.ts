"use server";

import { auth } from "@/auth";
import { resolverAsesoraId } from "@/lib/documentacion-identidad";
import {
  obtenerAsignacionPropia,
  guardarTextoSeccion,
  guardarTextoOpcional,
  marcarNoAplica,
  agregarPaso,
  actualizarInstruccionPaso,
  eliminarPaso,
  reordenarPasos,
  subirCapturaPaso,
  eliminarCapturaPaso,
  marcarImagenNoAplica,
  agregarValidacion,
  actualizarValidacion,
  eliminarValidacion,
  agregarError,
  actualizarError,
  eliminarError,
  buscarProcedimientosParaRelacionar,
  agregarRelacionExistente,
  agregarRelacionPropuesta,
  eliminarRelacion,
} from "@/lib/documentacion-editor";
import type {
  PasoProcedimiento,
  ValidacionProcedimiento,
  ErrorProcedimiento,
  RelacionProcedimiento,
  ProcedimientoBuscable,
} from "@/lib/documentacion-tipos";

// Toda acción vuelve a resolver la identidad y a comprobar la asignación:
// nunca se confía en un asesoraId que llegue implícito desde el cliente.
async function autorizar(procedimientoId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.modulos.includes("documentacion")) throw new Error("No autorizado");
  const asesoraId = await resolverAsesoraId(session.user.usuario);
  if (!asesoraId) throw new Error("No autorizado");
  const asignacion = await obtenerAsignacionPropia(procedimientoId, asesoraId);
  if (!asignacion) throw new Error("No autorizado");
}

export async function guardarTextoSeccionAction(
  procedimientoId: string,
  campo: "para_que_sirve" | "cuando_se_utiliza",
  valor: string
): Promise<void> {
  await autorizar(procedimientoId);
  await guardarTextoSeccion(procedimientoId, campo, valor);
}

export async function guardarTextoOpcionalAction(
  procedimientoId: string,
  campo: "resultado_esperado" | "observaciones",
  valor: string
): Promise<void> {
  await autorizar(procedimientoId);
  await guardarTextoOpcional(procedimientoId, campo, valor);
}

export async function marcarNoAplicaAction(
  procedimientoId: string,
  seccion: "resultado" | "validaciones" | "relaciones" | "errores" | "observaciones",
  noAplica: boolean
): Promise<void> {
  await autorizar(procedimientoId);
  await marcarNoAplica(procedimientoId, seccion, noAplica);
}

export async function agregarPasoAction(procedimientoId: string): Promise<PasoProcedimiento> {
  await autorizar(procedimientoId);
  return agregarPaso(procedimientoId);
}

export async function actualizarInstruccionPasoAction(
  procedimientoId: string,
  pasoId: string,
  instruccion: string
): Promise<void> {
  await autorizar(procedimientoId);
  await actualizarInstruccionPaso(procedimientoId, pasoId, instruccion);
}

export async function eliminarPasoAction(procedimientoId: string, pasoId: string): Promise<void> {
  await autorizar(procedimientoId);
  await eliminarPaso(procedimientoId, pasoId);
}

export async function reordenarPasosAction(procedimientoId: string, idsEnOrden: string[]): Promise<void> {
  await autorizar(procedimientoId);
  await reordenarPasos(procedimientoId, idsEnOrden);
}

export async function subirCapturaPasoAction(
  procedimientoId: string,
  formData: FormData
): Promise<{ imagenPath: string; imagenUrl: string | null }> {
  await autorizar(procedimientoId);
  const pasoId = formData.get("pasoId");
  const archivo = formData.get("archivo");
  if (typeof pasoId !== "string" || !pasoId) throw new Error("Falta el paso.");
  if (!(archivo instanceof File)) throw new Error("No se recibió ningún archivo.");
  return subirCapturaPaso(procedimientoId, pasoId, archivo);
}

export async function eliminarCapturaPasoAction(procedimientoId: string, pasoId: string): Promise<void> {
  await autorizar(procedimientoId);
  await eliminarCapturaPaso(procedimientoId, pasoId);
}

export async function marcarImagenNoAplicaAction(
  procedimientoId: string,
  pasoId: string,
  noAplica: boolean
): Promise<void> {
  await autorizar(procedimientoId);
  await marcarImagenNoAplica(procedimientoId, pasoId, noAplica);
}

export async function agregarValidacionAction(procedimientoId: string, descripcion: string): Promise<ValidacionProcedimiento> {
  await autorizar(procedimientoId);
  return agregarValidacion(procedimientoId, descripcion);
}

export async function actualizarValidacionAction(procedimientoId: string, id: string, descripcion: string): Promise<void> {
  await autorizar(procedimientoId);
  await actualizarValidacion(procedimientoId, id, descripcion);
}

export async function eliminarValidacionAction(procedimientoId: string, id: string): Promise<void> {
  await autorizar(procedimientoId);
  await eliminarValidacion(procedimientoId, id);
}

export async function agregarErrorAction(procedimientoId: string, descripcion: string): Promise<ErrorProcedimiento> {
  await autorizar(procedimientoId);
  return agregarError(procedimientoId, descripcion);
}

export async function actualizarErrorAction(procedimientoId: string, id: string, descripcion: string): Promise<void> {
  await autorizar(procedimientoId);
  await actualizarError(procedimientoId, id, descripcion);
}

export async function eliminarErrorAction(procedimientoId: string, id: string): Promise<void> {
  await autorizar(procedimientoId);
  await eliminarError(procedimientoId, id);
}

export async function buscarProcedimientosParaRelacionarAction(
  procedimientoId: string,
  texto: string
): Promise<ProcedimientoBuscable[]> {
  await autorizar(procedimientoId);
  return buscarProcedimientosParaRelacionar(procedimientoId, texto);
}

export async function agregarRelacionExistenteAction(
  procedimientoId: string,
  condicion: string,
  destinoId: string
): Promise<RelacionProcedimiento> {
  await autorizar(procedimientoId);
  return agregarRelacionExistente(procedimientoId, condicion, destinoId);
}

export async function agregarRelacionPropuestaAction(
  procedimientoId: string,
  condicion: string,
  nombrePropuesto: string
): Promise<RelacionProcedimiento> {
  await autorizar(procedimientoId);
  return agregarRelacionPropuesta(procedimientoId, condicion, nombrePropuesto);
}

export async function eliminarRelacionAction(procedimientoId: string, id: string): Promise<void> {
  await autorizar(procedimientoId);
  await eliminarRelacion(procedimientoId, id);
}
