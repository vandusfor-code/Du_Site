import { requireModulo } from "@/lib/auth-helpers";
import PqrsDashboard from "./PqrsDashboard";

export default async function PqrsPage() {
  const session = await requireModulo("pqrsf-data");
  return <PqrsDashboard nombre={session.user.nombre} />;
}
