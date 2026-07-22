"use client";

import { useEffect, useState, type RefObject } from "react";
import type { HistorialItem, Pregunta, FilaObjeto, DatosAdmin } from "@/lib/duacademy";

const LETRAS = ["A", "B", "C", "D"] as const;

function IconBack() {
  return (
    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group mb-6 flex items-center gap-2 font-bold text-slate-400 hover:text-[#2B234F] text-xs uppercase tracking-widest transition-all">
      <IconBack />
      Volver al Panel
    </button>
  );
}

/* ===================== */
/* DASHBOARD */
/* ===================== */

export function DashboardView({
  nombre,
  cargando,
  cursos,
  sims,
  statModulos,
  statCompletados,
  statPromedio,
  historial,
  todosLosCursos,
  todasLasSims,
  searchQuery,
  onSearch,
  onAbrirModulo,
  onAbrirSimulacion,
}: {
  nombre: string;
  cargando: boolean;
  cursos: FilaObjeto[];
  sims: FilaObjeto[];
  statModulos: number;
  statCompletados: number;
  statPromedio: string;
  historial: HistorialItem[];
  todosLosCursos: FilaObjeto[];
  todasLasSims: FilaObjeto[];
  searchQuery: string;
  onSearch: (q: string) => void;
  onAbrirModulo: (curso: FilaObjeto) => void;
  onAbrirSimulacion: (sim: FilaObjeto) => void;
}) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="hero-gradient rounded-[2rem] p-10 text-white relative overflow-hidden mb-8 shadow-2xl">
        <div className="relative z-10 max-w-lg">
          <span className="inline-block px-4 py-1.5 bg-[#CCFF00] text-[#2B234F] rounded-full text-[9px] font-extrabold uppercase tracking-widest mb-4">
            Plataforma de Éxito
          </span>
          <h2 className="text-3xl font-extrabold leading-tight mb-3 text-white tracking-tighter">
            Domina tus habilidades
            <br />
            de Gestión.
          </h2>
          <p className="text-indigo-200 text-sm font-medium opacity-80 leading-relaxed">
            Aprende a tu ritmo con módulos interactivos diseñados para la excelencia operativa, {nombre.split(" ")[0]}.
          </p>
        </div>
        <div className="absolute right-[-5%] top-[-10%] w-72 h-72 bg-indigo-500/20 rounded-full blur-[100px]" />
        <div className="absolute right-[15%] bottom-[-20%] w-56 h-56 bg-[#CCFF00]/10 rounded-full blur-[80px]" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg">📚</div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Módulos</p>
            <p className="text-xl font-extrabold text-slate-800 tracking-tight">{statModulos}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">✅</div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Completados</p>
            <p className="text-xl font-extrabold text-slate-800 tracking-tight">{statCompletados}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg">⭐</div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Promedio</p>
            <p className="text-xl font-extrabold text-slate-800 tracking-tight">{statPromedio}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 px-2">
        <h3 className="text-lg font-extrabold text-slate-800 tracking-tight whitespace-nowrap">Módulos de Aprendizaje</h3>
        <div className="h-px bg-slate-200 flex-grow opacity-40" />
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all w-44"
          />
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-36 rounded-[2rem]" />
          <div className="skeleton h-36 rounded-[2rem]" />
          <div className="skeleton h-36 rounded-[2rem]" />
          <div className="skeleton h-36 rounded-[2rem]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cursos.map((curso) => {
            const notaData = historial.find((h) => h.idItem === (curso.ID_CURSO || "").trim());
            const completado = !!notaData;
            const notaPct = notaData ? notaData.nota * 100 : 0;
            const aprobado = notaPct >= 70;
            return (
              <div key={curso.ID_CURSO} onClick={() => onAbrirModulo(curso)} className="course-card p-6 flex gap-6 cursor-pointer group">
                <div className="w-32 h-32 rounded-[1.5rem] overflow-hidden shrink-0 bg-slate-100 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={curso.IMAGEN || "https://via.placeholder.com/150"} alt={curso.TITULO} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="flex-grow py-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] font-extrabold text-indigo-500 uppercase tracking-widest">{curso.ID_CURSO}</span>
                    {completado && (
                      <span className={`${aprobado ? "badge-aprobado" : "badge-reprobado"} text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest`}>
                        {aprobado ? "Aprobado" : "No Aprobado"}
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm mb-2 leading-snug group-hover:text-indigo-600 transition-colors">{curso.TITULO}</h4>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex-grow h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${aprobado ? "bg-indigo-500" : "bg-rose-500"} transition-all duration-1000`} style={{ width: completado ? "100%" : "0%" }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{notaPct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {sims.map((sim) => {
            const notaData = historial.find((h) => h.idItem === (sim.ID_SIMULACION || "").trim());
            const completado = !!notaData;
            const notaPct = notaData ? notaData.nota * 100 : 0;
            const aprobado = notaPct >= 70;
            return (
              <div key={sim.ID_SIMULACION} onClick={() => onAbrirSimulacion(sim)} className="course-card p-6 flex gap-6 cursor-pointer group">
                <div className="w-32 h-32 rounded-[1.5rem] overflow-hidden shrink-0 bg-indigo-50 flex items-center justify-center text-4xl">🎧</div>
                <div className="flex-grow py-1">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] font-extrabold text-indigo-500 uppercase tracking-widest">{sim.ID_SIMULACION}</span>
                    {completado && (
                      <span className={`${aprobado ? "badge-aprobado" : "badge-reprobado"} text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest`}>
                        {aprobado ? "Aprobado" : "No Aprobado"}
                      </span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm mb-2 leading-snug group-hover:text-indigo-600 transition-colors">{sim.TITULO}</h4>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex-grow h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${aprobado ? "bg-indigo-500" : "bg-rose-500"} transition-all duration-1000`} style={{ width: completado ? "100%" : "0%" }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{notaPct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {cursos.length === 0 && sims.length === 0 && (
            <p className="text-sm text-slate-400 font-medium col-span-2 text-center py-16">
              {todosLosCursos.length + todasLasSims.length === 0
                ? "Aún no tienes módulos asignados."
                : "No se encontraron módulos con ese criterio de búsqueda."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== */
/* MÓDULO */
/* ===================== */

export function ModuloView({
  curso,
  notaPrevia,
  onVolver,
  onIniciarEvaluacion,
}: {
  curso: FilaObjeto;
  notaPrevia: HistorialItem | undefined;
  onVolver: () => void;
  onIniciarEvaluacion: () => void;
}) {
  return (
    <section className="animate-fade-in max-w-4xl mx-auto">
      <BotonVolver onClick={onVolver} />
      <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100" style={{ background: "var(--bg-card)" }}>
        <div className="aspect-video bg-[#0A0D14] shadow-2xl relative overflow-hidden">
          {curso.LINK_CONTENIDO ? (
            <iframe src={curso.LINK_CONTENIDO} className="w-full h-full border-none" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <span className="text-white font-extrabold text-[180px] tracking-tighter">DU</span>
            </div>
          )}
        </div>
        <div className="p-8 md:p-10">
          <div className="max-w-2xl mx-auto text-center">
            {notaPrevia && (
              <div className="mb-5">
                <span className="bg-indigo-100 text-indigo-600 text-[9px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest border border-indigo-200">
                  Resultado: <span>{(notaPrevia.nota * 100).toFixed(0)}%</span>
                </span>
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3 tracking-tighter" style={{ color: "var(--primary)" }}>
              {curso.TITULO}
            </h2>
            <div className="text-sm md:text-base mb-8 font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {curso.DESCRIPCION}
            </div>
            {!notaPrevia && (
              <button onClick={onIniciarEvaluacion} className="btn-primary btn-shimmer px-10 py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl mx-auto">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Iniciar Evaluación
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== */
/* EXAMEN */
/* ===================== */

export function ExamenView({
  pregunta,
  indice,
  total,
  seleccionActual,
  onSeleccionar,
  onSiguiente,
}: {
  pregunta: Pregunta;
  indice: number;
  total: number;
  seleccionActual: string | undefined;
  onSeleccionar: (letra: string) => void;
  onSiguiente: () => void;
}) {
  const pct = ((indice + 1) / total) * 100;

  return (
    <section className="animate-fade-in max-w-xl mx-auto pt-6">
      <div className="rounded-[2rem] shadow-xl overflow-hidden" style={{ background: "var(--bg-card)" }}>
        <div className="w-full h-1.5" style={{ background: "var(--bg-input)" }}>
          <div className="h-full bg-[#CCFF00] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className="p-8 md:p-10">
          <div className="progress-dots justify-center mb-8">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`progress-dot ${i === indice ? "active" : i < indice ? "done" : ""}`} />
            ))}
          </div>

          <div className="min-h-[300px]">
            <h3 className="text-xl font-bold mb-6 text-slate-800">{pregunta.PREGUNTA}</h3>
            <div className="space-y-3">
              {LETRAS.map((letra) => {
                const texto = pregunta["OPCION_" + letra];
                if (!texto) return null;
                return (
                  <div key={letra} onClick={() => onSeleccionar(letra)} className={`quiz-option ${seleccionActual === letra ? "selected" : ""}`}>
                    <span className="letter-badge">{letra}</span>
                    <span className="text-sm font-semibold text-slate-600">{texto}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex justify-between items-center p-4 rounded-2xl" style={{ background: "var(--bg-input)" }}>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>
                {indice + 1}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Pregunta
              </span>
            </div>
            <button onClick={onSiguiente} className="btn-primary btn-shimmer px-10 py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg">
              Continuar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== */
/* RESULTADO */
/* ===================== */

export function ResultadoView({ nota, onVolver }: { nota: number; onVolver: () => void }) {
  const offset = 534 - 534 * (nota / 100);
  const aprobado = nota >= 70;

  return (
    <section className="animate-fade-in pt-6">
      <div className="result-card animate-scale-in">
        <div className="gauge-container mb-4">
          <svg viewBox="0 0 200 200" width={180} height={180}>
            <circle className="gauge-bg" cx={100} cy={100} r={85} />
            <circle className="gauge-fill" cx={100} cy={100} r={85} stroke="var(--accent)" strokeDasharray={534} strokeDashoffset={offset} />
          </svg>
          <div className="gauge-text">
            <span className="text-5xl font-extrabold tracking-tighter" style={{ color: "var(--primary)" }}>
              {nota.toFixed(0)}%
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Calificación
            </span>
          </div>
        </div>
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg"
          style={{ background: aprobado ? "#D1FAE5" : "#FEF3C7", color: aprobado ? "#059669" : "#D97706" }}
        >
          {aprobado ? "🎉" : "💪"}
        </div>
        <h2 className="text-2xl font-extrabold mb-1 uppercase tracking-tighter" style={{ color: "var(--text-primary)" }}>
          {aprobado ? "¡Excelente Trabajo!" : "Sigue Practicando"}
        </h2>
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] mb-8" style={{ color: "var(--text-muted)" }}>
          Evaluación Finalizada
        </p>
        <button onClick={onVolver} className="btn-primary btn-shimmer w-full py-4 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
          </svg>
          Volver al Panel
        </button>
      </div>
    </section>
  );
}

/* ===================== */
/* SIMULACIÓN */
/* ===================== */

export function SimulacionView({
  titulo,
  bubbles,
  escribiendo,
  input,
  onInputChange,
  onEnviar,
  onVolver,
  chatBoxRef,
}: {
  titulo: string;
  bubbles: { role: "user" | "bot"; content: string }[];
  escribiendo: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onEnviar: () => void;
  onVolver: () => void;
  chatBoxRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="animate-fade-in max-w-2xl mx-auto pt-6">
      <BotonVolver onClick={onVolver} />
      <div className="rounded-[2rem] shadow-xl overflow-hidden border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)", height: "70vh" }}>
        <div className="p-5 border-b flex items-center gap-4" style={{ borderColor: "var(--border-light)" }}>
          <div className="w-10 h-10 rounded-xl bg-[#2B234F] flex items-center justify-center text-[#CCFF00] text-lg">🎧</div>
          <div>
            <h3 className="font-extrabold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>{titulo}</h3>
            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Cliente en línea
            </p>
          </div>
        </div>
        <div className="chat-container" style={{ height: "calc(100% - 68px)" }}>
          <div className="chat-messages custom-scrollbar" ref={chatBoxRef}>
            {bubbles.map((b, i) => (
              <div key={i} className={`chat-bubble ${b.role === "user" ? "user" : "bot"}`}>
                {b.content}
              </div>
            ))}
            {escribiendo && <div className="chat-bubble bot">Escribiendo...</div>}
          </div>
          <div className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder="Escribe tu respuesta..."
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onEnviar()}
            />
            <button onClick={onEnviar} className="btn-primary px-5 py-2.5 rounded-xl text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== */
/* HISTORIAL LATERAL */
/* ===================== */

export function HistorySidebar({
  nombre,
  historial,
  todosLosCursos,
  todasLasSims,
}: {
  nombre: string;
  historial: HistorialItem[];
  todosLosCursos: FilaObjeto[];
  todasLasSims: FilaObjeto[];
}) {
  const recientes = historial.slice(-5).reverse();

  return (
    <aside className="history-sidebar w-80 border-l p-7 flex flex-col shrink-0 overflow-y-auto custom-scrollbar z-20" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="relative mb-5 group cursor-pointer">
          <div className="absolute inset-0 bg-[#CCFF00] rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="w-16 h-16 rounded-[1.5rem] bg-[#2B234F] relative flex items-center justify-center font-extrabold text-white text-2xl transform group-hover:rotate-6 transition-transform shadow-xl border-4 border-white">
            {nombre.charAt(0).toUpperCase()}
          </div>
        </div>
        <h4 className="font-extrabold text-base tracking-tighter uppercase" style={{ color: "var(--primary)" }}>{nombre}</h4>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Agente Activo</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 px-1">
        <h3 className="font-bold text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--text-primary)" }}>Trayectoria</h3>
        <span className="text-[7px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">Top Performer</span>
      </div>

      <div className="space-y-3">
        {recientes.map((h, i) => {
          const item = todosLosCursos.find((c) => (c.ID_CURSO || "").trim() === h.idItem) || todasLasSims.find((s) => (s.ID_SIMULACION || "").trim() === h.idItem);
          if (!item) return null;
          const aprobado = h.nota * 100 >= 70;
          return (
            <div key={i} className="p-4 rounded-2xl border border-slate-100 hover:shadow-md transition-all bg-white/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${aprobado ? "bg-lime-100 text-lime-700" : "bg-rose-100 text-rose-700"} flex items-center justify-center font-bold text-[10px]`}>
                  {(h.nota * 100).toFixed(0)}%
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-800 truncate">{item.TITULO}</p>
                  <p className="text-[8px] text-slate-400 font-medium">{h.fecha}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-8 p-6 rounded-[2rem] border text-center" style={{ background: "var(--bg-input)", borderColor: "var(--border-light)" }}>
        <div className="text-xl mb-1">🎓</div>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consejo del día</p>
        <p className="text-[9px] font-medium" style={{ color: "var(--text-secondary)" }}>&quot;La excelencia no es un acto, sino un hábito.&quot;</p>
      </div>
    </aside>
  );
}

/* ===================== */
/* ADMIN */
/* ===================== */

export function AdminView({
  data,
  onRefrescar,
  onNotificarTodos,
  onEditar,
}: {
  data: DatosAdmin | null;
  onRefrescar: () => void;
  onNotificarTodos: () => void;
  onEditar: (email: string, nombre: string, cursos: string, sims: string) => void;
}) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return <div className="skeleton h-64 rounded-[2rem]" />;
  }

  return (
    <section className="animate-fade-in space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card flex items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl">👥</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Asesores</p>
            <p className="text-2xl font-extrabold text-slate-800">{data.stats.totalAsesores}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-lime-100 flex items-center justify-center text-lime-600 text-xl">⭐</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Promedio General</p>
            <p className="text-2xl font-extrabold text-slate-800">{data.stats.promedioGeneral}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 text-xl">🏆</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulos Logrados</p>
            <p className="text-2xl font-extrabold text-slate-800">{data.stats.totalCompletados}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 overflow-hidden" style={{ background: "var(--bg-card)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>Gestión de Asesores</h3>
            <p className="text-xs text-slate-400 font-medium">Asignación de contenido y monitoreo en tiempo real</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onNotificarTodos} className="btn-primary px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Notificar a Todos
            </button>
            <button onClick={onRefrescar} className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-50">
                <th className="pb-4 font-bold px-4">Asesor</th>
                <th className="pb-4 font-bold">Estado</th>
                <th className="pb-4 font-bold">Módulos Asignados</th>
                <th className="pb-4 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {data.asesores.map((u) => {
                const ultima = u.ultimaConexion ? new Date(u.ultimaConexion.split(" ").reverse().join(" ").replace(/\//g, "-")) : null;
                const online = ultima ? ahora - ultima.getTime() < 10 * 60 * 1000 : false;
                return (
                  <tr key={u.email} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs">
                          {u.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{u.nombre}</p>
                          <p className="text-[10px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${online ? "text-emerald-600" : "text-slate-400"}`}>
                          {online ? "En línea" : "Offline"}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">
                      <span className="block">Cursos: {u.modulos || "-"}</span>
                      <span className="block">Sims: {u.simulaciones || "-"}</span>
                    </td>
                    <td className="text-center">
                      <button onClick={() => onEditar(u.email, u.nombre, u.modulos, u.simulaciones)} className="p-2 hover:text-indigo-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.828 2.828 0 114 4L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 overflow-hidden" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>Monitor de Desempeño</h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-50">
                <th className="pb-4 font-bold px-4">Fecha</th>
                <th className="pb-4 font-bold">Asesor</th>
                <th className="pb-4 font-bold">Módulo/Sim</th>
                <th className="pb-4 font-bold">Calificación</th>
                <th className="pb-4 font-bold">Errores</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {data.progreso
                .slice()
                .reverse()
                .slice(0, 50)
                .map((p, i) => {
                  const notaColor = p.nota >= 0.7 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50";
                  return (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-4 px-4 text-[10px] text-slate-400 font-bold">{p.fecha}</td>
                      <td className="text-slate-700 font-bold">{p.email}</td>
                      <td className="text-slate-500 text-xs">{p.idItem}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-lg font-bold ${notaColor}`}>{(p.nota * 100).toFixed(0)}%</span>
                      </td>
                      <td className="text-[10px] text-rose-500 font-medium max-w-xs truncate" title={p.errores}>
                        {p.errores || "-"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function ModalAsignacion({
  asesor,
  onChange,
  onCancelar,
  onGuardar,
}: {
  asesor: { email: string; nombre: string; cursos: string; sims: string };
  onChange: (a: { email: string; nombre: string; cursos: string; sims: string }) => void;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0A0D14]/60 backdrop-blur-md">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scale-in">
        <h3 className="text-2xl font-extrabold tracking-tighter mb-2" style={{ color: "var(--text-primary)" }}>Asignar Contenido</h3>
        <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-8">{asesor.nombre}</p>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">IDs de Cursos (separados por coma)</label>
            <input
              type="text"
              className="input-premium"
              placeholder="CUR001, CUR002"
              value={asesor.cursos}
              onChange={(e) => onChange({ ...asesor, cursos: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">IDs de Simulaciones (separados por coma)</label>
            <input
              type="text"
              className="input-premium"
              placeholder="SIM001, SIM002"
              value={asesor.sims}
              onChange={(e) => onChange({ ...asesor, sims: e.target.value })}
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={onCancelar} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
              Cancelar
            </button>
            <button onClick={onGuardar} className="flex-1 py-4 rounded-2xl btn-primary shadow-xl text-[10px] uppercase tracking-widest">
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
