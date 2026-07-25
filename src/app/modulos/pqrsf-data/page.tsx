import { requireModulo } from "@/lib/auth-helpers";
import { obtenerListadoPqrsf } from "@/lib/pqrs";
import PqrsDashboard from "./PqrsDashboard";

export default async function PqrsPage() {
  const session = await requireModulo("pqrsf-data");

  let registros: Awaited<ReturnType<typeof obtenerListadoPqrsf>> = [];
  let error: string | null = null;
  try {
    registros = await obtenerListadoPqrsf();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar el listado de PQRSF";
  }

  return <PqrsDashboard nombre={session.user.nombre} registros={registros} error={error} />;
}
