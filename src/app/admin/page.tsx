import { requireAdmin } from "@/lib/auth-helpers";
import { obtenerDashboardAuditorias, obtenerFuncionariosParaSelector, type FuncionarioOpcion } from "@/lib/auditorias-admin";
import AdminDashboard from "./AdminDashboard";

// Ejecutar auditorías puede tardar varios minutos (hasta 50 transcripciones,
// dos llamadas a Claude cada una); se necesita el máximo permitido por Vercel.
export const maxDuration = 300;

export default async function AdminPage() {
  const session = await requireAdmin();

  let dashboard: Awaited<ReturnType<typeof obtenerDashboardAuditorias>> | null = null;
  let error: string | null = null;
  try {
    dashboard = await obtenerDashboardAuditorias({});
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el dashboard de auditorías";
  }

  // Lista de asesores para el formulario de Auditoría CO: independiente del
  // dashboard, si falla no debe tumbar toda la página.
  let funcionarios: FuncionarioOpcion[] = [];
  try {
    funcionarios = await obtenerFuncionariosParaSelector();
  } catch {
    /* el formulario manual queda con la lista vacía; el asesor se puede escribir a mano */
  }

  return (
    <AdminDashboard
      nombre={session.user.nombre}
      dashboardInicial={dashboard}
      errorInicial={error}
      funcionarios={funcionarios}
    />
  );
}
