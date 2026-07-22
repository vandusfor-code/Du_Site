import { requireModulo } from "@/lib/auth-helpers";
import RadicacionesDashboard from "./RadicacionesDashboard";

export default async function RadicacionesPage() {
  const session = await requireModulo("radicaciones");
  return <RadicacionesDashboard nombre={session.user.nombre} />;
}
