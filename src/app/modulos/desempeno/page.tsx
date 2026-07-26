import { requireModulo } from "@/lib/auth-helpers";
import { obtenerDashboardDesempeno } from "@/lib/desempeno";
import DesempenoDashboard from "./DesempenoDashboard";

export const maxDuration = 60;

export default async function DesempenoPage() {
  const session = await requireModulo("desempeno");

  let dashboard: Awaited<ReturnType<typeof obtenerDashboardDesempeno>> | null = null;
  let error: string | null = null;
  try {
    dashboard = await obtenerDashboardDesempeno({});
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el módulo de Desempeño";
  }

  return <DesempenoDashboard nombre={session.user.nombre} dashboardInicial={dashboard} errorInicial={error} />;
}
