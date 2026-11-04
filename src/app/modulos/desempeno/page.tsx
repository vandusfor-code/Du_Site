import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { esAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import { obtenerDashboardDesempeno, sincronizarAutomaticas } from "@/lib/desempeno";
import BonosDashboard from "./DesempenoDashboard";

export const maxDuration = 60;

// Panel "Bonos" (antes Desempeño): solo Admin y Coordinadora. El Coordinador
// edita las métricas manuales; el Admin edita todo (incl. automáticas).
export default async function BonosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!esAdminOCoordinadora(session)) redirect("/");

  // Al abrir, trae las automáticas (PEC/PENC/#auditorías) del mes en curso desde
  // las auditorías del Consolidado (best-effort; no bloquea la vista si falla).
  try {
    await sincronizarAutomaticas();
  } catch {
    // silencioso: si falla el sync, igual se muestra lo que haya.
  }

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
