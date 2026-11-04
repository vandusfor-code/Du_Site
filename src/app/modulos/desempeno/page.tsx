import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { esAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import { obtenerDashboardDesempeno } from "@/lib/desempeno";
import BonosDashboard from "./DesempenoDashboard";

export const maxDuration = 60;

// Panel "Bonos" (antes Desempeño): solo Admin y Coordinadora. El Coordinador
// edita las métricas manuales; el Admin edita todo (incl. automáticas).
export default async function BonosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!esAdminOCoordinadora(session)) redirect("/");

  // IMPORTANTE: la hoja TO está calculada con fórmulas propias; la app NO debe
  // escribir en ella. Solo lee para mostrar. (Antes se sincronizaba aquí y eso
  // sobrescribía las fórmulas — desactivado.)
  let dashboard: Awaited<ReturnType<typeof obtenerDashboardDesempeno>> | null = null;
  let error: string | null = null;
  try {
    dashboard = await obtenerDashboardDesempeno({});
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el módulo de Bonos";
  }

  return (
    <BonosDashboard
      nombre={session.user.nombre}
      esAdmin={esAdmin(session)}
      dashboardInicial={dashboard}
      errorInicial={error}
    />
  );
}
