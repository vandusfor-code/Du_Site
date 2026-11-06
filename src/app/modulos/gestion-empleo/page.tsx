import { requireModuloOAdmin, esAdminOCoordinadora } from "@/lib/auth-helpers";
import GestionEmpleoApp from "./GestionEmpleoApp";

export const maxDuration = 120;

// Gestión de empleo — Validador PILA (nativo, Supabase). Acceso: asesores con
// el módulo asignado + Admin/Coordinación (estos últimos ven Reportes/Config).
export default async function GestionEmpleoPage() {
  const session = await requireModuloOAdmin("gestion-empleo");
  return <GestionEmpleoApp nombre={session.user.nombre} esSupervision={esAdminOCoordinadora(session)} />;
}
