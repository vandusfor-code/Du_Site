"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Letra } from "@/lib/evaluaciones-tipos";
import type { PanelAsesora, QuizParaPresentar, ResultadoPresentacion, RevisionAsesora } from "@/lib/evaluaciones";
import {
  obtenerPanelAsesoraAction,
  iniciarQuizAction,
  verificarRespuestaAction,
  finalizarQuizAction,
  obtenerRevisionAction,
} from "./actions";

type Vista = "panel" | "quiz" | "resultado" | "revision";
type Guardada = { elegida: Letra; correcta: boolean; letraCorrecta: Letra };

const AZUL = "#1677ff";
const S = {
  page: { maxWidth: 820, margin: "0 auto", padding: "40px 20px 70px", fontFamily: "Inter, system-ui, sans-serif", color: "#18202d" } as const,
  btn: { height: 44, borderRadius: 8, padding: "0 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${AZUL}`, background: AZUL, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 } as const,
  btnDark: { height: 44, borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #171d28", background: "#171d28", color: "#fff" } as const,
  btnGhost: { height: 44, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #e2e6eb", background: "#f7f8fa", color: "#4a5168" } as const,
  card: { border: "1px solid #e7eaee", borderRadius: 12, padding: 18, marginBottom: 10, background: "#fff", boxShadow: "0 5px 18px rgba(20,35,55,.03)" } as const,
};

export default function EvaluacionesAsesora({ nombre }: { nombre: string }) {
  const [vista, setVista] = useState<Vista>("panel");
  const [panel, setPanel] = useState<PanelAsesora | null>(null);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<string>("");

  const [quiz, setQuiz] = useState<QuizParaPresentar | null>(null);
  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, Letra>>({});
  const respuestasRef = useRef<Record<string, Letra>>({});
  const [guardadas, setGuardadas] = useState<Record<string, Guardada>>({});
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enviadoRef = useRef(false);

  const [resultado, setResultado] = useState<ResultadoPresentacion | null>(null);
  const [revision, setRevision] = useState<RevisionAsesora | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // Carga del panel (setState dentro de .then, no síncrono en el efecto).
  const recargar = () => {
    obtenerPanelAsesoraAction()
      .then((p) => { setPanel(p); setCargando(false); })
      .catch((e) => { setMsg(e instanceof Error ? e.message : "Error al cargar"); setCargando(false); });
  };
  useEffect(() => { recargar(); }, []);

  // Mantiene una referencia viva de las respuestas para el envío por tiempo.
  useEffect(() => { respuestasRef.current = respuestas; }, [respuestas]);

  function detenerTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }

  async function iniciar(quizId: string) {
    setMsg("");
    const r = await iniciarQuizAction(quizId);
    if (!r.ok) { setMsg(r.error); setConfirmando(null); recargar(); return; }
    setQuiz(r.data);
    setIdx(0); setRespuestas({}); setGuardadas({});
    setResultado(null); enviadoRef.current = false;
    setTiempo(r.data.quiz.duracionSegundos);
    setConfirmando(null);
    setVista("quiz");
  }

  // Temporizador: solo decrementa. El envío por tiempo lo dispara el efecto de abajo.
  useEffect(() => {
    if (vista !== "quiz") { detenerTimer(); return; }
    timerRef.current = setInterval(() => setTiempo((t) => Math.max(0, t - 1)), 1000);
    return () => detenerTimer();
  }, [vista, quiz]);

  // Al llegar a 0, envía con las respuestas que haya (sin captura obsoleta).
  useEffect(() => {
    if (vista === "quiz" && tiempo === 0 && quiz && !enviadoRef.current) finalizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiempo, vista, quiz]);

  async function guardarRespuesta() {
    if (!quiz || guardando) return;
    const p = quiz.preguntas[idx];
    if (!p || guardadas[p.id]) return;
    const elegida = respuestas[p.id];
    if (!elegida) { setMsg("Selecciona una respuesta antes de guardar."); return; }
    setMsg(""); setGuardando(true);
    try {
      const r = await verificarRespuestaAction(quiz.quiz.id, p.id, elegida);
      if (r.ok) setGuardadas((g) => ({ ...g, [p.id]: { elegida, correcta: r.correcta, letraCorrecta: r.letraCorrecta } }));
      else setMsg(r.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo guardar. Revisa tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  async function finalizar(porTiempo = false) {
    if (!quiz || enviadoRef.current) return;
    enviadoRef.current = true;
    detenerTimer();
    setEnviando(true);
    if (porTiempo) setMsg("El tiempo terminó. Enviando tus respuestas…");
    try {
      const r = await finalizarQuizAction(quiz.quiz.id, respuestasRef.current);
      if (r.ok) { setResultado(r.data); setVista("resultado"); recargar(); }
      else { setMsg(r.error); enviadoRef.current = false; }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al enviar. Intenta de nuevo.");
      enviadoRef.current = false;
    } finally {
      setEnviando(false);
    }
  }

  async function verRevision(quizId: string) {
    setMsg("");
    const r = await obtenerRevisionAction(quizId);
    if (r.ok) { setRevision(r.data); setVista("revision"); }
    else setMsg(r.error);
  }

  function volverPanel() { detenerTimer(); setVista("panel"); setQuiz(null); setRevision(null); recargar(); }

  const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  // ── PANEL ──
  if (vista === "panel") {
    return (
      <div style={S.page}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#667085", marginBottom: 8 }}>MIS EVALUACIONES</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 30 }}>Hola, {nombre}</h1>
        <p style={{ margin: 0, color: "#737e90", fontSize: 14 }}>Presenta tus evaluaciones pendientes y revisa las que ya hiciste.</p>
        {msg && <div style={{ margin: "14px 0", padding: "10px 14px", borderRadius: 9, background: "#fff5f5", border: "1px solid #f0cccc", color: "#bd4444", fontSize: 13 }}>{msg}</div>}

        <h2 style={{ margin: "28px 0 10px", fontSize: 14 }}>Pendientes {panel && <span style={{ color: "#8a94a4" }}>({panel.pendientes.length})</span>}</h2>
        {cargando ? <p style={{ color: "#8a94a4" }}>Cargando…</p> : panel && panel.pendientes.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#8a94a4", fontSize: 13 }}>No tienes evaluaciones pendientes.</div>
        ) : panel?.pendientes.map((q) => (
          <div key={q.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{q.nombre}</div>
              {q.descripcion && <div style={{ fontSize: 12, color: "#737e90", marginTop: 3 }}>{q.descripcion}</div>}
              <div style={{ fontSize: 11, color: "#8a94a4", marginTop: 6 }}>{q.numPreguntas} preguntas · {q.duracionMin} min · una sola oportunidad</div>
            </div>
            {confirmando === q.id ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#bd4444", fontWeight: 600, maxWidth: 160, textAlign: "right" }}>Solo una oportunidad. ¿Comenzar?</span>
                <button style={S.btnGhost} onClick={() => setConfirmando(null)}>Cancelar</button>
                <button style={S.btn} onClick={() => iniciar(q.id)}>Comenzar</button>
              </div>
            ) : (
              <button style={S.btn} onClick={() => setConfirmando(q.id)}>Iniciar →</button>
            )}
          </div>
        ))}

        <h2 style={{ margin: "28px 0 10px", fontSize: 14 }}>Realizados {panel && <span style={{ color: "#8a94a4" }}>({panel.realizados.length})</span>}</h2>
        {panel && panel.realizados.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#8a94a4", fontSize: 13 }}>Aún no has presentado evaluaciones.</div>
        ) : panel?.realizados.map((q) => {
          const aprob = q.resultado === "APROBADO";
          return (
            <div key={q.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{q.nombre}</div>
                <div style={{ fontSize: 11, color: "#8a94a4", marginTop: 5 }}>Presentado el {q.fecha}</div>
                <span style={{ display: "inline-block", marginTop: 7, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: aprob ? "#eaf8f0" : "#fff0f0", color: aprob ? "#16834b" : "#d64545" }}>{q.resultado}</span>
              </div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 700 }}>{q.porcentaje}%</div><div style={{ fontSize: 10, color: "#8a94a4" }}>Puntaje</div></div>
              <button style={S.btnDark} onClick={() => verRevision(q.id)}>Ver revisión</button>
            </div>
          );
        })}

        <div style={{ marginTop: 26 }}><Link href="/" style={{ color: AZUL, fontWeight: 600, fontSize: 14 }}>← Volver al inicio</Link></div>
      </div>
    );
  }

  // ── QUIZ ──
  if (vista === "quiz" && quiz) {
    const p = quiz.preguntas[idx];
    const info = guardadas[p.id];
    const total = quiz.preguntas.length;
    const pct = Math.round(((idx + 1) / total) * 100);
    const esUltima = idx === total - 1;
    return (
      <div style={S.page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e6e9ee", paddingBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{quiz.quiz.nombre}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: tiempo <= 60 ? "#d64545" : "#273142" }}>⏱ {mmss(tiempo)}</div>
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: "#4f5b6d" }}>Pregunta {idx + 1} de {total}</div>
        <div style={{ height: 4, background: "#e8ebef", borderRadius: 10, overflow: "hidden", margin: "8px 0 22px" }}><div style={{ height: "100%", width: `${pct}%`, background: AZUL, transition: "width .3s" }} /></div>

        <div style={{ ...S.card, padding: "22px 20px" }}>
          {msg && <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 7, background: "#fff5f5", border: "1px solid #f0cccc", color: "#bd4444", fontSize: 12 }}>{msg}</div>}
          <div style={{ color: AZUL, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{String(idx + 1).padStart(2, "0")}.</div>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.35, fontWeight: 650 }}>{p.pregunta}</h2>

          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
            {p.opciones.map((o) => {
              const sel = respuestas[p.id] === o.letra;
              let bg = "#fff", bd = "#e5e9ee";
              if (info) {
                if (o.letra === info.elegida) { bd = info.correcta ? "#8fd4ad" : "#f0b4b4"; bg = info.correcta ? "#eaf8f0" : "#fff3f3"; }
                else if (!info.correcta && o.letra === info.letraCorrecta) { bd = "#8fd4ad"; bg = "#eaf8f0"; }
              } else if (sel) { bd = "#9fc9ff"; bg = "#eaf3ff"; }
              return (
                <button key={o.letra} type="button" disabled={!!info}
                  onClick={() => { if (!info) { setRespuestas((r) => ({ ...r, [p.id]: o.letra })); setMsg(""); } }}
                  style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", border: `1px solid ${bd}`, background: bg, borderRadius: 8, padding: "10px 13px", cursor: info ? "default" : "pointer", color: "#273142" }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontSize: 12, fontWeight: 600, border: `1px solid ${sel && !info ? AZUL : "#d6dce3"}`, background: sel && !info ? AZUL : "#f0f2f4", color: sel && !info ? "#fff" : "#263142" }}>{o.letra}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45 }}>{o.texto}</span>
                </button>
              );
            })}
          </div>

          {info && (
            <div style={{ marginTop: 14, padding: "10px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", background: info.correcta ? "#eaf8f0" : "#fff5f5", border: `1px solid ${info.correcta ? "#bfe6cf" : "#f0cccc"}`, color: info.correcta ? "#16834b" : "#bd4444" }}>
              {info.correcta ? "✓ ¡Respuesta correcta!" : `✗ Respuesta incorrecta. La correcta es la opción ${info.letraCorrecta}.`}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 10 }}>
            <button style={{ ...S.btnGhost, opacity: idx === 0 ? 0.5 : 1 }} disabled={idx === 0 || guardando} onClick={() => { setIdx((i) => Math.max(0, i - 1)); setMsg(""); }}>← Anterior</button>
            {!info ? (
              <button style={S.btnDark} disabled={guardando} onClick={guardarRespuesta}>{guardando ? "Guardando…" : "Guardar respuesta"}</button>
            ) : esUltima ? (
              <button style={S.btn} disabled={enviando} onClick={() => finalizar(false)}>{enviando ? "Enviando…" : "Ver resultado ✓"}</button>
            ) : (
              <button style={S.btn} onClick={() => { setIdx((i) => i + 1); setMsg(""); }}>Siguiente →</button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#8a94a4", marginTop: 12 }}>No recargues la página durante la evaluación.</p>
      </div>
    );
  }

  // ── RESULTADO ──
  if (vista === "resultado" && resultado) {
    const aprob = resultado.resultado === "APROBADO";
    return (
      <div style={{ ...S.page, textAlign: "center", maxWidth: 560 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "20px auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: aprob ? "#eaf8f0" : "#fff0f0", color: aprob ? "#16834b" : "#d64545" }}>{aprob ? "✓" : "×"}</div>
        <h1 style={{ margin: 0, fontSize: 30 }}>{aprob ? "¡Evaluación aprobada!" : "Evaluación finalizada"}</h1>
        <p style={{ margin: "11px auto 0", maxWidth: 420, color: "#7b8594", fontSize: 14 }}>{aprob ? "Excelente trabajo." : "Revisa tus errores para fortalecer tus conocimientos."}</p>
        <div style={{ marginTop: 28, fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>{resultado.porcentaje}%</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24 }}>
          <div style={{ minWidth: 100, padding: "12px 16px", border: "1px solid #e6e9ed", borderRadius: 7 }}><div style={{ fontSize: 17, fontWeight: 700 }}>{resultado.aciertos}</div><div style={{ fontSize: 9, color: "#8c95a3" }}>ACIERTOS</div></div>
          <div style={{ minWidth: 100, padding: "12px 16px", border: "1px solid #e6e9ed", borderRadius: 7 }}><div style={{ fontSize: 17, fontWeight: 700 }}>{resultado.errores}</div><div style={{ fontSize: 9, color: "#8c95a3" }}>ERRORES</div></div>
          <div style={{ minWidth: 100, padding: "12px 16px", border: "1px solid #e6e9ed", borderRadius: 7 }}><div style={{ fontSize: 17, fontWeight: 700 }}>{resultado.total}</div><div style={{ fontSize: 9, color: "#8c95a3" }}>PREGUNTAS</div></div>
        </div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 10 }}>
          <button style={S.btnDark} onClick={() => quiz && verRevision(quiz.quiz.id)}>Ver revisión</button>
          <button style={S.btnGhost} onClick={volverPanel}>Volver a mis evaluaciones</button>
        </div>
      </div>
    );
  }

  // ── REVISIÓN ──
  if (vista === "revision" && revision) {
    return (
      <div style={S.page}>
        <button style={{ ...S.btnGhost, height: 34, marginBottom: 18 }} onClick={volverPanel}>← Mis evaluaciones</button>
        <h1 style={{ margin: "0 0 4px", fontSize: 26 }}>{revision.quiz.nombre}</h1>
        <p style={{ margin: 0, color: "#737e90", fontSize: 13 }}>Presentado el {revision.resumen.fecha} · {revision.resumen.porcentaje}% · {revision.resumen.resultado}</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {revision.preguntas.map((p) => (
            <div key={p.numero} style={{ ...S.card, borderLeft: `4px solid ${p.acierto ? "#16834b" : "#d64545"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: AZUL, fontSize: 12, fontWeight: 700 }}>Pregunta {p.numero}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: p.acierto ? "#eaf8f0" : "#fff0f0", color: p.acierto ? "#16834b" : "#d64545" }}>{p.acierto ? "Correcta" : "Incorrecta"}</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 650 }}>{p.pregunta}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {p.opciones.map((o) => {
                  let bd = "#e5e9ee", bg = "#fff", nota = "";
                  if (o.letra === p.elegida) { const ok = p.acierto; bd = ok ? "#8fd4ad" : "#f0b4b4"; bg = ok ? "#eaf8f0" : "#fff3f3"; nota = ok ? "Tu respuesta ✓" : "Tu respuesta ✗"; }
                  else if (!p.acierto && o.letra === p.correcta) { bd = "#8fd4ad"; bg = "#eaf8f0"; nota = "Correcta"; }
                  return (
                    <div key={o.letra} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${bd}`, background: bg, borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, background: "#f0f2f4", border: "1px solid #d6dce3" }}>{o.letra}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{o.texto}</span>
                      {nota && <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", color: nota === "Correcta" || nota.includes("✓") ? "#16834b" : "#d64545" }}>{nota}</span>}
                    </div>
                  );
                })}
              </div>
              {!p.elegida && <div style={{ marginTop: 8, fontSize: 11, color: "#8a94a4" }}>No respondiste esta pregunta.</div>}
              {p.explicacion && <div style={{ marginTop: 10, fontSize: 12, color: "#4a5168", background: "#f7f8fa", borderRadius: 7, padding: "8px 11px" }}><b>¿Por qué?</b> {p.explicacion}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div style={S.page}><p>Cargando…</p></div>;
}
