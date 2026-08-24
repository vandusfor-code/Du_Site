import { requireModulo } from "@/lib/auth-helpers";
import { obtenerPanelCalidad, obtenerKPIsPanelCalidad, obtenerDetalleAuditoriaCalidad } from "@/lib/gestion-calidad";
import CalidadDashboard from "./CalidadDashboard";

export default async function CalidadPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await requireModulo("calidad");
  const { id } = await searchParams;

  const [kpis, panel, detalleInicial] = await Promise.all([
    obtenerKPIsPanelCalidad(),
    obtenerPanelCalidad({}, 0),
    id
      ? obtenerDetalleAuditoriaCalidad(id).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <CalidadDashboard
      kpisIniciales={kpis}
      panelInicial={panel}
      idResaltadoInicial={id ?? null}
      detalleInicial={detalleInicial}
      nombreUsuario={session.user.nombre || session.user.usuario || "Usuario"}
      rolUsuario={session.user.rol}
    />
  );
}
