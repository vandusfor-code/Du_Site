import { redirect } from "next/navigation";
import { requireModulo } from "@/lib/auth-helpers";
import { resolverAsesoraId } from "@/lib/documentacion-identidad";
import {
  obtenerAsignacionPropia,
  marcarInicioSiCorresponde,
  obtenerDetalleProcedimiento,
  obtenerCorreccionVigente,
} from "@/lib/documentacion-editor";
import { formatearFecha, estadoEsEditable } from "@/lib/documentacion-tipos";
import DocumentarProcedimiento from "./DocumentarProcedimiento";

export const maxDuration = 30;

export default async function DocumentarProcedimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireModulo("documentacion");
  const { id } = await params;

  const asesoraId = await resolverAsesoraId(session.user.usuario);
  if (!asesoraId) redirect("/modulos/documentacion");

  const asignacion = await obtenerAsignacionPropia(id, asesoraId);
  if (!asignacion) redirect("/modulos/documentacion");

  await marcarInicioSiCorresponde(asignacion, id);

  const detalle = await obtenerDetalleProcedimiento(id);
  // Si viene de una corrección, mostramos el comentario del revisor sobre el formulario.
  const correccion = detalle.estado === "correccion_requerida" ? await obtenerCorreccionVigente(id) : null;

  return (
    <DocumentarProcedimiento
      procedimientoId={id}
      detalleInicial={detalle}
      fechaLimite={formatearFecha(asignacion.fechaLimite)}
      editable={estadoEsEditable(detalle.estado)}
      correccionComentario={correccion}
    />
  );
}
