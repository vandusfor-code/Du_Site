import { auth } from "@/auth";
import { modulosPermitidos, type ModuloId } from "@/lib/modulos";
import { HomeView, type TareaPendiente, type HomeData } from "@/components/home-view";
import { logoutAction } from "./logout/actions";
import { obtenerAuditoriasConEstado, obtenerMetricas } from "@/lib/metricas";
import { obtenerDatosCompletos } from "@/lib/duacademy";
import {
  obtenerNotificaciones as obtenerNotificacionesRadicaciones,
  obtenerResumenHoy as obtenerResumenHoyRadicaciones,
  obtenerResumenMes,
  obtenerHorarioHoy as obtenerHorarioHoyRadicaciones,
} from "@/lib/radicaciones";
import {
  getNotificaciones as obtenerNotificacionesLineaAmiga,
  getHistorial as obtenerHistorialLineaAmiga,
  obtenerHorarioHoy as obtenerHorarioHoyLineaAmiga,
} from "@/lib/lineaAmiga";
import { obtenerResumenPqrsf } from "@/lib/pqrs";

const TRACKABLE: ModuloId[] = ["metricas", "quiz", "radicaciones", "linea-amiga"];

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
    return (
      <HomeView
        nombre={nombre}
        modulos={modulos}
        logoutAction={logoutAction}
        tareas={[]}
        data={null}
      />
    );
  }

  const tieneMetricas = moduloIds.includes("metricas");
  const tieneQuiz = moduloIds.includes("quiz");
  const tieneRadicaciones = moduloIds.includes("radicaciones");
  const tieneLineaAmiga = moduloIds.includes("linea-amiga");
  const tienePqrsf = moduloIds.includes("pqrsf-data");

  const [
    tareas,
    metricasR,
    auditoriasR,
    duacademyR,
    resumenHoyRadR,
    resumenMesRadR,
    horarioRadR,
    historialLaR,
    horarioLaR,
    pqrsfR,
  ] = await Promise.allSettled([
    obtenerTareasPendientes(nombre, usuario, moduloIds),
    tieneMetricas ? obtenerMetricas(usuario) : Promise.resolve(null),
    tieneMetricas ? obtenerAuditoriasConEstado(usuario) : Promise.resolve([]),
    tieneQuiz ? obtenerDatosCompletos(usuario) : Promise.resolve(null),
    tieneRadicaciones ? obtenerResumenHoyRadicaciones(nombre) : Promise.resolve(null),
    tieneRadicaciones ? obtenerResumenMes(nombre) : Promise.resolve(0),
    tieneRadicaciones ? obtenerHorarioHoyRadicaciones(nombre) : Promise.resolve(null),
    tieneLineaAmiga ? obtenerHistorialLineaAmiga(nombre) : Promise.resolve(null),
    tieneLineaAmiga ? obtenerHorarioHoyLineaAmiga(nombre) : Promise.resolve(null),
    tienePqrsf ? obtenerResumenPqrsf() : Promise.resolve(null),
  ]);

  const listaTareas = tareas.status === "fulfilled" ? tareas.value : [];

  // "Tu progreso": módulos con seguimiento real (Métricas, DuAcademy, Radicaciones, Línea Amiga)
  // que el asesor tiene asignados y que hoy no tienen ningún pendiente.
  const trackables = TRACKABLE.filter((id) => moduloIds.includes(id));
  const conPendientes = new Set(listaTareas.map((t) => t.moduloId));
  const alDia = trackables.filter((id) => !conPendientes.has(id)).length;
  const progresoPct = trackables.length > 0 ? Math.round((alDia / trackables.length) * 100) : 100;
  const progresoLabel = progresoPct >= 80 ? "Excelente 🔥" : progresoPct >= 50 ? "En progreso" : "Ponte al día";

  // Calidad: primer indicador porcentual real del área del asesor en Métricas
  let calidad: HomeData["calidad"] = null;
  if (metricasR.status === "fulfilled" && metricasR.value) {
    const metricaPct = metricasR.value.metrics.find((m) => m.value.includes("%"));
    if (metricaPct) calidad = { label: metricaPct.label, valor: metricaPct.value };
  }

  // Turno: se prioriza Línea Amiga; si no, Radicaciones
  let turno: HomeData["turno"] = { horario: null, moduloOrigen: null };
  if (tieneLineaAmiga && horarioLaR.status === "fulfilled" && horarioLaR.value) {
    turno = { horario: horarioLaR.value, moduloOrigen: "linea-amiga" };
  } else if (tieneRadicaciones && horarioRadR.status === "fulfilled" && horarioRadR.value) {
    turno = { horario: horarioRadR.value, moduloOrigen: "radicaciones" };
  }

  const pqrsf = pqrsfR.status === "fulfilled" ? pqrsfR.value : null;

  const cardRadicaciones =
    tieneRadicaciones && resumenHoyRadR.status === "fulfilled" && resumenHoyRadR.value
      ? { hoy: resumenHoyRadR.value.total, mes: resumenMesRadR.status === "fulfilled" ? resumenMesRadR.value : 0 }
      : null;

  const cardDuAcademy =
    tieneQuiz && duacademyR.status === "fulfilled" && duacademyR.value
      ? (() => {
          const d = duacademyR.value!;
          const total = d.asignadosCursos.length + d.asignadosSims.length;
          const hechos = d.historial.length;
          return { pct: total > 0 ? Math.round((hechos / total) * 100) : 0 };
        })()
      : null;

  const cardLineaAmiga =
    tieneLineaAmiga && historialLaR.status === "fulfilled" && historialLaR.value
      ? { hoy: historialLaR.value.hoy }
      : null;

  // Resumen semanal: solo a partir de compromisos reales de Métricas (único módulo con
  // fecha por ítem que permite distinguir "vencido"). Sin deltas inventados.
  let resumenSemanal: HomeData["resumenSemanal"] = null;
  if (tieneMetricas && auditoriasR.status === "fulfilled") {
    const items = auditoriasR.value;
    const firmados = items.filter((a) => a.comprometido).length;
    const pendientes = items.filter((a) => !a.comprometido);
    const vencidos = pendientes.filter((a) => diasDesde(a.fecha) > 5).length;

    const actividad = [
      { label: "Métricas", pct: 0, color: "#2563EB", valor: items.length },
      { label: "Radicaciones", pct: 0, color: "#EA580C", valor: cardRadicaciones?.mes ?? 0 },
      { label: "PQRSF", pct: 0, color: "#0D9488", valor: pqrsf?.casosEnBase ? pqrsf.consultasPorDia.reduce((a, b) => a + b, 0) : 0 },
      { label: "Línea Amiga", pct: 0, color: "#7C6FCB", valor: cardLineaAmiga?.hoy ?? 0 },
    ].filter((a) => moduloIds.includes(a.label === "Métricas" ? "metricas" : a.label === "Radicaciones" ? "radicaciones" : a.label === "PQRSF" ? "pqrsf-data" : "linea-amiga"));

    const totalActividad = actividad.reduce((a, b) => a + b.valor, 0) || 1;
    const areas = actividad.map((a) => ({ label: a.label, color: a.color, pct: Math.round((a.valor / totalActividad) * 100) }));

    resumenSemanal = {
      compromisos: items.length,
      firmados,
      pendientes: pendientes.length,
      vencidos,
      serie: pqrsf?.consultasPorDia ?? [],
      areas,
    };
  }

  const data: HomeData = {
    progresoPct,
    progresoLabel,
    calidad,
    turno,
    pqrsf,
    cardRadicaciones,
    cardDuAcademy,
    cardLineaAmiga,
    resumenSemanal,
  };

  return (
    <HomeView nombre={nombre} modulos={modulos} logoutAction={logoutAction} tareas={listaTareas} data={data} />
  );
}
