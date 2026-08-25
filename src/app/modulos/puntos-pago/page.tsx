import { requireModuloOAdmin } from "@/lib/auth-helpers";
import { obtenerPuntosPago } from "@/lib/puntos-pago";
import { logoutAction } from "@/app/logout/actions";
import { PuntosPagoView } from "./PuntosPagoView";

export const maxDuration = 60;

export default async function PuntosPagoPage() {
  const session = await requireModuloOAdmin("puntos-pago");
  const { puntos, fuente, avisos } = await obtenerPuntosPago();

  return (
    <PuntosPagoView
      nombre={session.user.nombre}
      puntos={puntos}
      fuente={fuente}
      avisos={avisos}
      logoutAction={logoutAction}
    />
  );
}
