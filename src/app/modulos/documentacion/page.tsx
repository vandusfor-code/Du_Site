import { redirect } from "next/navigation";
import { requireModulo, esAdmin } from "@/lib/auth-helpers";
import { obtenerDashboardDocumentacion } from "@/lib/documentacion";
import DocumentacionDashboard from "./DocumentacionDashboard";

export const maxDuration = 30;

export default async function DocumentacionPage() {
  const session = await requireModulo("documentacion");
  // El dashboard administrativo es exclusivo de coordinadores/Admin. Una asesora
  // se decide server-side ANTES de consultar cualquier dato administrativo; se la
  // envía a su lista existente (Pendientes del Home), no a un Home "pelado".
  if (!esAdmin(session)) redirect("/#pendientes");

  let dashboard: Awaited<ReturnType<typeof obtenerDashboardDocumentacion>> | null = null;
  let error: string | null = null;
  try {
    dashboard = await obtenerDashboardDocumentacion();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar Documentación Operativa";
  }

  return <DocumentacionDashboard dashboardInicial={dashboard} errorInicial={error} />;
}
