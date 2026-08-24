import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { HomeView, type TareaPendiente, type HomeData } from "@/components/home-view";
import { logoutAction } from "./logout/actions";
import { obtenerAuditoriasConEstado, obtenerConteoMesAnterior, obtenerCronograma } from "@/lib/metricas";
import { obtenerDatosCompletos } from "@/lib/duacademy";
import { obtenerNotificaciones as obtenerNotificacionesRadicaciones, obtenerRadicacionesSerie, type RadicacionDia } from "@/lib/radicaciones";
import { getNotificaciones as obtenerNotificacionesLineaAmiga, obtenerGestionesMes, obtenerPqrsfSerie, type PqrsfDia } from "@/lib/lineaAmiga";
import { resolverAsesoraId } from "@/lib/documentacion-identidad";
import { obtenerPendientesDocumentacion } from "@/lib/documentacion-editor";
import { obtenerBannerHome, type BannerHome } from "@/lib/home-config";

const TRACKABLE = ["metricas", "quiz", "radicaciones", "linea-amiga"] as const;
const RANGO_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 } as const;

// Convierte los strings de fecha heterogéneos de cada fuente a epoch ms para
// ORDENAR por urgencia (nunca se usa para mostrar). Devuelve undefined si no hay
// fecha comparable real (no se inventa una).
function parseFechaRelevante(s: string | undefined | null): number | undefined {
  if (!s) return undefined;
  const t = s.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/))) {
    return new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0).getTime();
  }
  if ((m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/))) {
    return new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0).getTime();
  }
  if ((m = t.match(/^(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?$/))) {
    const y = new Date().getFullYear();
    return new Date(y, +m[2] - 1, +m[1], m[3] ? +m[3] : 0, m[4] ? +m[4] : 0).getTime();
  }
  const d = Date.parse(t);
  return isNaN(d) ? undefined : d;
}

// Orden por RECENCIA de la tarea (bandeja de entrada): la creada/asignada/notificada
// más recientemente va primero. Se ordena por createdAtTs DESC; las tareas sin fecha
// de creación real van al final; prioridad solo como desempate exacto.
// La fecha límite (dueAtTs) NO participa en este orden.
function ordenarPorRecencia(tareas: TareaPendiente[]): void {
  tareas.sort((a, b) => {
    const ah = a.createdAtTs !== undefined;
    const bh = b.createdAtTs !== undefined;
    if (ah && bh) {
      if (a.createdAtTs !== b.createdAtTs) return (b.createdAtTs as number) - (a.createdAtTs as number);
      return RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad];
    }
    if (ah) return -1;
    if (bh) return 1;
    return RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad];
  });
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
  const esAdmin = (session?.user?.rol ?? "").trim().toLowerCase() === "admin";
  // El href de Documentación es el mismo para todos: /modulos/documentacion decide
  // server-side (dashboard Admin vs. "Mis procedimientos" de la asesora).
  const modulos = modulosPermitidos(moduloIds);

  if (!usuario) {
    return (
      <HomeView
        nombre={nombre}
        usuario=""
        esAdmin={false}
        mostrarIndicadoresGestion={false}
        modulos={modulos}
        logoutAction={logoutAction}
        tareas={[]}
        data={null}
        banner={null}
      />
    );
  }

  const has = (id: string) => moduloIds.includes(id);
  const tieneMetricas = has("metricas");
  // Las 5 tarjetas de indicadores (radicaciones/PQRSF) eran exclusivas de
  // esAdmin. Se extiende a quien tenga el módulo "linea-amiga" SIN tocar
  // esAdmin ni el Rol — es un permiso adicional, no una redefinición de Admin.
  const tieneAccesoIndicadoresGestion = esAdmin || has("linea-amiga");

  // TODAS las lecturas externas del Home en un solo batch paralelo, cada una
  // gateada por el módulo real del usuario. obtenerAuditoriasConEstado se llama
  // UNA sola vez y su resultado alimenta tanto Pendientes como el resumen.
  const [auditoriasR, duacademyR, radicacionesR, lineaAmigaR, documentacionR, conteoMesAnteriorR, gestionesMesR, cronogramaR, bannerR, serieRadR, seriePqrsfR] =
    await Promise.allSettled([
      tieneMetricas ? obtenerAuditoriasConEstado(usuario) : Promise.resolve([]),
      has("quiz") ? obtenerDatosCompletos(nombre) : Promise.resolve(null),
      has("radicaciones") ? obtenerNotificacionesRadicaciones(nombre) : Promise.resolve([]),
      has("linea-amiga") ? obtenerNotificacionesLineaAmiga(nombre) : Promise.resolve([]),
      has("documentacion") ? resolverAsesoraId(usuario).then((id) => obtenerPendientesDocumentacion(id)) : Promise.resolve([]),
      tieneMetricas ? obtenerConteoMesAnterior(usuario) : Promise.resolve(0),
      has("linea-amiga") || esAdmin ? obtenerGestionesMes() : Promise.resolve(null),
      tieneMetricas ? obtenerCronograma(nombre) : Promise.resolve([]),
      obtenerBannerHome(),
      tieneAccesoIndicadoresGestion ? obtenerRadicacionesSerie() : Promise.resolve(null),
      tieneAccesoIndicadoresGestion ? obtenerPqrsfSerie() : Promise.resolve(null),
    ]);

  const banner: BannerHome | null = bannerR.status === "fulfilled" ? bannerR.value : null;

  const auditorias = auditoriasR.status === "fulfilled" ? auditoriasR.value : [];

  // ── Construcción de Pendientes desde los datos ya cargados ──
  const listaTareas: TareaPendiente[] = [];

  auditorias
    .filter((a) => !a.comprometido)
    .forEach((a) => {
      listaTareas.push({
        id: `metricas-${a.idGestion}`,
        titulo: `Firmar compromiso: ${a.tipoGestion}`,
        moduloId: "metricas",
        moduloNombre: "Métricas",
        moduloHref: "/modulos/metricas",
        fecha: a.fecha,
        prioridad: "Media",
        createdAtTs: parseFechaRelevante(a.fecha),
      });
    });

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
      listaTareas.push({
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
        listaTareas.push({
          id: `radicaciones-${n.id}`,
          titulo: n.mensaje || `Radicado ${n.radicado}`,
          moduloId: "radicaciones",
          moduloNombre: "Radicaciones",
          moduloHref: "/modulos/radicaciones",
          fecha: n.fecha,
          prioridad: "Alta",
          createdAtTs: parseFechaRelevante(n.fecha),
        });
      });
  }

  if (lineaAmigaR.status === "fulfilled") {
    lineaAmigaR.value
      .filter((n) => n.radicado !== "HORARIO")
      .forEach((n) => {
        listaTareas.push({
          id: `linea-amiga-${n.id}`,
          titulo: n.mensaje || `Radicado ${n.radicado}`,
          moduloId: "linea-amiga",
          moduloNombre: "Línea Amiga",
          moduloHref: "/modulos/linea-amiga",
          fecha: n.fecha,
          prioridad: "Alta",
          createdAtTs: parseFechaRelevante(n.fecha),
        });
      });
  }

  if (documentacionR.status === "fulfilled") {
    documentacionR.value.forEach((p) => {
      listaTareas.push({
        id: `documentacion-${p.asignacionId}`,
        titulo: `Documentar procedimiento: ${p.titulo}`,
        moduloId: "documentacion",
        moduloNombre: p.aplicativo,
        moduloHref: `/modulos/documentacion/${p.procedimientoId}`,
        fecha: p.fechaLimite ? `Vence ${p.fechaLimite}` : "",
        prioridad: "Media",
        accion: p.accion,
        createdAtTs: p.fechaAsignacionTs, // recencia = cuándo se asignó, NO la fecha límite
        dueAtTs: p.fechaLimiteTs, // informativo
      });
    });
  }

  const sesiones = cronogramaR.status === "fulfilled" ? cronogramaR.value : [];

  const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const hoySinHora = new Date();
  hoySinHora.setHours(0, 0, 0, 0);
  sesiones
    .filter((s) => new Date(s.anio, s.mes, s.dia) >= hoySinHora)
    .forEach((s) => {
      const fechaSesion = new Date(s.anio, s.mes, s.dia);
      const fechaTexto = `${DIAS_SEMANA[fechaSesion.getDay()]} ${String(s.dia).padStart(2, "0")}/${String(s.mes + 1).padStart(2, "0")} · ${s.horario}`;
      const hm = s.horario.match(/(\d{1,2}):(\d{2})/);
      const ts = new Date(s.anio, s.mes, s.dia, hm ? +hm[1] : 0, hm ? +hm[2] : 0).getTime();
      listaTareas.push({
        id: `cronograma-${s.anio}-${s.mes}-${s.dia}-${s.horario}`,
        titulo: `${s.actividad} con ${s.companero}`,
        moduloId: "metricas",
        moduloNombre: "Métricas",
        moduloHref: "/modulos/metricas",
        fecha: fechaTexto,
        prioridad: "Media",
        // El cronograma no expone una fecha de creación real; la fecha/hora de la
        // sesión es futura (dueAtTs), NO cuándo se generó la tarea. Sin createdAtTs.
        dueAtTs: ts,
      });
    });

  ordenarPorRecencia(listaTareas);

  const diasMarcados = new Map<string, { anio: number; mes: number; dia: number; detalles: string[] }>();
  sesiones.forEach((s) => {
    const clave = `${s.anio}-${s.mes}-${s.dia}`;
    const detalle = `${s.actividad} con ${s.companero} · ${s.horario}`;
    const existente = diasMarcados.get(clave);
    if (existente) existente.detalles.push(detalle);
    else diasMarcados.set(clave, { anio: s.anio, mes: s.mes, dia: s.dia, detalles: [detalle] });
  });
  const calendario: HomeData["calendario"] = Array.from(diasMarcados.values()).map((v) => ({
    anio: v.anio,
    mes: v.mes,
    dia: v.dia,
    detalle: v.detalles.join(" · "),
  }));

  // "Tu progreso": módulos con seguimiento real que el usuario tiene y que hoy no
  // tienen ningún pendiente.
  const trackables = TRACKABLE.filter((id) => moduloIds.includes(id));
  const conPendientes = new Set(listaTareas.map((t) => t.moduloId));
  const alDia = trackables.filter((id) => !conPendientes.has(id)).length;
  const progresoPct = trackables.length > 0 ? Math.round((alDia / trackables.length) * 100) : 100;
  const progresoLabel = progresoPct >= 80 ? "Excelente 🔥" : progresoPct >= 50 ? "En progreso" : "Ponte al día";

  // Resumen de compromisos: mismo dataset de auditorías ya cargado (sin releer).
  let resumen: HomeData["resumen"] = null;
  if (tieneMetricas && auditoriasR.status === "fulfilled") {
    const items = auditorias;
    const firmados = items.filter((a) => a.comprometido).length;
    const pendientes = items.filter((a) => !a.comprometido);
    const vencidos = pendientes.filter((a) => diasDesde(a.fecha) > 5).length;
    const mesAnterior = conteoMesAnteriorR.status === "fulfilled" ? conteoMesAnteriorR.value : 0;
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
  const serieRad = serieRadR.status === "fulfilled" ? serieRadR.value : null;
  const seriePqrsf = seriePqrsfR.status === "fulfilled" ? seriePqrsfR.value : null;
  const radicacionesDias: RadicacionDia[] | null = serieRad?.dias ?? null;
  const radicacionesMeses: RadicacionDia[] | null = serieRad?.meses ?? null;
  const pqrsfDias: PqrsfDia[] | null = seriePqrsf?.dias ?? null;
  const pqrsfMeses: PqrsfDia[] | null = seriePqrsf?.meses ?? null;

  const data: HomeData = { progresoPct, progresoLabel, resumen, gestionesMes, radicacionesDias, radicacionesMeses, pqrsfDias, pqrsfMeses, calendario };

  return (
    <HomeView
      nombre={nombre}
      usuario={usuario}
      esAdmin={esAdmin}
      mostrarIndicadoresGestion={tieneAccesoIndicadoresGestion}
      modulos={modulos}
      logoutAction={logoutAction}
      tareas={listaTareas}
      data={data}
      banner={banner}
    />
  );
}
