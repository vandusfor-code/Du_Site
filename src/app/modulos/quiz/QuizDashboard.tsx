"use client";

import "./duacademy.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  obtenerDatosCompletosAction,
  obtenerPreguntasAction,
  guardarResultadoAction,
  hablarConIAAction,
  actualizarPingConexionAction,
  obtenerDatosAdminAction,
  asignarModulosUsuarioAction,
  enviarCorreoGeneralAction,
} from "./actions";
import type {
  DatosCompletos,
  Pregunta,
  MensajeIA,
  DatosAdmin,
  FilaObjeto,
} from "@/lib/duacademy";
import {
  DashboardView,
  ModuloView,
  ExamenView,
  ResultadoView,
  SimulacionView,
  AdminView,
  ModalAsignacion,
  HistorySidebar,
} from "./QuizViews";

type Vista = "dashboard" | "modulo" | "examen" | "resultado" | "simulacion" | "admin";

interface ChatBubble {
  role: "user" | "bot";
  content: string;
}

export default function QuizDashboard({
  nombre,
  rol,
}: {
  nombre: string;
  rol: string;
}) {
  const esAdmin = rol.trim().toLowerCase() === "admin";

  const [vista, setVista] = useState<Vista>(esAdmin ? "admin" : "dashboard");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notif, setNotif] = useState<{ msg: string; error?: boolean } | null>(null);
  const notifTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userData, setUserData] = useState<DatosCompletos | null>(null);
  const [cargandoDashboard, setCargandoDashboard] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [cursoActualId, setCursoActualId] = useState("");
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [indicePregunta, setIndicePregunta] = useState(0);
  const [respuestasUsuario, setRespuestasUsuario] = useState<string[]>([]);
  const [notaFinal, setNotaFinal] = useState(0);

  const [simActualId, setSimActualId] = useState("");
  const [simTitulo, setSimTitulo] = useState("Simulación");
  const [chatHistorial, setChatHistorial] = useState<MensajeIA[]>([]);
  const [chatBubbles, setChatBubbles] = useState<ChatBubble[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const [adminData, setAdminData] = useState<DatosAdmin | null>(null);
  const [modalAsesor, setModalAsesor] = useState<{ email: string; nombre: string; cursos: string; sims: string } | null>(null);

  const mostrarNotificacion = useCallback((msg: string, error = false) => {
    setNotif({ msg, error });
    if (notifTimeout.current) clearTimeout(notifTimeout.current);
    notifTimeout.current = setTimeout(() => setNotif(null), 2500);
  }, []);

  const cargarDashboard = useCallback(() => {
    setCargandoDashboard(true);
    obtenerDatosCompletosAction().then((data) => {
      setUserData(data);
      setCargandoDashboard(false);
    });
  }, []);

  const cargarDatosAdmin = useCallback(() => {
    mostrarNotificacion("Cargando datos maestros...");
    obtenerDatosAdminAction().then(setAdminData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (esAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial única al montar
      cargarDatosAdmin();
      return;
    }

    cargarDashboard();
    actualizarPingConexionAction();
    const heartbeat = setInterval(actualizarPingConexionAction, 5 * 60 * 1000);
    return () => clearInterval(heartbeat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin]);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chatBubbles, escribiendo]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function regresarAlInicio() {
    setVista(esAdmin ? "admin" : "dashboard");
  }

  function abrirModulo(curso: FilaObjeto) {
    setCursoActualId(curso.ID_CURSO);
    setVista("modulo");
  }

  const cursoActual = userData?.todosLosCursos.find((c) => c.ID_CURSO === cursoActualId);
  const notaPreviaModulo = userData?.historial.find((h) => h.idItem === cursoActualId);

  async function cargarExamen() {
    const res = await obtenerPreguntasAction(cursoActualId);
    setPreguntas(res);
    setIndicePregunta(0);
    setRespuestasUsuario([]);
    setVista("examen");
  }

  function seleccionarRespuesta(letra: string) {
    setRespuestasUsuario((prev) => {
      const copia = [...prev];
      copia[indicePregunta] = letra;
      return copia;
    });
  }

  async function siguientePregunta() {
    if (!respuestasUsuario[indicePregunta]) {
      mostrarNotificacion("Selecciona una respuesta", true);
      return;
    }
    if (indicePregunta < preguntas.length - 1) {
      setIndicePregunta((i) => i + 1);
    } else {
      await finalizarExamen();
    }
  }

  async function finalizarExamen() {
    let aciertos = 0;
    const descErrores: string[] = [];
    preguntas.forEach((p, i) => {
      const correcta = (p.CORRECTA || "").trim().toUpperCase();
      const dada = (respuestasUsuario[i] || "").toUpperCase();
      if (correcta === dada) {
        aciertos++;
      } else {
        descErrores.push(`P${i + 1}:${respuestasUsuario[i]} (Correcta: ${p.CORRECTA})`);
      }
    });

    const nota = (aciertos / preguntas.length) * 100;
    mostrarNotificacion("Enviando resultados...");

    await guardarResultadoAction(cursoActualId, nota, descErrores.join(", "));
    setNotaFinal(nota);
    setVista("resultado");
    cargarDashboard();
  }

  function abrirSimulacion(sim: FilaObjeto) {
    setSimActualId(sim.ID_SIMULACION);
    setSimTitulo(sim.TITULO || "Simulación");
    setChatHistorial([]);
    setChatBubbles([]);
    setVista("simulacion");

    hablarConIAAction("iniciar", sim.ID_SIMULACION, []).then((respuesta) => {
      setChatHistorial([{ role: "assistant", content: respuesta }]);
      setChatBubbles([{ role: "bot", content: respuesta }]);
    });
  }

  async function enviarMensajeChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    setChatBubbles((prev) => [...prev, { role: "user", content: msg }]);
    const nuevoHistorial = [...chatHistorial, { role: "user" as const, content: msg }];
    setChatHistorial(nuevoHistorial);
    setEscribiendo(true);

    try {
      const respuesta = await hablarConIAAction(msg, simActualId, nuevoHistorial);
      setChatHistorial((h) => [...h, { role: "assistant", content: respuesta }]);
      setChatBubbles((prev) => [...prev, { role: "bot", content: respuesta }]);
    } catch {
      setChatBubbles((prev) => [...prev, { role: "bot", content: "Error de conexión con IA" }]);
    } finally {
      setEscribiendo(false);
    }
  }

  function abrirModalAdmin(email: string, nombre: string, cursos: string, sims: string) {
    setModalAsesor({ email, nombre, cursos, sims });
  }

  async function guardarAsignacionAdmin() {
    if (!modalAsesor) return;
    mostrarNotificacion("Guardando cambios...");
    const ok = await asignarModulosUsuarioAction(modalAsesor.email, modalAsesor.cursos, modalAsesor.sims);
    if (ok) {
      mostrarNotificacion("Cambios guardados con éxito");
      setModalAsesor(null);
      cargarDatosAdmin();
    }
  }

  async function enviarNotificacionGeneral() {
    mostrarNotificacion("Iniciando envío de correos...");
    try {
      const res = await enviarCorreoGeneralAction();
      mostrarNotificacion(`Correos enviados: ${res.enviados}`);
    } catch (e) {
      mostrarNotificacion(e instanceof Error ? e.message : "Error al enviar correos", true);
    }
  }

  const cursosAsignados = useMemo(() => {
    if (!userData) return [];
    const set = new Set(userData.asignadosCursos.map((id) => id.trim()));
    return userData.todosLosCursos.filter((c) => set.has((c.ID_CURSO || "").trim()));
  }, [userData]);

  const simsAsignadas = useMemo(() => {
    if (!userData) return [];
    const set = new Set(userData.asignadosSims.map((id) => id.trim()));
    return userData.todasLasSims.filter((s) => set.has((s.ID_SIMULACION || "").trim()));
  }, [userData]);

  const filtro = searchQuery.toLowerCase();
  const cursosFiltrados = cursosAsignados.filter((c) => `${c.ID_CURSO} ${c.TITULO}`.toLowerCase().includes(filtro));
  const simsFiltradas = simsAsignadas.filter((s) => `${s.ID_SIMULACION} ${s.TITULO}`.toLowerCase().includes(filtro));

  const promedio = userData && userData.historial.length > 0
    ? userData.historial.reduce((a, b) => a + b.nota, 0) / userData.historial.length
    : 0;

  return (
    <div className="duacademy-scope flex h-screen overflow-hidden" data-theme={theme} style={{ background: "var(--bg-main)" }}>
      <div className="flex h-screen overflow-hidden w-full">
        <Sidebar
          esAdmin={esAdmin}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onIrDashboard={() => setVista(esAdmin ? "admin" : "dashboard")}
        />

        <main className="flex-grow overflow-y-auto p-8 custom-scrollbar relative">
          {vista === "dashboard" && !esAdmin && (
            <DashboardView
              nombre={nombre}
              cargando={cargandoDashboard}
              cursos={cursosFiltrados}
              sims={simsFiltradas}
              statModulos={cursosAsignados.length + simsAsignadas.length}
              statCompletados={userData?.historial.length ?? 0}
              statPromedio={(promedio * 100).toFixed(0) + "%"}
              historial={userData?.historial ?? []}
              todosLosCursos={userData?.todosLosCursos ?? []}
              todasLasSims={userData?.todasLasSims ?? []}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onAbrirModulo={abrirModulo}
              onAbrirSimulacion={abrirSimulacion}
            />
          )}

          {vista === "modulo" && cursoActual && (
            <ModuloView
              curso={cursoActual}
              notaPrevia={notaPreviaModulo}
              onVolver={regresarAlInicio}
              onIniciarEvaluacion={cargarExamen}
            />
          )}

          {vista === "examen" && preguntas.length > 0 && (
            <ExamenView
              pregunta={preguntas[indicePregunta]}
              indice={indicePregunta}
              total={preguntas.length}
              seleccionActual={respuestasUsuario[indicePregunta]}
              onSeleccionar={seleccionarRespuesta}
              onSiguiente={siguientePregunta}
            />
          )}

          {vista === "resultado" && (
            <ResultadoView nota={notaFinal} onVolver={regresarAlInicio} />
          )}

          {vista === "simulacion" && (
            <SimulacionView
              titulo={simTitulo}
              bubbles={chatBubbles}
              escribiendo={escribiendo}
              input={chatInput}
              onInputChange={setChatInput}
              onEnviar={enviarMensajeChat}
              onVolver={regresarAlInicio}
              chatBoxRef={chatBoxRef}
            />
          )}

          {vista === "admin" && esAdmin && (
            <AdminView
              data={adminData}
              onRefrescar={cargarDatosAdmin}
              onNotificarTodos={enviarNotificacionGeneral}
              onEditar={abrirModalAdmin}
            />
          )}

          {modalAsesor && (
            <ModalAsignacion
              asesor={modalAsesor}
              onChange={setModalAsesor}
              onCancelar={() => setModalAsesor(null)}
              onGuardar={guardarAsignacionAdmin}
            />
          )}
        </main>

        {!esAdmin && (
          <HistorySidebar nombre={nombre} historial={userData?.historial ?? []} todosLosCursos={userData?.todosLosCursos ?? []} todasLasSims={userData?.todasLasSims ?? []} />
        )}
      </div>

      <div className={`notification-toast ${notif ? "show" : ""}`}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-lg shrink-0 text-sm"
          style={{ background: notif?.error ? "#F43F5E" : "#CCFF00", color: notif?.error ? "white" : "#2B234F" }}
        >
          {notif?.error ? "✕" : "✓"}
        </div>
        <span className="font-bold text-[12px] tracking-tight pr-2">{notif?.msg}</span>
      </div>
    </div>
  );
}

function IconDashboard() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function Sidebar({
  esAdmin,
  collapsed,
  onToggleCollapse,
  theme,
  onToggleTheme,
  onIrDashboard,
}: {
  esAdmin: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onIrDashboard: () => void;
}) {
  return (
    <aside className={`sidebar-main flex flex-col p-7 shrink-0 relative z-20 ${collapsed ? "collapsed" : ""}`}>
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-10 w-6 h-6 bg-[#2B234F] text-[#CCFF00] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-30 text-[10px]"
      >
        <span>{collapsed ? "❯" : "❮"}</span>
      </button>

      <div className="sidebar-logo-container flex items-center gap-3 mb-10 px-1 transition-all overflow-hidden">
        <div className="w-10 h-10 bg-[#2B234F] rounded-xl flex items-center justify-center text-[#CCFF00] font-extrabold shadow-lg shrink-0 text-sm">Du</div>
        <div className="sidebar-header-text">
          <span className="font-extrabold text-lg tracking-tighter text-[#2B234F] block leading-none">DuAcademy</span>
          <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-[0.2em]">Formación &amp; Calidad</span>
        </div>
      </div>

      <nav className="flex-grow space-y-2">
        <p className="sidebar-text text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-5 px-3">Menú</p>
        <div className="space-y-2">
          <div
            onClick={onIrDashboard}
            className="sidebar-nav-item flex items-center gap-3 p-3.5 rounded-xl bg-indigo-50 text-indigo-600 font-bold cursor-pointer group transition-all text-sm"
          >
            {esAdmin ? <IconAdmin /> : <IconDashboard />}
            <span className="sidebar-text">{esAdmin ? "Panel Admin" : "Dashboard"}</span>
          </div>
        </div>
      </nav>

      <div className="mt-auto space-y-4 px-1">
        <div className="sidebar-nav-item flex items-center gap-3 p-3 rounded-xl transition-all">
          <div className={`theme-toggle ${theme === "dark" ? "active" : ""}`} onClick={onToggleTheme} />
          <span className="sidebar-text text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modo Oscuro</span>
        </div>

        <div className="sidebar-text bg-slate-50/50 p-5 rounded-2xl border border-slate-100/50">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Expert System</p>
          <p className="text-[9px] font-bold text-[#2B234F] uppercase opacity-60">By Duvan Ramos</p>
        </div>

        <Link
          href="/"
          className="sidebar-nav-item flex items-center gap-3 p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl font-bold transition-all w-full uppercase text-[9px] tracking-widest"
        >
          <IconLogout />
          <span className="sidebar-text">Volver al inicio</span>
        </Link>
      </div>
    </aside>
  );
}
