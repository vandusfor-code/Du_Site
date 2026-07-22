import Link from "next/link";
import { requireModulo } from "@/lib/auth-helpers";
import { obtenerMetricas } from "@/lib/metricas";
import MetricasDashboard from "./MetricasDashboard";

export default async function MetricasPage() {
  const session = await requireModulo("metricas");

  let datos;
  let error: string | null = null;
  try {
    datos = await obtenerMetricas(session.user.usuario);
  } catch (e) {
    error = e instanceof Error ? e.message : "Error al cargar métricas";
  }

  if (error || !datos) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-semibold text-red-600">No se pudieron cargar tus métricas.</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return <MetricasDashboard nombre={session.user.nombre} datos={datos} />;
}
