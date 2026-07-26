import { redirect } from "next/navigation";
import { requireModulo, esAdmin } from "@/lib/auth-helpers";
import { obtenerRevisionAdmin } from "@/lib/documentacion-editor";
import RevisionProcedimiento from "./RevisionProcedimiento";

export const maxDuration = 30;

// Ruta protegida SERVER-SIDE solo para Admin. Una asesora que escriba la URL es
// redirigida antes de cargar cualquier dato.
export default async function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireModulo("documentacion");
  if (!esAdmin(session)) redirect("/modulos/documentacion");

  const { id } = await params;
  const datos = await obtenerRevisionAdmin(id);

  return <RevisionProcedimiento procedimientoId={id} datos={datos} />;
}
