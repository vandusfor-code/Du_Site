"use client";

import "./radicaciones.css";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  obtenerAsesoresAction,
  guardarRadicacionAction,
  obtenerResumenHoyAction,
  obtenerHistorialAction,
  buscarSNCAction,
  buscarGeneralAction,
  marcarSolucionadoAction,
  obtenerNotificacionesAction,
  marcarRecibidoAction,
  obtenerChatAction,
  enviarMensajeChatAction,
  obtenerHorarioHoyAction,
  verificarHorariosAction,
} from "./actions";
import type {
  Asesor,
  ResumenHoy,
  HistorialItem,
  SncResultado,
  BusquedaGeneralResultado,
  Notificacion,
  MensajeChat,
  HorarioHoy,
} from "@/lib/radicaciones";
import { SoundToggleButton } from "@/components/module-shell";

type Vista = "dashboard" | "registry" | "snc" | "search" | "notifications" | "chat";

const NOMBRES_VISTA: Record<Vista, string> = {
  dashboard: "Panel de Control",
  registry: "Nueva Radicación",
  snc: "Gestión de Calidad (SNC)",
  search: "Búsqueda Global",
  notifications: "Centro de Notificaciones",
  chat: "Comunicación Interna",
};

const ALERT_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

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
  const [vista, setVista] = useState<Vista>("dashboard");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [resumen, setResumen] = useState<ResumenHoy>({ efectivos: 0, devueltos: 0, total: 0 });
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  const [regRadicado, setRegRadicado] = useState("");
  const [regFecha, setRegFecha] = useState("");
  const [regDevuelto, setRegDevuelto] = useState(false);
  const [regSnc, setRegSnc] = useState(false);
  const [regObs, setRegObs] = useState("");
  const [guardandoReg, setGuardandoReg] = useState(false);

  const [sncQuery, setSncQuery] = useState("");
  const [sncResult, setSncResult] = useState<SncResultado | null | undefined>(undefined);

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
    obtenerHorarioHoyAction().then(setShift);
    refreshChat();
    refreshNotifs();

    const pollChat = setInterval(refreshChat, 4000);
    const pollNotif = setInterval(refreshNotifs, 10000);
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
    if (v === "dashboard") refreshDashboard();
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

  async function submitRegistration() {
    if (!regRadicado.trim()) return mostrarToast("El radicado es obligatorio", true);
    if (regSnc && !regFecha) return mostrarToast("Se requiere fecha para reporte SNC", true);

    setGuardandoReg(true);
    const res = await guardarRadicacionAction({
      radicado: regRadicado,
      fecha: regFecha,
      devuelto: regDevuelto,
      sncProceso: regSnc,
      observacion: regObs,
    });
    setGuardandoReg(false);

    if (res.success) {
      mostrarToast("Radicado registrado con éxito");
      setRegRadicado("");
      setRegFecha("");
      setRegDevuelto(false);
      setRegSnc(false);
      setRegObs("");
      refreshDashboard();
    } else {
      mostrarToast(res.error ?? "Error al guardar", true);
    }
  }

  async function handleSncSearch() {
    if (!sncQuery.trim()) return;
    const res = await buscarSNCAction(sncQuery);
    setSncResult(res);
  }

  async function closeSnc(row: number) {
    await marcarSolucionadoAction(row);
    mostrarToast("SNC Cerrado correctamente");
    handleSncSearch();
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
          {vista === "dashboard" && (
            <section className="view-container">
              <div className="stats-grid">
                <div className="stat-card wfm-card">
                  <span className="label">Turno del Día</span>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                    <span className={`status-dot ${wfm.colorClass}`} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{wfm.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 15 }}>
                    Jornada: <b style={{ color: "var(--text-main)" }}>{wfm.jornadaTexto}</b>
                  </div>
                  <span className="label" style={{ fontSize: 10 }}>
                    Próximo: {wfm.nextLabel}
                  </span>
                  <div className="countdown-timer">{wfm.countdown}</div>
                </div>

                <div className="stat-card">
                  <span className="label">Exitosos</span>
                  <div className="value" style={{ color: "var(--secondary)" }}>{resumen.efectivos}</div>
                  <div className="sub-text" style={{ color: "var(--secondary)" }}>Gestiones de hoy</div>
                </div>
                <div className="stat-card">
                  <span className="label">Devueltos</span>
                  <div className="value" style={{ color: "var(--error)" }}>{resumen.devueltos}</div>
                  <div className="sub-text" style={{ color: "var(--error)" }}>Errores hoy</div>
                </div>
                <div className="stat-card">
                  <span className="label">Eficiencia</span>
                  <div className="value">
                    {resumen.total > 0 ? Math.round((resumen.efectivos / resumen.total) * 100) : 0}%
                  </div>
                  <div className="sub-text" style={{ color: "var(--primary)" }}>Rendimiento global</div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <h3>Historial Reciente</h3>
                </div>
                <div>
                  {historial.length === 0 ? (
                    <p style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                      No hay registros recientes
                    </p>
                  ) : (
                    historial.map((item, i) => {
                      const isDev = ["si", "sí"].includes(item.devuelto.toLowerCase());
                      return (
                        <div key={i} className="history-row">
                          <div className="row-main">
                            <b>{item.radicado}</b>
                            <span>{item.fecha}</span>
                          </div>
                          <span className={`status-pill ${isDev ? "error" : "success"}`}>
                            {isDev ? "Devuelto" : "Exitoso"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          )}

          {vista === "registry" && (
            <section className="view-container">
              <div className="form-box">
                <div className="form-title">
                  <h2>Nueva Radicación</h2>
                  <p>Completa los datos del radicado procesado</p>
                </div>
                <div className="input-group">
                  <label>Código de Radicado</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="PQ-XXXXXXX"
                    value={regRadicado}
                    onChange={(e) => setRegRadicado(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Fecha del Caso</label>
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
                <div className="checkbox-item" onClick={() => setRegSnc((v) => !v)}>
                  <input type="checkbox" checked={regSnc} onChange={() => setRegSnc((v) => !v)} />
                  <span>Requiere seguimiento de calidad (SNC)</span>
                </div>
                <div className="input-group">
                  <label>Observaciones</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: 120, resize: "none" }}
                    placeholder="Escribe detalles adicionales..."
                    value={regObs}
                    onChange={(e) => setRegObs(e.target.value)}
                  />
                </div>
                <button className="btn-primary" disabled={guardandoReg} onClick={submitRegistration}>
                  <span>{guardandoReg ? "Guardando..." : "Registrar Radicado"}</span>
                </button>
              </div>
            </section>
          )}

          {vista === "snc" && (
            <section className="view-container">
              <div className="form-box" style={{ marginBottom: 32 }}>
                <div className="input-group">
                  <label>Buscar Radicado SNC</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="CÓDIGO RADICADO"
                      value={sncQuery}
                      onChange={(e) => setSncQuery(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSncSearch()}
                    />
                    <button className="btn-primary" style={{ width: "auto", padding: "0 24px" }} onClick={handleSncSearch}>
                      Buscar
                    </button>
                  </div>
                </div>
              </div>

              {sncResult !== undefined && (
                <div>
                  {sncResult === null ? (
                    <div className="form-box" style={{ color: "var(--error)", textAlign: "center", fontWeight: 600 }}>
                      Radicado no encontrado en sistema
                    </div>
                  ) : (
                    <div className="form-box">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                        <h3>Radicado: {sncResult.radicado}</h3>
                        <span className="status-pill" style={{ background: "var(--primary)", color: "var(--primary-text)" }}>
                          {sncResult.estado}
                        </span>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Asesor Responsable
                        </label>
                        <div style={{ fontWeight: 600 }}>{sncResult.funcionaria}</div>
                      </div>
                      <div style={{ marginBottom: 32 }}>
                        <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Observación Original
                        </label>
                        <p style={{ fontStyle: "italic", fontSize: 14, marginTop: 4 }}>
                          &quot;{sncResult.observacion || "Sin detalles"}&quot;
                        </p>
                      </div>
                      {sncResult.canClose && (
                        <button className="btn-primary" onClick={() => closeSnc(sncResult.row)}>
                          Marcar como Solucionado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                        <h3 style={{ color: "var(--primary)" }}>Resultado Encontrado</h3>
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
                        <span style={{ fontSize: 10, marginTop: 8, display: "block", color: "var(--primary)", fontWeight: 600 }}>
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
            <h1 style={{ fontFamily: "'Poppins'", marginBottom: 10, color: "var(--primary)" }}>Alerta de Horario</h1>
            <h2 style={{ fontSize: 24, marginBottom: 40 }}>{wfmAlert.mensaje}</h2>
            <button className="btn-primary" onClick={cerrarAlertaWfm}>
              <span>Entendido / Detener Alerta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
