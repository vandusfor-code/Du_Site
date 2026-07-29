import { requireAdmin } from "@/lib/auth-helpers";
import { obtenerDetalleRadicaciones, type DetalleRadicaciones } from "@/lib/radicaciones";
import DetalleRadicacionesView from "./DetalleRadicacionesView";

export const maxDuration = 30;

// Pantalla que se abre al hacer clic en la tarjeta "Radicaciones registradas
// (últimos días)" del Home. Solo Admin (desempeño por asesora).
export default async function DetalleRadicacionesPage() {
  const session = await requireAdmin();

  let datos: DetalleRadicaciones | null = null;
  let error: string | null = null;
  try {
    datos = await obtenerDetalleRadicaciones(session.user.nombre);
  } catch (e) {
    error = e instanceof Error ? e.message : "No fue posible cargar el detalle";
  }

  return <DetalleRadicacionesView datos={datos} errorInicial={error} />;
}
