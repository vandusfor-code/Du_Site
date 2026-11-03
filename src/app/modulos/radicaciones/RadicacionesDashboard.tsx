"use client";

import "./radicaciones.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronLeft, ChevronRight, MoreHorizontal, CalendarDays, FileText, CheckCircle2, RotateCcw, TrendingUp, Send, AlertTriangle, Clock, Plus, ShieldAlert } from "lucide-react";
import {
  obtenerAsesoresAction,
  guardarRadicacionAction,
  obtenerResumenHoyAction,
  obtenerHistorialAction,
  buscarGeneralAction,
  obtenerNotificacionesAction,
  marcarRecibidoAction,
  obtenerChatAction,
  enviarMensajeChatAction,
  obtenerHorarioHoyAction,
  verificarHorariosAction,
  registrarSNCAction,
  obtenerSNCAction,
  cambiarEstadoSNCAction,
} from "./actions";
import type {
  Asesor,
  ResumenHoy,
  HistorialItem,
  BusquedaGeneralResultado,
  Notificacion,
  MensajeChat,
  HorarioHoy,
  SNCDeAsesora,
} from "@/lib/radicaciones";
import { TRANSICIONES, type SNCItem, type EstadoSNC } from "@/lib/radicaciones-snc-tipos";
import { SoundToggleButton } from "@/components/module-shell";

type Vista = "radicacion" | "snc" | "search" | "notifications" | "chat";

const NOMBRES_VISTA: Record<Vista, string> = {
  radicacion: "Radicación",
  snc: "Gestión de Calidad (SNC)",
  search: "Búsqueda Global",
  notifications: "Centro de Notificaciones",
  chat: "Comunicación Interna",
};

const FILAS_POR_PAGINA_OPCIONES = [10, 20, 50];

const ALERT_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// item.fecha viene formateada "dd/MM/yyyy" desde el servidor (formatSheetDate).
function fechaDentroDeRango(fechaStr: string, filtro: "hoy" | "semana" | "mes", ahora: Date): boolean {
  const m = fechaStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return true;
  const fecha = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  if (filtro === "hoy") return fecha.getTime() === hoy.getTime();
  if (filtro === "mes") return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth();

  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // lunes
  return fecha.getTime() >= inicioSemana.getTime() && fecha.getTime() <= hoy.getTime();
}

function parseTimeClient(str: string | undefined): Date | null {
  if (!str || str === "Sin break" || str === "-" || str === "DESCANSO") return null;
  const match = str.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const mod = match[3];
  if (hours === 12 && mod === "am") hours = 0;
  else if (hours !== 12 && mod === "pm") hours += 12;
  const d = new Date();
  d.setHours(hours, mins, 0, 0);
  return d;
}

export default function RadicacionesDashboard({ nombre }: { nombre: string }) {
  const [vista, setVista] = useState<Vista>("radicacion");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [resumen, setResumen] = useState<ResumenHoy>({ efectivos: 0, devueltos: 0, total: 0 });
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  const [regRadicado, setRegRadicado] = useState("");
  const [regFecha, setRegFecha] = useState("");
  const [regDevuelto, setRegDevuelto] = useState(false);
  const [regObs, setRegObs] = useState("");
  const [guardandoReg, setGuardandoReg] = useState(false);

  const [histQuery, setHistQuery] = useState("");
  const [histFecha, setHistFecha] = useState("todas");
  const [histEstado, setHistEstado] = useState("todos");
  const [histDevuelto, setHistDevuelto] = useState("todos");
  const [histPagina, setHistPagina] = useState(1);
  const [histFilasPorPagina, setHistFilasPorPagina] = useState(10);

  const [sncData, setSncData] = useState<SNCDeAsesora>({ pendientes: [], terminadas: [], hayVencidas: false });
  const [sncRadicado, setSncRadicado] = useState("");
  const [sncMotivo, setSncMotivo] = useState("");
  const [sncNoAplica, setSncNoAplica] = useState(false);
  const [guardandoSnc, setGuardandoSnc] = useState(false);
  const [cambiando, setCambiando] = useState<SNCItem | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoSNC>("Enviada a corrección");
  const [notaEstado, setNotaEstado] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const [dbQuery, setDbQuery] = useState("");
  const [dbResult, setDbResult] = useState<BusquedaGeneralResultado | null | undefined>(undefined);

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notifBadge, setNotifBadge] = useState(0);
  const lastNotifTotal = useRef(0);
  const lastNotifSeen = useRef(0);

  const [chat, setChat] = useState<MensajeChat[]>([]);
  const [chatBadge, setChatBadge] = useState(0);
  const [chatMsg, setChatMsg] = useState("");
  const [chatDest, setChatDest] = useState("TODOS");
  const lastChatTotal = useRef(0);
  const lastChatSeen = useRef(0);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const [shift, setShift] = useState<HorarioHoy | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [wfmAlert, setWfmAlert] = useState<Notificacion | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vistaRef = useRef(vista);
  const wfmAlertRef = useRef<Notificacion | null>(null);

  useEffect(() => {
    vistaRef.current = vista;
  }, [vista]);

  useEffect(() => {
    wfmAlertRef.current = wfmAlert;
  }, [wfmAlert]);

  const mostrarToast = useCallback((text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const playAlert = useCallback(() => {
    if (!soundOn) return;
    audioRef.current?.play().catch(() => {});
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [soundOn]);

  const stopAlertLoop = useCallback(() => {
    if (alertIntervalRef.current) clearInterval(alertIntervalRef.current);
    alertIntervalRef.current = null;
  }, []);

  const refreshDashboard = useCallback(() => {
    obtenerResumenHoyAction().then(setResumen);
    obtenerHistorialAction().then(setHistorial);
  }, []);

  const refreshSNC = useCallback(() => {
    obtenerSNCAction().then(setSncData).catch(() => {});
  }, []);

  const refreshNotifs = useCallback(async () => {
    const data = await obtenerNotificacionesAction();
    if (data.length > lastNotifTotal.current) playAlert();
    lastNotifTotal.current = data.length;

    if (vistaRef.current === "notifications") {
      lastNotifSeen.current = data.length;
      setNotifBadge(0);
    } else {
      const unread = data.length - lastNotifSeen.current;
      setNotifBadge(unread > 0 ? unread : 0);
    }

    const alertaHorario = data.find((n) => n.radicado === "HORARIO");
    if (alertaHorario && !wfmAlertRef.current) {
      setWfmAlert(alertaHorario);
    }

    setNotificaciones(data);
  }, [playAlert]);

  const refreshChat = useCallback(async () => {
    const data = await obtenerChatAction();
    if (data.length > lastChatTotal.current) {
      const ultimo = data[data.length - 1];
      if (ultimo.usuario !== nombre) playAlert();
    }
    lastChatTotal.current = data.length;

    if (vistaRef.current === "chat") {
      lastChatSeen.current = data.length;
      setChatBadge(0);
    } else {
      const unread = data.length - lastChatSeen.current;
      setChatBadge(unread > 0 ? unread : 0);
    }

    setChat(data);
  }, [nombre, playAlert]);

  useEffect(() => {
    obtenerAsesoresAction().then(setAsesores);
    refreshDashboard();
    refreshSNC();
    obtenerHorarioHoyAction().then(setShift);
    refreshChat();
    refreshNotifs();

    // Cada lectura de estos pollers pega contra Sheets, y la cuota
    // ("Read requests per minute") es compartida por todo el proyecto, no
    // por usuario — con varias pestañas de Radicaciones/Línea Amiga
    // abiertas a la vez, el sondeo agresivo (antes 4s/10s) por sí solo podía
    // superar el límite de forma sostenida durante todo el turno, afectando
    // a cualquier otra página del portal. Se reduce la frecuencia a la
    // mitad — sigue sintiéndose "en vivo" con mucha menos carga constante.
    const pollChat = setInterval(refreshChat, 8000);
    const pollNotif = setInterval(refreshNotifs, 20000);
    const tick = setInterval(() => setNow(new Date()), 1000);
    const pollHorarios = setInterval(() => {
      verificarHorariosAction();
    }, 60000);

    return () => {
      clearInterval(pollChat);
      clearInterval(pollNotif);
      clearInterval(tick);
      clearInterval(pollHorarios);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarVista(v: Vista) {
    setVista(v);
    if (v === "radicacion") refreshDashboard();
    if (v === "snc") refreshSNC();
    if (v === "notifications") {
      lastNotifSeen.current = notificaciones.length;
      setNotifBadge(0);
    }
    if (v === "chat") {
      lastChatSeen.current = chat.length;
      setChatBadge(0);
    }
  }

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chat]);

  useEffect(() => {
    if (wfmAlert) {
      playAlert();
      alertIntervalRef.current = setInterval(playAlert, 3000);
    } else {
      stopAlertLoop();
    }
    return () => stopAlertLoop();
  }, [wfmAlert, playAlert, stopAlertLoop]);

  function cerrarAlertaWfm() {
    const id = wfmAlert?.id;
    setWfmAlert(null);
    if (id) marcarRecibidoAction(id).then(refreshNotifs);
  }

  function limpiarFormulario() {
    setRegRadicado("");
    setRegFecha("");
    setRegDevuelto(false);
    setRegObs("");
  }

  async function submitRegistration() {
    if (!regRadicado.trim()) return mostrarToast("El radicado es obligatorio", true);

    setGuardandoReg(true);
    try {
      const res = await guardarRadicacionAction({
        radicado: regRadicado,
        fecha: regFecha,
        devuelto: regDevuelto,
        sncProceso: false,
        observacion: regObs,
      });
      if (res.success) {
        mostrarToast("Radicado registrado con éxito");
        limpiarFormulario();
        refreshDashboard();
      } else {
        mostrarToast(res.error ?? "Error al guardar", true);
      }
    } catch {
      mostrarToast("No se pudo guardar. Revisa tu conexión e intenta de nuevo.", true);
    } finally {
      setGuardandoReg(false);
    }
  }

  async function registrarSnc() {
    if (!sncRadicado.trim()) return mostrarToast("El radicado es obligatorio", true);
    if (!sncMotivo.trim()) return mostrarToast("Describe el motivo de la SNC", true);
    setGuardandoSnc(true);
    try {
      const res = await registrarSNCAction(sncRadicado, sncMotivo, sncNoAplica);
      if (res.success) {
        mostrarToast(sncNoAplica ? "Registrada como 'No corresponde'" : "Salida no conforme registrada");
        setSncRadicado("");
        setSncMotivo("");
        setSncNoAplica(false);
        refreshSNC();
      } else {
        mostrarToast(res.error ?? "No se pudo registrar la SNC", true);
      }
    } catch {
      mostrarToast("No se pudo registrar. Revisa tu conexión e intenta de nuevo.", true);
    } finally {
      setGuardandoSnc(false);
    }
  }

  function abrirCambio(s: SNCItem) {
    setCambiando(s);
    // Sugerencia de avance: si ya está "Enviada a corrección", el siguiente paso es solucionar.
    setNuevoEstado(s.estado === "Enviada a corrección" ? "Solucionada" : "Enviada a corrección");
    setNotaEstado("");
  }

  const estadoRequiereNota = nuevoEstado === "Cancelada" || nuevoEstado === "No corresponde";

  async function confirmarCambio() {
    if (!cambiando) return;
    if (estadoRequiereNota && !notaEstado.trim()) return mostrarToast("Indica el motivo", true);
    setGuardandoEstado(true);
    try {
      const res = await cambiarEstadoSNCAction(cambiando.fila, nuevoEstado, notaEstado);
      if (res.success) {
        mostrarToast(`SNC actualizada: ${nuevoEstado}`);
        setCambiando(null);
        setNotaEstado("");
        refreshSNC();
      } else {
        mostrarToast(res.error ?? "No se pudo actualizar", true);
      }
    } catch {
      mostrarToast("No se pudo actualizar. Revisa tu conexión e intenta de nuevo.", true);
    } finally {
      setGuardandoEstado(false);
    }
  }

  async function handleDbSearch() {
    if (!dbQuery.trim()) return;
    const res = await buscarGeneralAction(dbQuery);
    setDbResult(res);
  }

  async function markRead(id: number) {
    await marcarRecibidoAction(id);
    refreshNotifs();
  }

  async function handleChatSend() {
    if (!chatMsg.trim()) return;
    await enviarMensajeChatAction(chatMsg, chatDest);
    setChatMsg("");
    refreshChat();
  }

  const wfm = computeWfm(shift, now);

  const filasHistorialFiltradas = useMemo(() => {
    const texto = histQuery.trim().toLowerCase();
    return historial.filter((item) => {
      const isDev = ["si", "sí"].includes(item.devuelto.toLowerCase());
      const coincide = `${item.radicado} ${item.observacion}`.toLowerCase().includes(texto);
      const fechaOk = histFecha === "todas" || fechaDentroDeRango(item.fecha, histFecha as "hoy" | "semana" | "mes", now);
      const estadoOk = histEstado === "todos" || (histEstado === "devuelta") === isDev;
      const devueltoOk = histDevuelto === "todos" || (histDevuelto === "si") === isDev;
      return coincide && fechaOk && estadoOk && devueltoOk;
    });
  }, [historial, histQuery, histFecha, histEstado, histDevuelto, now]);

  const histTotalPaginas = Math.max(1, Math.ceil(filasHistorialFiltradas.length / histFilasPorPagina));
  const histPaginaActual = Math.min(histPagina, histTotalPaginas);
  const histInicio = (histPaginaActual - 1) * histFilasPorPagina;
  const filasHistorialPagina = filasHistorialFiltradas.slice(histInicio, histInicio + histFilasPorPagina);

  const histPaginasVisibles = useMemo(() => {
    const ventana = 5;
    let desde = Math.max(1, histPaginaActual - Math.floor(ventana / 2));
    const hasta = Math.min(histTotalPaginas, desde + ventana - 1);
    desde = Math.max(1, hasta - ventana + 1);
    const arr: number[] = [];
    for (let i = desde; i <= hasta; i++) arr.push(i);
    return arr;
  }, [histPaginaActual, histTotalPaginas]);

  return (
    <div className="radic-scope">
      <audio ref={audioRef} src={ALERT_SOUND_URL} preload="auto" />

      <div className={`toast ${toast ? "active" : ""} ${toast?.error ? "error" : ""}`}>
        {toast?.text}
      </div>

      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">P</div>
          <div className="brand-name">People BPO</div>
        </div>

        <nav className="nav-list">
          {(Object.keys(NOMBRES_VISTA) as Vista[]).map((v) => (
            <div
              key={v}
              className={`nav-link ${vista === v ? "active" : ""}`}
              onClick={() => cambiarVista(v)}
            >
              <span>{NOMBRES_VISTA[v]}</span>
              {v === "snc" && sncData.pendientes.length > 0 && (
                <span className={`nav-badge active ${sncData.hayVencidas ? "danger" : ""}`}>{sncData.pendientes.length}</span>
              )}
              {v === "notifications" && (
                <span className={`nav-badge ${notifBadge > 0 ? "active" : ""}`}>{notifBadge}</span>
              )}
              {v === "chat" && (
                <span className={`nav-badge ${chatBadge > 0 ? "active" : ""}`}>{chatBadge}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{nombre[0]}</div>
          <div className="user-meta">
            <h4>{nombre}</h4>
            <p>Funcionario Activo</p>
          </div>
          <SoundToggleButton soundOn={soundOn} toggleSound={() => setSoundOn((v) => !v)} />
        </div>
        <Link href="/" className="btn-primary" style={{ background: "rgba(255,255,255,0.05)", color: "white", padding: 12, fontSize: 13, textDecoration: "none" }}>
          Volver al inicio
        </Link>
      </aside>

      <main className="main-canvas">
        <header className="top-bar">
          <div className="page-title">
            <h2>{NOMBRES_VISTA[vista]}</h2>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            {now.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </header>

        <div className="scroll-area">
          {vista === "radicacion" && (
            <section className="radic-view">
              <div className="radicacion-head">
                <p>Registra, consulta y da seguimiento a las radicaciones gestionadas.</p>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card turno">
                  <div className="kpi-top">
                    <span className="kpi-icon lime"><CalendarDays size={20} /></span>
                    <span className="kpi-label">Turno del día</span>
                  </div>
                  <div className="kpi-turno-status">
                    <span className={`status-dot ${wfm.colorClass}`} />
                    <span>{wfm.status}</span>
                  </div>
                  <p className="kpi-turno-line">Jornada: <b>{wfm.jornadaTexto}</b></p>
                  <p className="kpi-turno-line">Próximo: <b>{wfm.nextLabel}</b></p>
                  <div className="kpi-turno-timer">{wfm.countdown}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon violet"><FileText size={20} /></span>
                    <span className="kpi-label">Radicaciones de hoy</span>
                  </div>
                  <div className="kpi-value">{resumen.total}</div>
                  <p className="kpi-sub">Gestiones de hoy</p>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon green"><CheckCircle2 size={20} /></span>
                    <span className="kpi-label">Exitosas</span>
                  </div>
                  <div className="kpi-value">{resumen.efectivos}</div>
                  <p className="kpi-sub green">
                    {resumen.total > 0 ? Math.round((resumen.efectivos / resumen.total) * 100) : 0}% del total
                  </p>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon red"><RotateCcw size={20} /></span>
                    <span className="kpi-label">Devueltas</span>
                  </div>
                  <div className="kpi-value">{resumen.devueltos}</div>
                  <p className="kpi-sub red">
                    {resumen.total > 0 ? Math.round((resumen.devueltos / resumen.total) * 100) : 0}% del total
                  </p>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon violet"><TrendingUp size={20} /></span>
                    <span className="kpi-label">Eficiencia</span>
                  </div>
                  <div className="kpi-value">
                    {resumen.total > 0 ? Math.round((resumen.efectivos / resumen.total) * 100) : 0}%
                  </div>
                  <p className="kpi-sub">Rendimiento global</p>
                </div>
              </div>

              <div className="radicacion-body">
                <div className="section-card">
                  <div className="section-header">
                    <h3>Historial de radicaciones</h3>
                  </div>

                  <div className="hist-toolbar">
                    <label className="hist-search">
                      <Search size={16} />
                      <input
                        placeholder="Buscar por código u observaciones..."
                        value={histQuery}
                        onChange={(e) => { setHistQuery(e.target.value); setHistPagina(1); }}
                      />
                    </label>
                    <select className="hist-select" value={histFecha} onChange={(e) => { setHistFecha(e.target.value); setHistPagina(1); }}>
                      <option value="todas">Fecha · Todas</option>
                      <option value="hoy">Fecha · Hoy</option>
                      <option value="semana">Fecha · Esta semana</option>
                      <option value="mes">Fecha · Este mes</option>
                    </select>
                    <select className="hist-select" value={histEstado} onChange={(e) => { setHistEstado(e.target.value); setHistPagina(1); }}>
                      <option value="todos">Estado · Todos</option>
                      <option value="exitosa">Estado · Exitosa</option>
                      <option value="devuelta">Estado · Devuelta</option>
                    </select>
                    <select className="hist-select" value={histDevuelto} onChange={(e) => { setHistDevuelto(e.target.value); setHistPagina(1); }}>
                      <option value="todos">¿Devuelto? · Todos</option>
                      <option value="si">¿Devuelto? · Sí</option>
                      <option value="no">¿Devuelto? · No</option>
                    </select>
                  </div>

                  <div className="hist-table-wrap">
                    <table className="hist-table">
                      <thead>
                        <tr>
                          <th>CÓDIGO</th>
                          <th>FECHA DEL CASO</th>
                          <th>¿DEVUELTO?</th>
                          <th>SNC</th>
                          <th>ESTADO</th>
                          <th>OBSERVACIONES</th>
                          <th>ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasHistorialPagina.length === 0 ? (
                          <tr>
                            <td className="empty" colSpan={7}>
                              {historial.length === 0 ? "No hay registros recientes" : "No se encontraron radicaciones con estos filtros."}
                            </td>
                          </tr>
                        ) : (
                          filasHistorialPagina.map((item, i) => {
                            const isDev = ["si", "sí"].includes(item.devuelto.toLowerCase());
                            const isSnc = ["si", "sí"].includes(item.snc.toLowerCase());
                            return (
                              <tr key={i}>
                                <td><b>{item.radicado}</b></td>
                                <td>{item.fecha}</td>
                                <td><span className={isDev ? "hist-badge-yes" : "hist-badge-no"}>{isDev ? "Sí" : "No"}</span></td>
                                <td>{isSnc ? "Sí" : "No"}</td>
                                <td><span className={`status-pill ${isDev ? "error" : "success"}`}>{isDev ? "Devuelta" : "Exitosa"}</span></td>
                                <td>{item.observacion || "—"}</td>
                                <td><MoreHorizontal size={16} style={{ color: "var(--text-muted)" }} /></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="hist-pager">
                    <span>
                      Mostrando {filasHistorialFiltradas.length === 0 ? 0 : histInicio + 1} a{" "}
                      {Math.min(histInicio + histFilasPorPagina, filasHistorialFiltradas.length)} de {filasHistorialFiltradas.length} radicaciones
                    </span>
                    <div className="hist-pages">
                      <button type="button" disabled={histPaginaActual === 1} onClick={() => setHistPagina((p) => Math.max(1, p - 1))}>
                        <ChevronLeft size={15} />
                      </button>
                      {histPaginasVisibles.map((p) => (
                        <button key={p} type="button" className={p === histPaginaActual ? "current" : ""} onClick={() => setHistPagina(p)}>
                          {p}
                        </button>
                      ))}
                      <button type="button" disabled={histPaginaActual === histTotalPaginas} onClick={() => setHistPagina((p) => Math.min(histTotalPaginas, p + 1))}>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <span className="hist-pager-rows">
                      Filas por página:
                      <select value={histFilasPorPagina} onChange={(e) => { setHistFilasPorPagina(Number(e.target.value)); setHistPagina(1); }}>
                        {FILAS_POR_PAGINA_OPCIONES.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </span>
                  </div>
                </div>

                <aside className="side-panel">
                  <div className="side-panel-head">
                    <div>
                      <h2>Nueva radicación</h2>
                      <p>Completa los datos para registrar el radicado</p>
                    </div>
                    <button type="button" onClick={limpiarFormulario} aria-label="Limpiar">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="input-group">
                    <label>Código de radicado</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="PQ-XXXXXXX"
                      value={regRadicado}
                      onChange={(e) => setRegRadicado(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>Fecha del caso</label>
                    <input
                      type="date"
                      className="input-field"
                      value={regFecha}
                      onChange={(e) => setRegFecha(e.target.value)}
                    />
                  </div>
                  <div className="checkbox-item" onClick={() => setRegDevuelto((v) => !v)}>
                    <input type="checkbox" checked={regDevuelto} onChange={() => setRegDevuelto((v) => !v)} />
                    <span>¿Devuelto por errores?</span>
                  </div>
                  <div className="input-group">
                    <label>Observaciones</label>
                    <textarea
                      className="input-field"
                      style={{ minHeight: 70, resize: "none" }}
                      placeholder="Escribe detalles adicionales..."
                      value={regObs}
                      onChange={(e) => setRegObs(e.target.value)}
                    />
                  </div>
                  <div className="side-panel-actions">
                    <button type="button" className="btn-cancel" onClick={limpiarFormulario}>
                      Cancelar
                    </button>
                    <button className="btn-primary" disabled={guardandoReg} onClick={submitRegistration}>
                      <Send size={16} />
                      <span>{guardandoReg ? "Guardando..." : "Registrar radicado"}</span>
                    </button>
                  </div>
                </aside>
              </div>
            </section>
          )}

          {vista === "snc" && (
            <section className="view-container snc-view">
              {sncData.hayVencidas && (
                <div className="snc-banner">
                  <ShieldAlert size={24} />
                  <div>
                    <b>Tienes salidas no conformes VENCIDAS.</b>
                    <span>El plazo es de 2 días hábiles. Gestiónalas cuanto antes.</span>
                  </div>
                </div>
              )}

              <div className="section-card snc-register">
                <div className="section-header">
                  <h3><Plus size={18} /> Registrar salida no conforme (SNC)</h3>
                </div>
                <div className="snc-register-body">
                  <div className="input-group">
                    <label>Código de radicado</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="PQ-XXXXXXX"
                      value={sncRadicado}
                      onChange={(e) => setSncRadicado(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>{sncNoAplica ? "Motivo (por qué no corresponde)" : "Motivo de la salida no conforme"}</label>
                    <textarea
                      className="input-field"
                      style={{ minHeight: 70, resize: "none" }}
                      placeholder={sncNoAplica ? "Explica por qué no corresponde..." : "Describe el motivo de la SNC..."}
                      value={sncMotivo}
                      onChange={(e) => setSncMotivo(e.target.value)}
                    />
                  </div>
                  <div className="checkbox-item" onClick={() => setSncNoAplica((v) => !v)}>
                    <input type="checkbox" checked={sncNoAplica} onChange={() => setSncNoAplica((v) => !v)} />
                    <span>No corresponde salida no conforme (no aplica el plazo de 2 días)</span>
                  </div>
                  <button className="btn-primary" disabled={guardandoSnc} onClick={registrarSnc}>
                    <Send size={16} />
                    <span>{guardandoSnc ? "Registrando..." : sncNoAplica ? "Registrar como “No corresponde”" : "Registrar SNC"}</span>
                  </button>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <h3><Clock size={18} /> Pendientes por solucionar</h3>
                  <span className="snc-count">{sncData.pendientes.length}</span>
                </div>
                {sncData.pendientes.length === 0 ? (
                  <div className="snc-empty">No tienes salidas no conformes pendientes. ¡Bien hecho!</div>
                ) : (
                  <div className="snc-list">
                    {sncData.pendientes.map((s) => (
                      <div key={s.fila} className={`snc-item sla-${s.sla}`}>
                        <div className="snc-item-main">
                          <div className="snc-item-head">
                            <b>{s.radicado}</b>
                            <span className="estado-pill progress">{s.estado}</span>
                            <span className={`snc-badge sla-${s.sla}`}>
                              {s.sla === "vencida" && <AlertTriangle size={13} />}
                              {slaLabel(s)}
                            </span>
                          </div>
                          <p className="snc-motivo">{s.motivo}</p>
                          <span className="snc-meta">Registrada: {s.fechaRegistro}</span>
                        </div>
                        <button className="btn-primary snc-solve" onClick={() => abrirCambio(s)}>
                          <RotateCcw size={16} /> Actualizar estado
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="section-card">
                <div className="section-header">
                  <h3><CheckCircle2 size={18} /> Historial de SNC</h3>
                  <span className="snc-count">{sncData.terminadas.length}</span>
                </div>
                {sncData.terminadas.length === 0 ? (
                  <div className="snc-empty">Aún no tienes SNC cerradas.</div>
                ) : (
                  <div className="hist-table-wrap">
                    <table className="hist-table">
                      <thead>
                        <tr>
                          <th>RADICADO</th>
                          <th>MOTIVO</th>
                          <th>ESTADO</th>
                          <th>NOTA</th>
                          <th>REGISTRADA</th>
                          <th>CERRADA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sncData.terminadas.map((s) => (
                          <tr key={s.fila}>
                            <td><b>{s.radicado}</b></td>
                            <td>{s.motivo}</td>
                            <td><span className={`estado-pill ${estadoClase(s.estado)}`}>{s.estado}</span></td>
                            <td>{s.detalle || "—"}</td>
                            <td>{s.fechaRegistro}</td>
                            <td>{s.fechaEstado || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {vista === "search" && (
            <section className="view-container">
              <div className="form-box" style={{ marginBottom: 32 }}>
                <div className="input-group">
                  <label>Búsqueda en Base de Datos</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="INGRESE EL RADICADO"
                      value={dbQuery}
                      onChange={(e) => setDbQuery(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleDbSearch()}
                    />
                    <button className="btn-primary" style={{ width: "auto", padding: "0 24px" }} onClick={handleDbSearch}>
                      Consultar
                    </button>
                  </div>
                </div>
              </div>

              {dbResult !== undefined && (
                <div>
                  {dbResult === null ? (
                    <div className="form-box" style={{ color: "var(--error)", textAlign: "center", fontWeight: 600 }}>
                      No existe registro en la base de datos
                    </div>
                  ) : (
                    <div className="form-box">
                      <div style={{ marginBottom: 24, textAlign: "center" }}>
                        <h3 style={{ color: "var(--primary-deep)" }}>Resultado Encontrado</h3>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            Registrado por
                          </label>
                          <div style={{ fontWeight: 600, fontSize: 16 }}>{dbResult.funcionaria}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            Fecha de Registro
                          </label>
                          <div style={{ fontWeight: 600, fontSize: 16 }}>{dbResult.fecha}</div>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Observaciones
                        </label>
                        <p style={{ fontStyle: "italic", fontSize: 14, marginTop: 4, borderLeft: "4px solid var(--primary)", paddingLeft: 16 }}>
                          &quot;{dbResult.observacion || "Sin detalles adicionales"}&quot;
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {vista === "notifications" && (
            <section className="view-container">
              <div style={{ display: "grid", gap: 16 }}>
                {notificaciones.length === 0 ? (
                  <div className="section-card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                    No tienes notificaciones pendientes
                  </div>
                ) : (
                  notificaciones.map((n) => (
                    <div
                      key={n.id}
                      className="section-card"
                      style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <b style={{ fontSize: 16, display: "block", marginBottom: 4 }}>{n.radicado}</b>
                        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{n.mensaje}</p>
                        <span style={{ fontSize: 10, marginTop: 8, display: "block", color: "var(--primary-deep)", fontWeight: 600 }}>
                          {n.fecha}
                        </span>
                      </div>
                      <button className="btn-primary" style={{ width: "auto", padding: "10px 20px", fontSize: 12 }} onClick={() => markRead(n.id)}>
                        Entendido
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {vista === "chat" && (
            <section className="view-container">
              <div className="chat-container">
                <div className="chat-messages" ref={chatBoxRef}>
                  {chat.map((m, i) => {
                    const isOwn = m.usuario === nombre;
                    return (
                      <div key={i} className={`chat-msg ${isOwn ? "own" : "other"}`}>
                        <div className="chat-info">
                          {isOwn ? "Tú" : m.usuario} • {m.fecha}
                        </div>
                        <div>{m.mensaje}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="chat-input-area">
                  <select
                    className="input-field"
                    style={{ width: 140, padding: 10 }}
                    value={chatDest}
                    onChange={(e) => setChatDest(e.target.value)}
                  >
                    <option value="TODOS">Canal Grupal</option>
                    {asesores
                      .filter((a) => a.id !== nombre)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Escribe un mensaje para el equipo..."
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleChatSend()}
                  />
                  <button className="btn-primary" style={{ width: "auto", padding: "12px 24px" }} onClick={handleChatSend}>
                    Enviar
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {wfmAlert && (
        <div className="fullscreen-overlay">
          <div className="alert-box">
            <div className="brand-logo" style={{ margin: "0 auto 20px" }}>P</div>
            <h1 style={{ fontFamily: "'Poppins'", marginBottom: 10, color: "var(--primary-deep)" }}>Alerta de Horario</h1>
            <h2 style={{ fontSize: 24, marginBottom: 40 }}>{wfmAlert.mensaje}</h2>
            <button className="btn-primary" onClick={cerrarAlertaWfm}>
              <span>Entendido / Detener Alerta</span>
            </button>
          </div>
        </div>
      )}

      {cambiando && (
        <div className="fullscreen-overlay" onClick={() => { if (!guardandoEstado) setCambiando(null); }}>
          <div className="alert-box snc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 6, color: "var(--primary-deep)" }}>Actualizar SNC</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
              Radicado <b>{cambiando.radicado}</b> · estado actual: <b>{cambiando.estado}</b>
            </p>
            <div className="input-group" style={{ textAlign: "left" }}>
              <label>Nuevo estado</label>
              <select className="input-field" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as EstadoSNC)}>
                {TRANSICIONES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ textAlign: "left" }}>
              <label>{estadoRequiereNota ? "Motivo (obligatorio)" : "Nota / detalle (opcional)"}</label>
              <textarea
                className="input-field"
                style={{ minHeight: 80, resize: "none" }}
                placeholder={estadoRequiereNota ? "Explica el motivo..." : "Detalle del avance o la corrección..."}
                value={notaEstado}
                onChange={(e) => setNotaEstado(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button className="btn-cancel" onClick={() => setCambiando(null)} disabled={guardandoEstado}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={confirmarCambio} disabled={guardandoEstado}>
                <CheckCircle2 size={16} />
                <span>{guardandoEstado ? "Guardando..." : "Guardar estado"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function slaLabel(s: SNCItem): string {
  if (s.sla === "vencida") return `Vencida · ${s.diasHabiles} días háb.`;
  if (s.sla === "vence_hoy") return "Vence hoy";
  return `Quedan ${s.diasRestantes} día${s.diasRestantes === 1 ? "" : "s"} háb.`;
}

export function estadoClase(e: EstadoSNC): string {
  if (e === "Solucionada") return "ok";
  if (e === "Cancelada") return "cancel";
  if (e === "No corresponde") return "neutral";
  if (e === "Enviada a corrección") return "progress";
  return "reg";
}

function computeWfm(shift: HorarioHoy | null, now: Date) {
  if (!shift) {
    return { status: "Cargando...", colorClass: "status-offline", jornadaTexto: "--:--", nextLabel: "--", countdown: "00:00" };
  }
  if (shift.descanso) {
    return { status: "Día de Descanso", colorClass: "status-offline", jornadaTexto: "DESCANSO", nextLabel: "Sin eventos", countdown: "--:--" };
  }

  const jornadaArr = (shift.jornada ?? "").split(" a ");
  const almuerzoArr = (shift.almuerzo ?? "").split(" a ");
  const b1Arr = shift.break1 && shift.break1.includes(" a ") ? shift.break1.split(" a ") : null;
  const b2Arr = shift.break2 && shift.break2.includes(" a ") ? shift.break2.split(" a ") : null;

  const jornada = { start: parseTimeClient(jornadaArr[0]), end: parseTimeClient(jornadaArr[1]) };
  const almuerzo = { start: parseTimeClient(almuerzoArr[0]), end: parseTimeClient(almuerzoArr[1]) };
  const b1 = b1Arr ? { start: parseTimeClient(b1Arr[0]), end: parseTimeClient(b1Arr[1]) } : null;
  const b2 = b2Arr ? { start: parseTimeClient(b2Arr[0]), end: parseTimeClient(b2Arr[1]) } : null;

  const eventos = [
    { t: jornada.start, l: "Inicio Jornada" },
    { t: jornada.end, l: "Fin Jornada" },
    { t: almuerzo.start, l: "Inicio Almuerzo" },
    { t: almuerzo.end, l: "Fin Almuerzo" },
    { t: b1?.start, l: "Inicio Break 1" },
    { t: b1?.end, l: "Fin Break 1" },
    { t: b2?.start, l: "Inicio Break 2" },
    { t: b2?.end, l: "Fin Break 2" },
  ].filter((e): e is { t: Date; l: string } => !!e.t);

  eventos.sort((a, b) => a.t.getTime() - b.t.getTime());

  let status = "Fuera de turno";
  let colorClass = "status-offline";

  if (!jornada.start || !jornada.end || now < jornada.start || now > jornada.end) {
    status = "Fuera de turno";
    colorClass = "status-offline";
  } else if (almuerzo.start && almuerzo.end && now >= almuerzo.start && now < almuerzo.end) {
    status = "En almuerzo";
    colorClass = "status-lunch";
  } else if (b1?.start && b1.end && now >= b1.start && now < b1.end) {
    status = "En break";
    colorClass = "status-break";
  } else if (b2?.start && b2.end && now >= b2.start && now < b2.end) {
    status = "En break";
    colorClass = "status-break";
  } else {
    status = "En jornada";
    colorClass = "status-online";
  }

  const upcoming = eventos.filter((e) => e.t > now);
  let nextLabel = "Sin eventos";
  let countdown = "--:--";

  if (upcoming.length > 0) {
    nextLabel = upcoming[0].l;
    const diff = upcoming[0].t.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    countdown = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return { status, colorClass, jornadaTexto: shift.jornada ?? "--:--", nextLabel, countdown };
}
