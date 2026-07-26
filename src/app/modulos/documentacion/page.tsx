import { redirect } from "next/navigation";
import { requireModulo, esAdmin } from "@/lib/auth-helpers";
import { obtenerDashboardDocumentacion } from "@/lib/documentacion";
import { resolverAsesoraId } from "@/lib/documentacion-identidad";
import { obtenerMisProcedimientos } from "@/lib/documentacion-editor";
import DocumentacionDashboard from "./DocumentacionDashboard";
import MisProcedimientos from "./MisProcedimientos";

export const maxDuration = 30;

// Misma URL, dos experiencias resueltas SERVER-SIDE por rol (sin flash ni redirect):
// Admin → dashboard administrativo; Asesora → "Mis procedimientos" (solo lo suyo).
export default async function DocumentacionPage() {
  const session = await requireModulo("documentacion");

  if (esAdmin(session)) {
    let dashboard: Awaited<ReturnType<typeof obtenerDashboardDocumentacion>> | null = null;
    let error: string | null = null;
    try {
      dashboard = await obtenerDashboardDocumentacion();
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al cargar Documentación Operativa";
    }
    return <DocumentacionDashboard dashboardInicial={dashboard} errorInicial={error} />;
  }

  // Asesora: identidad resuelta server-side (nunca desde cliente/URL).
  const asesoraId = await resolverAsesoraId(session.user.usuario);
  if (!asesoraId) redirect("/"); // sin asesora identificable → no exponer nada

  let datos: Awaited<ReturnType<typeof obtenerMisProcedimientos>> | null = null;
  let error: string | null = null;
  try {
    datos = await obtenerMisProcedimientos(asesoraId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar tus procedimientos";
  }

  return <MisProcedimientos datosIniciales={datos} errorInicial={error} />;
}
