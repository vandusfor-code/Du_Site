import { requireAdmin } from "@/lib/auth-helpers";
import { obtenerDashboardDocumental } from "@/lib/documental";
import AdminSidebar from "../AdminSidebar";
import AuditoriaDocumental from "./AuditoriaDocumental";

// El procesamiento con IA de un archivo puede tardar; se usa el máximo de Vercel.
export const maxDuration = 300;

export default async function AuditoriaDocumentalPage() {
  const session = await requireAdmin();

  let dashboard: Awaited<ReturnType<typeof obtenerDashboardDocumental>> | null = null;
  let error: string | null = null;
  try {
    dashboard = await obtenerDashboardDocumental();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar Auditoría Documental";
  }

  return (
    <>
      <AdminSidebar nombre={session.user.nombre} activo="Auditoría Documental" />
      <AuditoriaDocumental dashboardInicial={dashboard} errorInicial={error} />
    </>
  );
}
