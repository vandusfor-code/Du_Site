import { requireAdmin } from "@/lib/auth-helpers";
import ConfiguracionDashboard from "./ConfiguracionDashboard";

export const maxDuration = 60;

export default async function ConfiguracionPage() {
  const session = await requireAdmin();
  return <ConfiguracionDashboard nombre={session.user.nombre} />;
}
