import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { HomeView, type TareaPendiente } from "@/components/home-view";
import { logoutAction } from "./logout/actions";
import { obtenerAuditoriasConEstado } from "@/lib/metricas";
import { obtenerDatosCompletos } from "@/lib/duacademy";
import { obtenerNotificaciones as obtenerNotificacionesRadicaciones } from "@/lib/radicaciones";
import { getNotificaciones as obtenerNotificacionesLineaAmiga } from "@/lib/lineaAmiga";

async function obtenerTareasPendientes(
  nombre: string,
  usuario: string,
  moduloIds: string[]
): Promise<TareaPendiente[]> {
  const tareas: TareaPendiente[] = [];

  const [auditoriasR, duacademyR, radicacionesR, lineaAmigaR] = await Promise.allSettled([
    moduloIds.includes("metricas") ? obtenerAuditoriasConEstado(usuario) : Promise.resolve([]),
    moduloIds.includes("quiz") ? obtenerDatosCompletos(usuario) : Promise.resolve(null),
    moduloIds.includes("radicaciones") ? obtenerNotificacionesRadicaciones(nombre) : Promise.resolve([]),
    moduloIds.includes("linea-amiga") ? obtenerNotificacionesLineaAmiga(nombre) : Promise.resolve([]),
  ]);

  if (auditoriasR.status === "fulfilled") {
    auditoriasR.value
      .filter((a) => !a.comprometido)
      .forEach((a) => {
        tareas.push({
          id: `metricas-${a.idGestion}`,
          titulo: `Firmar compromiso: ${a.tipoGestion}`,
          moduloId: "metricas",
          moduloNombre: "Métricas",
          moduloHref: "/modulos/metricas",
          fecha: a.fecha,
          prioridad: "Media",
        });
      });
  }

  if (duacademyR.status === "fulfilled" && duacademyR.value) {
    const datos = duacademyR.value;
    const hechos = new Set(datos.historial.map((h) => h.idItem));
    const cursosPendientes = datos.todosLosCursos.filter(
      (c) => datos.asignadosCursos.includes(c.ID_MODULO) && !hechos.has(c.ID_MODULO)
    );
    const simsPendientes = datos.todasLasSims.filter(
      (s) => datos.asignadosSims.includes(s.ID_SIMULACION) && !hechos.has(s.ID_SIMULACION)
    );
    [...cursosPendientes, ...simsPendientes].forEach((item, i) => {
      tareas.push({
        id: `duacademy-${item.ID_MODULO || item.ID_SIMULACION || i}`,
        titulo: `Completar: ${item.TITULO || "Formación asignada"}`,
        moduloId: "quiz",
        moduloNombre: "DuAcademy",
        moduloHref: "/modulos/quiz",
        fecha: "",
        prioridad: "Baja",
      });
    });
  }

  if (radicacionesR.status === "fulfilled") {
    radicacionesR.value
      .filter((n) => n.radicado !== "HORARIO")
      .forEach((n) => {
        tareas.push({
          id: `radicaciones-${n.id}`,
          titulo: n.mensaje || `Radicado ${n.radicado}`,
          moduloId: "radicaciones",
          moduloNombre: "Radicaciones",
          moduloHref: "/modulos/radicaciones",
          fecha: n.fecha,
          prioridad: "Alta",
        });
      });
  }

  if (lineaAmigaR.status === "fulfilled") {
    lineaAmigaR.value
      .filter((n) => n.radicado !== "HORARIO")
      .forEach((n) => {
        tareas.push({
          id: `linea-amiga-${n.id}`,
          titulo: n.mensaje || `Radicado ${n.radicado}`,
          moduloId: "linea-amiga",
          moduloNombre: "Línea Amiga",
          moduloHref: "/modulos/linea-amiga",
          fecha: n.fecha,
          prioridad: "Alta",
        });
      });
  }

  const rango = { Alta: 0, Media: 1, Baja: 2 } as const;
  tareas.sort((a, b) => rango[a.prioridad] - rango[b.prioridad]);
  return tareas;
}

export default async function Home() {
  const session = await auth();
  const nombre = session?.user?.nombre ?? "";
  const usuario = session?.user?.usuario ?? "";
  const moduloIds = session?.user?.modulos ?? [];
  const modulos = modulosPermitidos(moduloIds);

  const tareas = usuario ? await obtenerTareasPendientes(nombre, usuario, moduloIds) : [];

  return (
    <HomeView nombre={nombre} modulos={modulos} logoutAction={logoutAction} tareas={tareas} />
  );
}
