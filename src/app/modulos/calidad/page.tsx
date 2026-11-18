import { requireModuloOAdmin } from "@/lib/auth-helpers";
import { obtenerSeguimientoResumen } from "@/lib/seguimiento-resumen";
import SeguimientoResumen from "./SeguimientoResumen";

export const dynamic = "force-dynamic";

export default async function CalidadPage() {
  const session = await requireModuloOAdmin("calidad");
  const { kpis, filas } = await obtenerSeguimientoResumen({});
  return (
    <SeguimientoResumen
      kpisIniciales={kpis}
      filasIniciales={filas}
      nombreUsuario={session.user.nombre || session.user.usuario || "Usuario"}
      rolUsuario={session.user.rol}
    />
  );
}
