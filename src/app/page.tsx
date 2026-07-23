import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { HomeView } from "@/components/home-view";
import { logoutAction } from "./logout/actions";
import { obtenerAuditoriasConEstado } from "@/lib/metricas";
import { obtenerDatosCompletos } from "@/lib/duacademy";

async function obtenerPendientes(usuario: string, moduloIds: string[]) {
  const [auditorias, duacademy] = await Promise.all([
    moduloIds.includes("metricas")
      ? obtenerAuditoriasConEstado(usuario)
          .then((items) => items.filter((a) => !a.comprometido).length)
          .catch(() => undefined)
      : Promise.resolve(undefined),
    moduloIds.includes("quiz")
      ? obtenerDatosCompletos(usuario)
          .then((datos) => {
            if (!datos) return undefined;
            const hechos = new Set(datos.historial.map((h) => h.idItem));
            const asignados = [...datos.asignadosCursos, ...datos.asignadosSims];
            return asignados.filter((id) => !hechos.has(id)).length;
          })
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  return { auditorias, duacademy };
}

export default async function Home() {
  const session = await auth();
  const nombre = session?.user?.nombre ?? "";
  const usuario = session?.user?.usuario ?? "";
  const moduloIds = session?.user?.modulos ?? [];
  const modulos = modulosPermitidos(moduloIds);

  const pendientes = usuario ? await obtenerPendientes(usuario, moduloIds) : {};

  return (
    <HomeView
      nombre={nombre}
      modulos={modulos}
      logoutAction={logoutAction}
      pendientes={pendientes}
    />
  );
}
