import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { obtenerCronograma } from "@/lib/metricas";
import { logoutAction } from "../logout/actions";
import CalendarioView, { type CalendarioEvento } from "./CalendarioView";

export const maxDuration = 30;

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user?.usuario) redirect("/login");

  const nombre = session.user.nombre ?? "";
  const tieneMetricas = (session.user.modulos ?? []).includes("metricas");

  // Fuente real: el Cronograma (Role Play / Escuchas) de la asesora autenticada.
  // Solo se consulta si tiene el módulo de Métricas (donde vive esa hoja).
  let eventos: CalendarioEvento[] = [];
  if (tieneMetricas) {
    try {
      const sesiones = await obtenerCronograma(nombre);
      eventos = sesiones.map((s, i) => ({
        id: `${s.anio}-${s.mes}-${s.dia}-${i}`,
        anio: s.anio,
        mes: s.mes,
        dia: s.dia,
        horario: s.horario,
        actividad: s.actividad,
        companero: s.companero,
        link: s.link,
      }));
    } catch {
      eventos = [];
    }
  }

  return <CalendarioView nombre={nombre} eventos={eventos} logoutAction={logoutAction} />;
}
