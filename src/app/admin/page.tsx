import { requireAdmin } from "@/lib/auth-helpers";
import { obtenerEstadoAuditorias, obtenerHistorialAuditorias } from "@/lib/auditorias-admin";
import AdminDashboard from "./AdminDashboard";

// Ejecutar auditorías puede tardar varios minutos (hasta 50 transcripciones,
// dos llamadas a Claude cada una); se necesita el máximo permitido por Vercel.
export const maxDuration = 300;

export default async function AdminPage() {
  const session = await requireAdmin();

  let estado: Awaited<ReturnType<typeof obtenerEstadoAuditorias>> | null = null;
  let historial: Awaited<ReturnType<typeof obtenerHistorialAuditorias>> | null = null;
  let error: string | null = null;
  try {
    [estado, historial] = await Promise.all([
      obtenerEstadoAuditorias(),
      obtenerHistorialAuditorias({}),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el estado de auditorías";
  }

  return (
    <AdminDashboard
      nombre={session.user.nombre}
      estadoInicial={estado}
      historialInicial={historial}
      errorInicial={error}
    />
  );
}
