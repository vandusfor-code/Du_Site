import { requireModulo } from "@/lib/auth-helpers";
import { obtenerExtensiones } from "@/lib/extensiones";
import ExtensionesDashboard from "./ExtensionesDashboard";

export default async function ExtensionesPage() {
  await requireModulo("extensiones");

  let datos: Awaited<ReturnType<typeof obtenerExtensiones>> | null = null;
  let error: string | null = null;
  try {
    datos = await obtenerExtensiones();
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar las extensiones";
  }

  return <ExtensionesDashboard datosIniciales={datos} errorInicial={error} />;
}
