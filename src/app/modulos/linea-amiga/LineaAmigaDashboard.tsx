"use client";

import "./linea-amiga.css";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bell,
  BellRing,
  Brain,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  History,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Power,
  Reply,
  Search,
  Send,
  User,
  X,
} from "lucide-react";
import {
  guardarPQRSFAction,
  buscarPQRSFAction,
  getAgentesAction,
  getHistorialAction,
  getMensajesAction,
  enviarMensajeAction,
  getNotificacionesAction,
  marcarNotificacionRecibidaAction,
  buscarSimilitudPQRSFAction,
  obtenerHorarioHoyAction,
  verificarHorariosAction,
  obtenerResumenGestionAction,
} from "./actions";
import type {
  ResultadoHistorial,
  MensajeChat,
  Notificacion,
  SugerenciaPQRSF,
  HorarioHoy,
  PQRSFEncontrado,
  ResumenGestion,
} from "@/lib/lineaAmiga";
import { SoundToggleButton } from "@/components/module-shell";

const CLASIFICACIONES = [
  "(Felicitaciones) - FELICITACIONES",
  "(Solicitudes, sugerencias y peticiones) - PETICIÓN O SOLICITUD",
  "(Quejas, reclamos, denuncias) - QUEJA",
  "(Quejas, reclamos, denuncias) - RECLAMO",
  "(Quejas, reclamos, denuncias) - RECLAMO CUOTA MONETARIA Y/O REACTIVACIÓN",
  "(Quejas, reclamos, denuncias) - RECLAMO PROTECCIÓN DE DATOS",
  "(Quejas, reclamos, denuncias) - SOLICITUD DE RESARCIMIENTO",
  "(Solicitudes, sugerencias y peticiones) - SUGERENCIA",
];

const AREAS = [
  "COLEGIO SAN MARTIN", "COLEGIO VILLAVICENCIO", "CONSEJO DIRECTIVO", "CONTABILIDAD GENERAL",
  "COORDINACION DE AFILIACIONES", "COORDINACION DE GESTION DOCUMENTAL", "COORDINACIÓN COMERCIAL",
  "COORDINACIÓN DE MERCADEO", "DIRECCION ADMINISTRATIVA", "DIVISION COMERCIAL Y DE MERCADEO",
  "DIVISION DE APORTES", "DIVISION DE CAPACITACIÓN EMPRESARIAL", "DIVISION DE RECREACION, DEPORTE Y TURISMO",
  "DIVISION DE SUBSIDIOS", "DIVISION DE TECNOLOGIAS DE LA INFORMACIÓN", "DIVISION DE TESORERIA",
  "DIVISIÓN DE ATENCIÓN A LA NIÑEZ", "DIVISIÓN DE GESTIÓN DE EMPLEO", "AREA DE PUBLICIDAD",
  "AREA DE CARTERA", "AREA DE CREDITO COFREM", "AREA DE CULTURA Y EVENTOS", "AREA DE MANTENIMIENTO",
  "AREA INFRAESTRUCTURA", "ASESORIA JURIDICA", "AUDITORIA INTERNA", "BIBLIOTECA",
  "CENTRO DE SERVICIOS PUERTO GAITAN", "CENTRO VACACIONAL CANEY", "CENTRO VACACIONAL YURIMENA",
  "CER", "COLEGIO ACACÍAS", "COLEGIO GUAMAL", "COLEGIO PUERTO LOPEZ", "COLEGIO RESTREPO",
  "DIVISIÓN DE GESTIÓN DE SIST. CORPORATIVO", "DIVISIÓN DE GESTIÓN HUMANA", "DIVISIÓN DE LOGISTICA",
  "EDUCACION SUPERIOR", "FEDECAJAS", "INSTITUTO TECNICO COFREM", "MESA DE SERVICIOS", "NO DEFINIDA",
  "OFICINA MOVIL RUBIALES", "PARQUE DE LA VIDA VILLAVICENCIO", "PARQUE VACACIONAL ARIARI",
  "PLANEACIÓN CORPORATIVA", "PUNTO DE INFORMACIÓN", "SERVICIO AL CLIENTE",
  "SUBDIRECCION ADMINISTRATIVA Y FINANCIERA", "SUBDIRECCION DE PROGRAMAS SOCIALES",
  "SUBDIRECCION DE SERVICIOS SOCIALES", "SUBDIRECCIÓN EDUCACIÓN", "TURISMO SOCIAL",
  "ZONA CENTRO", "ZONA NORTE", "ZONA ORIENTE", "ZONA SUR", "ÁREA DE VIVIENDA",
];

const SND_NOTIF = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
const SND_MSG = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
const SND_ALERT = "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3";

type Panel = "chat" | "notif" | "search" | "sugerencias" | null;

function parseHoraLocal(h: string | undefined): Date | null {
  if (!h || h === "-" || h.toUpperCase() === "DESCANSO") return null;
  const m = h.toLowerCase().match(/(\d+):(\d+)(am|pm)/);
  if (!m) return null;
  let hrs = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === "pm" && hrs < 12) hrs += 12;
  if (m[3] === "am" && hrs === 12) hrs = 0;
  const d = new Date();
  d.setHours(hrs, min, 0, 0);
  return d;
}

function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const f = value.toLowerCase();
    if (!f) return options;
    return options.filter((o) => o.toLowerCase().includes(f));
  }, [value, options]);

  return (
    <div className="input-wrapper" ref={ref}>
      <input
        className="custom-input"
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="search-results" style={{ display: "block" }}>
          {filtered.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniLineChart({ puntos }: { puntos: number[] }) {
  const gradientId = useId();
  const w = 100;
  const h = 46;
  const max = Math.max(...puntos);
  const min = Math.min(...puntos);
  const rango = max - min || 1;
  const stepX = w / (puntos.length - 1);
  const coords = puntos.map((p, i) => [i * stepX, h - ((p - min) / rango) * h] as const);
  const linea = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${linea} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-lime-strong)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--brand-lime-strong)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={linea} fill="none" stroke="var(--brand-lime-strong)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="var(--brand-lime-strong)" />
      ))}
    </svg>
  );
}

function MiniBarChart({ valores }: { valores: number[] }) {
  const max = Math.max(...valores);
  return (
    <div className="resumen-bars" aria-hidden="true">
      {valores.map((v, i) => (
        <i key={i} style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

function ResumenCard({
  Icon,
  tipo,
  valor,
  chart,
}: {
  Icon: typeof FileText;
  tipo: string;
  valor: number;
  chart: { tipo: "linea"; datos: number[] } | { tipo: "barras"; datos: number[] };
}) {
  return (
    <div className="resumen-card">
      <div className="resumen-top">
        <div>
          <div className="resumen-icon">
            <Icon size={20} />
          </div>
          <div className="resumen-label">
            PQRSF
            <br />
            {tipo}
          </div>
          <div className="resumen-valor">{valor}</div>
        </div>
        <div className="resumen-chart">
          {chart.tipo === "linea" ? <MiniLineChart puntos={chart.datos} /> : <MiniBarChart valores={chart.datos} />}
        </div>
      </div>
      <button type="button" className="resumen-link">
        Ver detalles <ExternalLink size={11} />
      </button>
    </div>
  );
}

export default function LineaAmigaDashboard({
  nombre,
  sugerenciasUrl,
}: {
  nombre: string;
  sugerenciasUrl: string | null;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const [radicado, setRadicado] = useState("");
  const [caso, setCaso] = useState("");
  const [clasificacion, setClasificacion] = useState("");
  const [dirige, setDirige] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [historial, setHistorial] = useState<ResultadoHistorial>({ historial: [], hoy: 0 });
  const [resumenGestion, setResumenGestion] = useState<ResumenGestion>({ devueltos: 0, campana: 0, respondidos: 0, porResponder: 0 });

  const [chat, setChat] = useState<MensajeChat[]>([]);
  const [chatMsg, setChatMsg] = useState("");
  const [chatBadge, setChatBadge] = useState(0);
  const lastMsgCount = useRef(0);
  const panelRef = useRef<Panel>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notifBadge, setNotifBadge] = useState(0);
  const lastNotifCount = useRef(0);

  const [sugerenciaTexto, setSugerenciaTexto] = useState("");
  const [sugerenciaResultados, setSugerenciaResultados] = useState<SugerenciaPQRSF[] | null>(null);
  const [buscandoSugerencias, setBuscandoSugerencias] = useState(false);

  const [searchRadicado, setSearchRadicado] = useState("");
  const [searchResult, setSearchResult] = useState<PQRSFEncontrado | null | undefined>(undefined);
  const [buscandoRadicado, setBuscandoRadicado] = useState(false);

  const [schedule, setSchedule] = useState<HorarioHoy | null | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());

  const [alertaActiva, setAlertaActiva] = useState<Notificacion | null>(null);
  const alertaIdRef = useRef<number | null>(null);

  const audioNotifRef = useRef<HTMLAudioElement>(null);
  const audioMsgRef = useRef<HTMLAudioElement>(null);
  const audioAlertRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  const playSound = useCallback((ref: React.RefObject<HTMLAudioElement | null>) => {
    if (!soundOn) return;
    if (ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    }
  }, [soundOn]);

  const mostrarToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const cargarHistorial = useCallback(() => {
    getHistorialAction().then(setHistorial);
  }, []);

  const cargarChat = useCallback(async () => {
    const data = await getMensajesAction();
    const isNew = data.length > lastMsgCount.current;
    if (isNew) {
      const nuevos = data.slice(lastMsgCount.current);
      const deOtro = nuevos.some((m) => m.usuario !== nombre);
      if (deOtro) {
        playSound(audioMsgRef);
        if (panelRef.current !== "chat") {
          setChatBadge((b) => b + nuevos.filter((m) => m.usuario !== nombre).length);
        }
      }
    }
    lastMsgCount.current = data.length;
    setChat(data);
  }, [nombre, playSound]);

  const cargarNotificaciones = useCallback(async () => {
    const data = await getNotificacionesAction();

    const alertaHorario = data.find((n) => n.radicado === "HORARIO");
    if (alertaHorario && alertaIdRef.current !== alertaHorario.id) {
      alertaIdRef.current = alertaHorario.id;
      setAlertaActiva(alertaHorario);
    }

    if (data.length > lastNotifCount.current) playSound(audioNotifRef);
    lastNotifCount.current = data.length;
    setNotifBadge(data.length);
    setNotificaciones(data);
  }, [playSound]);

  useEffect(() => {
    getAgentesAction();
    cargarHistorial();
    cargarChat();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial única al montar, no deriva de props/estado
    cargarNotificaciones();
    obtenerHorarioHoyAction().then(setSchedule);
    obtenerResumenGestionAction().then(setResumenGestion);

    const pollChat = setInterval(cargarChat, 5000);
    const pollNotif = setInterval(cargarNotificaciones, 10000);
    const pollSched = setInterval(() => {
      verificarHorariosAction();
      obtenerHorarioHoyAction().then(setSchedule);
    }, 60000);
    const tick = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearInterval(pollChat);
      clearInterval(pollNotif);
      clearInterval(pollSched);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chat]);

  useEffect(() => {
    if (alertaActiva) {
      playSound(audioAlertRef);
      if (audioAlertRef.current) audioAlertRef.current.loop = true;
    } else if (audioAlertRef.current) {
      audioAlertRef.current.pause();
      audioAlertRef.current.currentTime = 0;
    }
  }, [alertaActiva, playSound]);

  function abrirPanel(p: Exclude<Panel, null>) {
    setPanel(p);
    if (p === "chat") setChatBadge(0);
  }

  function cerrarPanel() {
    setPanel(null);
  }

  async function confirmarAlerta() {
    if (audioAlertRef.current) {
      audioAlertRef.current.pause();
      audioAlertRef.current.currentTime = 0;
    }
    const id = alertaActiva?.id;
    setAlertaActiva(null);
    if (id) {
      await marcarNotificacionRecibidaAction(id);
      cargarNotificaciones();
    }
  }

  async function marcarLeida(id: number) {
    await marcarNotificacionRecibidaAction(id);
    cargarNotificaciones();
  }

  async function enviarMsg() {
    const texto = chatMsg.trim();
    if (!texto) return;
    setChatMsg("");
    await enviarMensajeAction(texto, "TODOS");
    cargarChat();
  }

  async function registrar() {
    if (!radicado || !caso || !clasificacion || !dirige) {
      mostrarToast("Error: Campos Incompletos", true);
      return;
    }
    setGuardando(true);
    const res = await guardarPQRSFAction({ radicado, caso, clasificacion, dirige });
    setGuardando(false);

    if (res.estado === "ok") {
      mostrarToast("Radicación Exitosa");
      setRadicado("");
      setCaso("");
      setClasificacion("");
      setDirige("");
      cargarHistorial();
    } else if (res.estado === "duplicado") {
      mostrarToast("Duplicado: " + (res.agente || "Otro Agente"), true);
    } else {
      mostrarToast("Error de Conexión Crítico", true);
    }
  }

  async function buscarSugerencias() {
    const texto = sugerenciaTexto.trim();
    if (!texto) return mostrarToast("Describe el caso para buscar", true);
    setBuscandoSugerencias(true);
    const res = await buscarSimilitudPQRSFAction(texto);
    setBuscandoSugerencias(false);
    setSugerenciaResultados(res);
  }

  async function buscarRadicado() {
    const rad = searchRadicado.trim();
    if (!rad) return mostrarToast("Ingrese un radicado", true);
    setBuscandoRadicado(true);
    const res = await buscarPQRSFAction(rad);
    setBuscandoRadicado(false);
    setSearchResult(res);
  }

  function copiarRadicado(rad: string) {
    navigator.clipboard.writeText(rad).then(() => mostrarToast("Radicado copiado"));
  }

  const wfm = computeWfm(schedule, now);

  return (
    <div className="linea-scope">
      <div className="bg-blobs">
        <div className="blob blob-1" />
      </div>

      <audio ref={audioNotifRef} src={SND_NOTIF} preload="auto" />
      <audio ref={audioMsgRef} src={SND_MSG} preload="auto" />
      <audio ref={audioAlertRef} src={SND_ALERT} preload="auto" />

      <div className={`toast ${toast ? "active" : ""} ${toast?.error ? "error" : ""}`}>
        {toast && (
          <>
            {toast.error ? <AlertOctagon size={18} /> : <CheckCircle size={18} />}
            <span>{toast.msg}</span>
          </>
        )}
      </div>

      <div id="main-app">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand-logo">
              <div className="brand-dot" />
              <span>
                PEOPLE <span style={{ color: "var(--brand-lime)" }}>BPO</span>
              </span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>
              Línea Amiga
            </div>
          </div>

          <nav className="nav-group">
            <button className="nav-btn active">
              <Activity size={18} />
              <span>Registro PQRSF</span>
            </button>
            <button className="nav-btn" onClick={() => abrirPanel("chat")}>
              <MessageSquare size={18} />
              <span>Chat Global</span>
              {chatBadge > 0 && (
                <span className="badge" style={{ display: "flex", marginLeft: "auto" }}>
                  {chatBadge}
                </span>
              )}
            </button>
            <button className="nav-btn" onClick={() => abrirPanel("notif")}>
              <BellRing size={18} />
              <span>Notificaciones</span>
              {notifBadge > 0 && (
                <span className="badge" style={{ display: "flex", marginLeft: "auto" }}>
                  {notifBadge}
                </span>
              )}
            </button>
            <button className="nav-btn" onClick={() => abrirPanel("search")}>
              <Search size={18} />
              <span>Búsqueda</span>
            </button>
            <button className="nav-btn" onClick={() => abrirPanel("sugerencias")}>
              <Brain size={18} />
              <span>Sugerencias</span>
            </button>
          </nav>

          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-md)", padding: 24, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand-lime)", textTransform: "uppercase", marginBottom: 8 }}>
              Network Status
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 10px #10b981" }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Secure Node Online</span>
              </div>
              <SoundToggleButton soundOn={soundOn} toggleSound={() => setSoundOn((v) => !v)} />
            </div>
          </div>

          <Link href="/" className="nav-btn" style={{ color: "#ef4444", textDecoration: "none" }}>
            <Power size={18} />
            <span>Volver al inicio</span>
          </Link>

          <div style={{ marginTop: "auto", paddingTop: 24, fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            By Duvan Ramos
          </div>
        </aside>

        <div className="viewport">
          <header className="top-bar">
            <div className="welcome-text">
              <h2>Comenzar Registro</h2>
              <p>
                Gestionando como: <span style={{ color: "var(--brand-purple)", fontWeight: 800 }}>{nombre}</span>
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "var(--brand-purple)" }}>{nombre}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  {now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
              <div style={{ width: 56, height: 56, background: "white", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 22, color: "var(--brand-purple)", boxShadow: "var(--shadow-md)", border: "2px solid var(--brand-lime)" }}>
                {nombre.charAt(0)}
              </div>
            </div>
          </header>

          <div className="dashboard-layout">
            <div className="feature-card">
              <div className="section-title">
                <Activity size={20} style={{ color: "var(--brand-purple)" }} />
                <span>Formulario de Radicación de PQRSF</span>
              </div>

              <div className="form-row">
                <div className="input-wrapper">
                  <label className="input-label">Número de Radicado</label>
                  <input
                    className="custom-input"
                    type="text"
                    placeholder="Ej: PQ-2024-001"
                    value={radicado}
                    onChange={(e) => setRadicado(e.target.value)}
                  />
                </div>
                <div className="input-wrapper">
                  <label className="input-label">Detalla el caso</label>
                  <input
                    className="custom-input"
                    type="text"
                    placeholder="Escribe el detalle del caso"
                    value={caso}
                    onChange={(e) => setCaso(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label className="input-label">Clasificación de PQRSF</label>
                  <Autocomplete value={clasificacion} onChange={setClasificacion} options={CLASIFICACIONES} placeholder="Escribe para buscar..." />
                </div>
                <div>
                  <label className="input-label">Área Destino</label>
                  <Autocomplete value={dirige} onChange={setDirige} options={AREAS} placeholder="Seleccionar destino..." />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="primary-btn" style={{ height: 72 }} disabled={guardando} onClick={registrar}>
                  <span style={{ opacity: guardando ? 0.5 : 1 }}>
                    {guardando ? "Registrando..." : "Validar y Registrar PQRSF"}
                  </span>
                  {guardando && <div className="spinner" style={{ display: "block" }} />}
                </button>
              </div>

              <div className="resumen-gestion">
                <div className="resumen-titulo">Resumen de gestión</div>
                <div className="resumen-grid">
                  <ResumenCard Icon={FileText} tipo="Devueltos" valor={resumenGestion.devueltos} chart={{ tipo: "linea", datos: [20, 32, 28, 42, 36, 58] }} />
                  <ResumenCard Icon={Megaphone} tipo="Campaña" valor={resumenGestion.campana} chart={{ tipo: "barras", datos: [30, 22, 18, 25, 34, 28, 60] }} />
                  <ResumenCard Icon={Reply} tipo="Respondidos" valor={resumenGestion.respondidos} chart={{ tipo: "linea", datos: [15, 38, 26, 48, 34, 62] }} />
                  <ResumenCard Icon={Clock} tipo="por responder" valor={resumenGestion.porResponder} chart={{ tipo: "barras", datos: [15, 20, 24, 28, 34, 42, 52] }} />
                </div>
              </div>
            </div>

            <aside>
              <div className="widget" style={{ background: "white", borderLeft: "6px solid var(--brand-lime)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div className="status-indicator" style={{ color: wfm.color, background: wfm.color }} />
                  <span style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: wfm.color }}>
                    {wfm.status}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Jornada Hoy</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{wfm.jornada}</div>
                  </div>
                  <div style={{ background: "var(--brand-purple)", color: "white", padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.6, textTransform: "uppercase" }}>Próximo Evento</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{wfm.next}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                    Inicia en
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--brand-purple)" }}>{wfm.countdown}</div>
                </div>
              </div>

              <div className="widget" style={{ background: "var(--brand-purple)", color: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.6, textTransform: "uppercase" }}>Productividad Hoy</div>
                    <div style={{ fontSize: 40, fontWeight: 900, margin: "4px 0" }}>{historial.hoy}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-lime)" }}>Registros Completados</div>
                  </div>
                  <div className="mini-bars" aria-hidden="true">
                    <i style={{ height: "35%" }} />
                    <i style={{ height: "55%" }} />
                    <i style={{ height: "75%" }} />
                    <i style={{ height: "100%" }} />
                  </div>
                </div>
              </div>

              <div className="widget">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Últimos Movimientos</div>
                  <History size={16} style={{ color: "var(--text-muted)" }} />
                </div>
                <div>
                  {historial.historial.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 24 }}>
                      Sin actividad reciente
                    </div>
                  ) : (
                    historial.historial.map((h, i) => (
                      <div key={i} className="history-item">
                        <div>
                          <div className="h-id">{h.radicado}</div>
                          <div className="h-date">{h.fecha}</div>
                        </div>
                        <div className="h-tag">SUCCESS</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* PANEL: SUGERENCIAS */}
      <div className="overlay" style={{ display: panel === "sugerencias" ? "flex" : "none" }}>
        <div className="overlay-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Brain size={20} />
            <span style={{ fontWeight: 800 }}>SUGERENCIAS INTELIGENTES</span>
          </div>
          <X size={20} style={{ cursor: "pointer" }} onClick={cerrarPanel} />
        </div>
        <div className="overlay-body">
          <p style={{ fontSize: 11, color: "var(--brand-purple)", fontWeight: 700, background: "rgba(204, 255, 0, 0.2)", padding: 12, borderRadius: 10, marginBottom: 24, lineHeight: 1.4 }}>
            👉 Estos son los radicados con mayor similitud a tu búsqueda. Valida cuál se ajusta mejor a tu caso y copia el radicado.
          </p>

          <div style={{ background: "white", padding: 24, borderRadius: 18, border: "1px solid var(--border-color)", marginBottom: 24 }}>
            <label className="input-label">Describe el caso</label>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                className="custom-input"
                type="text"
                placeholder="Ej: problemas huella..."
                value={sugerenciaTexto}
                onChange={(e) => setSugerenciaTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarSugerencias()}
              />
              <button className="primary-btn" style={{ width: 64, padding: 0 }} onClick={buscarSugerencias}>
                <Search size={18} />
              </button>
            </div>
          </div>

          {buscandoSugerencias ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="spinner" style={{ display: "block", margin: "0 auto", borderTopColor: "var(--brand-purple)" }} />
            </div>
          ) : sugerenciaResultados === null ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 40 }}>
              Describe el problema para encontrar casos similares.
            </div>
          ) : sugerenciaResultados.length > 0 ? (
            sugerenciaResultados.map((r, i) => (
              <div key={i} style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid var(--border-color)", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: "var(--brand-purple)", fontSize: 16 }}>🔢 {r.radicado}</div>
                  <div style={{ background: "var(--brand-lime)", color: "var(--brand-purple)", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                    {r.canal}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                  <User size={14} />
                  <span>🧑 {r.radicador}</span>
                </div>
                <button
                  className="primary-btn"
                  style={{ marginTop: 16, padding: 8, fontSize: 12, height: "auto", background: "#f1f5f9", color: "var(--brand-purple)" }}
                  onClick={() => copiarRadicado(r.radicado)}
                >
                  Copiar Radicado
                </button>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 700, padding: 40 }}>
              No se encontraron casos similares.
            </div>
          )}

          {sugerenciasUrl && (
            <div style={{ marginTop: 24 }}>
              <button
                className="primary-btn"
                style={{ background: "#f8fafc", color: "var(--brand-purple)", border: "1px solid var(--border-color)" }}
                onClick={() => window.open(sugerenciasUrl, "_blank")}
              >
                <ExternalLink size={18} />
                <span>Abrir base completa</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PANEL: CHAT */}
      <div className="overlay" style={{ display: panel === "chat" ? "flex" : "none" }}>
        <div className="overlay-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MessageCircle size={20} />
            <span style={{ fontWeight: 800 }}>COMUNICACIÓN GLOBAL</span>
          </div>
          <X size={20} style={{ cursor: "pointer" }} onClick={cerrarPanel} />
        </div>
        <div className="overlay-body" style={{ display: "flex", flexDirection: "column" }} ref={chatBoxRef}>
          {chat.map((m, i) => (
            <div key={i} className={`msg ${m.usuario === nombre ? "mine" : "other"}`}>
              <span className="msg-user">{m.usuario === nombre ? "Tú" : m.usuario.split(" ")[0]}</span>
              {m.mensaje}
            </div>
          ))}
        </div>
        <div style={{ padding: 24, background: "white", borderTop: "1px solid var(--border-color)", display: "flex", gap: 12 }}>
          <input
            className="custom-input"
            type="text"
            placeholder="Escribir mensaje..."
            value={chatMsg}
            onChange={(e) => setChatMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviarMsg()}
          />
          <button className="primary-btn" style={{ width: 64, padding: 0 }} onClick={enviarMsg}>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* PANEL: NOTIFICACIONES */}
      <div className="overlay" style={{ display: panel === "notif" ? "flex" : "none" }}>
        <div className="overlay-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Bell size={20} />
            <span style={{ fontWeight: 800 }}>PENDIENTES</span>
          </div>
          <X size={20} style={{ cursor: "pointer" }} onClick={cerrarPanel} />
        </div>
        <div className="overlay-body">
          {notificaciones.filter((n) => n.radicado !== "HORARIO").length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No hay alertas pendientes.
            </div>
          ) : (
            notificaciones
              .filter((n) => n.radicado !== "HORARIO")
              .map((n) => (
                <div key={n.id} style={{ background: "white", padding: 20, borderRadius: 18, marginBottom: 12, border: "1px solid var(--border-color)" }}>
                  <div style={{ fontWeight: 800, color: "var(--brand-purple)", fontSize: 15 }}>{n.radicado}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>{n.mensaje}</div>
                  <button className="primary-btn" style={{ padding: 10, fontSize: 12, height: "auto" }} onClick={() => marcarLeida(n.id)}>
                    Confirmar Recepción
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {/* PANEL: BÚSQUEDA */}
      <div className="overlay" style={{ display: panel === "search" ? "flex" : "none" }}>
        <div className="overlay-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Search size={20} />
            <span style={{ fontWeight: 800 }}>CONSULTA DE RADICADOS</span>
          </div>
          <X size={20} style={{ cursor: "pointer" }} onClick={cerrarPanel} />
        </div>
        <div className="overlay-body">
          <div style={{ background: "white", padding: 24, borderRadius: 18, border: "1px solid var(--border-color)", marginBottom: 24 }}>
            <label className="input-label">Buscar por Radicado</label>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                className="custom-input"
                type="text"
                placeholder="Ingrese el radicado..."
                value={searchRadicado}
                onChange={(e) => setSearchRadicado(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarRadicado()}
              />
              <button className="primary-btn" style={{ width: 64, padding: 0 }} onClick={buscarRadicado}>
                <Search size={18} />
              </button>
            </div>
          </div>

          {buscandoRadicado ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="spinner" style={{ display: "block", margin: "0 auto", borderTopColor: "var(--brand-purple)" }} />
            </div>
          ) : searchResult === undefined ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 40 }}>
              Ingrese un número de radicado para iniciar la búsqueda.
            </div>
          ) : searchResult === null ? (
            <div style={{ textAlign: "center", color: "var(--error)", fontWeight: 700, padding: 40 }}>
              No se encontró ningún registro con ese radicado.
            </div>
          ) : (
            <div style={{ background: "white", padding: 32, borderRadius: 18, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand-lime)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                Detalles del Registro
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="input-label" style={{ marginBottom: 4 }}>Número de Radicado (PQRSF)</label>
                <div style={{ fontWeight: 800, fontSize: 18, color: "var(--brand-purple)" }}>{searchResult.radicado}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label className="input-label" style={{ marginBottom: 4 }}>Fecha de Registro</label>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{searchResult.fecha}</div>
                </div>
                <div>
                  <label className="input-label" style={{ marginBottom: 4 }}>Agente</label>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{searchResult.agente}</div>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="input-label" style={{ marginBottom: 4 }}>Clasificación</label>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{searchResult.clasificacion}</div>
              </div>
              <div>
                <label className="input-label" style={{ marginBottom: 4 }}>Se dirige a</label>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--brand-purple)" }}>{searchResult.dirige}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {alertaActiva && (
        <div className="alert-fullscreen" style={{ display: "flex" }}>
          <div className="alert-icon-box">
            <Clock size={60} />
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 900, marginBottom: 16 }}>¡ALERTA DE HORARIO!</h1>
          <p style={{ fontSize: 24, fontWeight: 500, opacity: 0.9, marginBottom: 48 }}>{alertaActiva.mensaje}</p>
          <button
            className="primary-btn"
            style={{ background: "var(--brand-lime)", color: "var(--brand-purple)", maxWidth: 300, height: 80, fontSize: 20 }}
            onClick={confirmarAlerta}
          >
            <span>Entendido, Recibido</span>
          </button>
        </div>
      )}
    </div>
  );
}

function computeWfm(shift: HorarioHoy | null | undefined, now: Date) {
  if (shift === undefined) {
    return { status: "Sincronizando...", color: "#64748b", jornada: "--:--", next: "--:--", countdown: "00:00" };
  }
  if (!shift) {
    return { status: "Horario no asignado", color: "#64748b", jornada: "--:--", next: "---", countdown: "00:00" };
  }

  const jornadaParts = (shift.jornada || "").split(" a ");
  const inicioJ = parseHoraLocal(jornadaParts[0]);
  const finJ = parseHoraLocal(jornadaParts[1]);

  const b1Parts = (shift.break1 || "").split(" a ");
  const b2Parts = (shift.break2 || "").split(" a ");
  const almParts = (shift.almuerzo || "").split(" a ");

  const eventos = [
    { name: "Break 1", start: parseHoraLocal(b1Parts[0]), end: parseHoraLocal(b1Parts[1]), status: "🟡 En break 1", color: "#eab308" },
    { name: "Almuerzo", start: parseHoraLocal(almParts[0]), end: parseHoraLocal(almParts[1]), status: "🟠 En almuerzo", color: "#f97316" },
    { name: "Break 2", start: parseHoraLocal(b2Parts[0]), end: parseHoraLocal(b2Parts[1]), status: "🟡 En break 2", color: "#eab308" },
    { name: "Fin Jornada", start: finJ, end: null as Date | null, status: "🔴 Fuera de turno", color: "#ef4444" },
  ].filter((e): e is { name: string; start: Date; end: Date | null; status: string; color: string } => !!e.start);

  let status = "🔴 Fuera de turno";
  let color = "#ef4444";

  if (inicioJ && finJ && now >= inicioJ && now <= finJ) {
    status = "🟢 En jornada";
    color = "#10b981";
    for (const ev of eventos) {
      if (ev.end && now >= ev.start && now <= ev.end) {
        status = ev.status;
        color = ev.color;
        break;
      }
    }
  }

  const prox = eventos.find((e) => e.start > now);
  let next = "---";
  let countdown = "00:00";
  if (prox) {
    next = prox.name;
    const diff = prox.start.getTime() - now.getTime();
    const mm = Math.floor(diff / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    countdown = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  return { status, color, jornada: shift.jornada || "--:--", next, countdown };
}
