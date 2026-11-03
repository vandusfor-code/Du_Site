import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { esAdminOCoordinadora } from "@/lib/auth-helpers";
import RadicacionesDashboard from "./RadicacionesDashboard";
import RadicacionesAdmin from "./RadicacionesAdmin";

export const maxDuration = 60;

// Misma URL, dos experiencias por rol:
//  - Admin/Coordinadora → panel de gestión de SNC del equipo.
//  - Asesora (radicadora) → su tablero de radicaciones y SNC.
export default async function RadicacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (esAdminOCoordinadora(session)) {
    return <RadicacionesAdmin nombre={session.user.nombre} />;
  }

  if (!session.user.modulos.includes("radicaciones")) redirect("/");
  return <RadicacionesDashboard nombre={session.user.nombre} />;
}
