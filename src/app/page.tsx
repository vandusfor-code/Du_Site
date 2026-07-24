import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { HomeView, type TareaPendiente, type HomeData } from "@/components/home-view";
import { logoutAction } from "./logout/actions";
import { obtenerAuditoriasConEstado, obtenerConteoMesAnterior } from "@/lib/metricas";
import { obtenerDatosCompletos } from "@/lib/duacademy";
import { obtenerNotificaciones as obtenerNotificacionesRadicaciones } from "@/lib/radicaciones";
import { getNotificaciones as obtenerNotificacionesLineaAmiga, obtenerGestionesMes } from "@/lib/lineaAmiga";

const TRACKABLE = ["metricas", "quiz", "radicaciones", "linea-amiga"] as const;

async function obtenerTareasPendientes(
  nombre: string,
  usuario: string,
  moduloIds: string[]
): Promise<TareaPendiente[]> {
  const tareas: TareaPendiente[] = [];

  const [auditoriasR, duacademyR, radicacionesR, lineaAmigaR] = await Promise.allSettled([
    moduloIds.includes("metricas") ? obtenerAuditoriasConEstado(usuario) : Promise.resolve([]),
    moduloIds.includes("quiz") ? obtenerDatosCompletos(nombre) : Promise.resolve(null),
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

function diasDesde(fechaTexto: string): number {
  // Espera "dd-MM-yyyy HH:mm" (formato usado por Métricas)
  const m = fechaTexto.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return 0;
  const fecha = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const ms = Date.now() - fecha.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default async function Home() {
  const session = await auth();
  const nombre = session?.user?.nombre ?? "";
  const usuario = session?.user?.usuario ?? "";
  const moduloIds = session?.user?.modulos ?? [];
  const modulos = modulosPermitidos(moduloIds);

  if (!usuario) {
    return <HomeView nombre={nombre} modulos={modulos} logoutAction={logoutAction} tareas={[]} data={null} />;
  }

  const tieneMetricas = moduloIds.includes("metricas");

  const [tareas, auditoriasR, mesAnteriorR, gestionesMesR] = await Promise.allSettled([
    obtenerTareasPendientes(nombre, usuario, moduloIds),
    tieneMetricas ? obtenerAuditoriasConEstado(usuario) : Promise.resolve([]),
    tieneMetricas ? obtenerConteoMesAnterior(usuario) : Promise.resolve(0),
    obtenerGestionesMes(),
  ]);

  const listaTareas = tareas.status === "fulfilled" ? tareas.value : [];

  // "Tu progreso": módulos con seguimiento real (Métricas, DuAcademy, Radicaciones, Línea Amiga)
  // que el asesor tiene asignados y que hoy no tienen ningún pendiente.
  const trackables = TRACKABLE.filter((id) => moduloIds.includes(id));
  const conPendientes = new Set(listaTareas.map((t) => t.moduloId));
  const alDia = trackables.filter((id) => !conPendientes.has(id)).length;
  const progresoPct = trackables.length > 0 ? Math.round((alDia / trackables.length) * 100) : 100;
  const progresoLabel = progresoPct >= 80 ? "Excelente 🔥" : progresoPct >= 50 ? "En progreso" : "Ponte al día";

  // Resumen de compromisos: solo datos reales de Métricas. La tendencia compara contra el
  // conteo real del mes anterior (null si no hay mes anterior con qué comparar).
  let resumen: HomeData["resumen"] = null;
  if (tieneMetricas && auditoriasR.status === "fulfilled") {
    const items = auditoriasR.value;
    const firmados = items.filter((a) => a.comprometido).length;
    const pendientes = items.filter((a) => !a.comprometido);
    const vencidos = pendientes.filter((a) => diasDesde(a.fecha) > 5).length;
    const mesAnterior = mesAnteriorR.status === "fulfilled" ? mesAnteriorR.value : 0;
    const tendenciaPct = mesAnterior > 0 ? Math.round(((items.length - mesAnterior) / mesAnterior) * 100) : null;

    resumen = {
      compromisos: items.length,
      firmados,
      pendientes: pendientes.length,
      vencidos,
      tendenciaPct,
    };
  }

  const gestionesMes = gestionesMesR.status === "fulfilled" ? gestionesMesR.value : null;

  const data: HomeData = { progresoPct, progresoLabel, resumen, gestionesMes };

  return <HomeView nombre={nombre} modulos={modulos} logoutAction={logoutAction} tareas={listaTareas} data={data} />;
}
