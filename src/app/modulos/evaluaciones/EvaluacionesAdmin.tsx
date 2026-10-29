"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks, Plus, Bell, RefreshCw, Users, X, FileText } from "lucide-react";
import { parsearPreguntasTSV, type ResultadoParseoPreguntas } from "@/lib/evaluaciones-tipos";
import type { QuizResumen, FilaResultado } from "@/lib/evaluaciones";
import {
  listarQuizzesAction,
  crearQuizAction,
  activarQuizAction,
  obtenerResultadosQuizAction,
  avisarEvaluacionesAction,
} from "./actions";

const ACC = "#4f46e5"; // indigo Du Site
const S = {
  page: { maxWidth: 1040, margin: "0 auto", padding: "32px 22px 72px", fontFamily: "Inter, system-ui, sans-serif", color: "#1b2233" } as const,
  card: { border: "1px solid #eceef3", borderRadius: 16, background: "#fff", boxShadow: "0 8px 28px rgba(23,30,56,.05)" } as const,
  btn: { height: 42, borderRadius: 10, padding: "0 18px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: `1px solid ${ACC}`, background: ACC, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" } as const,
  ghost: { height: 42, borderRadius: 10, padding: "0 15px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: "1px solid #e3e6ee", background: "#fff", color: "#4a5168", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" } as const,
  input: { width: "100%", height: 44, border: "1px solid #e1e5ee", borderRadius: 10, padding: "0 13px", fontSize: 13.5, fontFamily: "inherit", color: "#273142", background: "#fff", outline: "none" } as const,
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#9199a8", display: "block", marginBottom: 7 },
};

export default function EvaluacionesAdmin({
  nombre,
  quizzesIniciales,
  errorInicial,
}: {
  nombre: string;
  quizzesIniciales: QuizResumen[];
  errorInicial: string | null;
}) {
  const [quizzes, setQuizzes] = useState<QuizResumen[]>(quizzesIniciales);
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(errorInicial ? { tipo: "error", msg: errorInicial } : null);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [avisando, setAvisando] = useState(false);

  const [fNombre, setFNombre] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDur, setFDur] = useState("5");
  const [fUmbral, setFUmbral] = useState("60");
  const [fTexto, setFTexto] = useState("");
  const [preview, setPreview] = useState<ResultadoParseoPreguntas | null>(null);

  const [resModal, setResModal] = useState<{ quiz: QuizResumen; filas: FilaResultado[] } | null>(null);
  const [cargandoRes, setCargandoRes] = useState(false);

  async function refrescar() {
    try { setQuizzes(await listarQuizzesAction()); } catch { /* banner informa */ }
  }
  function limpiarForm() { setFNombre(""); setFDesc(""); setFDur("5"); setFUmbral("60"); setFTexto(""); setPreview(null); }
  function verPreview() { setPreview(parsearPreguntasTSV(fTexto)); }

  async function guardar() {
    if (guardando) return;
    if (!fNombre.trim()) { setBanner({ tipo: "error", msg: "Escribe el nombre del módulo." }); return; }
    const p = parsearPreguntasTSV(fTexto);
    setPreview(p);
    if (p.errores.length > 0 || p.preguntas.length === 0) { setBanner({ tipo: "error", msg: "Corrige las preguntas antes de guardar." }); return; }
    setGuardando(true); setBanner(null);
    try {
      const res = await crearQuizAction({ nombre: fNombre, descripcion: fDesc, duracionMin: parseInt(fDur, 10) || 5, umbral: parseInt(fUmbral, 10) || 60, preguntasTexto: fTexto });
      if (res.ok) { setBanner({ tipo: "ok", msg: `Módulo "${fNombre}" creado con ${res.numPreguntas} preguntas (inactivo).` }); limpiarForm(); setCreando(false); await refrescar(); }
      else setBanner({ tipo: "error", msg: res.error });
    } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al guardar" }); }
    finally { setGuardando(false); }
  }

  async function toggleActivo(q: QuizResumen) {
    if (!window.confirm(`¿Deseas ${q.activo ? "desactivar" : "activar"} el módulo "${q.nombre}"?`)) return;
    setBanner(null);
    try {
      const res = await activarQuizAction(q.id, !q.activo);
      if (res.ok) { setBanner({ tipo: "ok", msg: `Módulo "${q.nombre}" ${q.activo ? "desactivado" : "activado"}.` }); await refrescar(); }
      else setBanner({ tipo: "error", msg: res.error });
    } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); }
  }

  async function verResultados(q: QuizResumen) {
    setCargandoRes(true); setResModal({ quiz: q, filas: [] });
    try { setResModal({ quiz: q, filas: await obtenerResultadosQuizAction(q.id) }); }
    catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al cargar resultados" }); setResModal(null); }
    finally { setCargandoRes(false); }
  }

  async function avisar() {
    if (!window.confirm("¿Enviar un correo a las asesoras avisando que tienen evaluaciones pendientes?")) return;
    setAvisando(true); setBanner(null);
    try {
      const r = await avisarEvaluacionesAction();
      setBanner({ tipo: r.enviados > 0 ? "ok" : "error", msg: r.enviados > 0 ? `Aviso enviado a ${r.enviados} asesora(s).` : "No se encontraron correos de asesoras para avisar." });
    } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al avisar" }); }
    finally { setAvisando(false); }
  }

  const activos = quizzes.filter((q) => q.activo).length;

  return (
    <div style={S.page}>
      {/* Header premium */}
      <div style={{ ...S.card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#eef0fe", color: ACC, display: "grid", placeItems: "center", flexShrink: 0 }}><ListChecks size={26} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, color: "#9199a8" }}>GESTIÓN DE EVALUACIONES</div>
          <h1 style={{ margin: "2px 0 3px", fontSize: 25, letterSpacing: -0.5 }}>Evaluaciones</h1>
          <p style={{ margin: 0, color: "#737e90", fontSize: 13.5 }}>Hola, {nombre}. Crea módulos, actívalos y revisa las calificaciones.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={S.ghost} onClick={avisar} disabled={avisando}><Bell size={15} /> {avisando ? "Enviando…" : "Avisar a las asesoras"}</button>
          <button style={S.btn} onClick={() => { setCreando((v) => !v); setBanner(null); }}>{creando ? <X size={16} /> : <Plus size={16} />} {creando ? "Cerrar" : "Crear módulo"}</button>
        </div>
      </div>

      {banner && (
        <div style={{ margin: "0 0 16px", padding: "11px 15px", borderRadius: 11, fontSize: 13, fontWeight: 600, whiteSpace: "pre-line", background: banner.tipo === "ok" ? "#eafaf1" : "#fff0f1", color: banner.tipo === "ok" ? "#158a55" : "#d93142", border: `1px solid ${banner.tipo === "ok" ? "#b7e6cd" : "#ffd4d2"}` }}>{banner.msg}</div>
      )}

      {/* Crear módulo */}
      {creando && (
        <div style={{ ...S.card, padding: 22, marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Nuevo módulo</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 13, marginBottom: 13 }}>
            <div><label style={S.label}>Nombre del módulo *</label><input style={S.input} value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Ej. Cuota monetaria" /></div>
            <div><label style={S.label}>Duración (min)</label><input style={S.input} value={fDur} onChange={(e) => setFDur(e.target.value)} /></div>
            <div><label style={S.label}>Aprueba con (%)</label><input style={S.input} value={fUmbral} onChange={(e) => setFUmbral(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 13 }}><label style={S.label}>Descripción (opcional)</label><input style={S.input} value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
          <label style={S.label}>Preguntas — copia las filas desde tu hoja (ID · Pregunta · A · B · C · D · Correcta · Explicación) y pégalas aquí</label>
          <textarea value={fTexto} onChange={(e) => { setFTexto(e.target.value); setPreview(null); }} rows={9} placeholder={"Pega aquí las filas copiadas de Excel/Sheets…"}
            style={{ width: "100%", border: "1px solid #e1e5ee", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#273142", background: "#fbfbfe", resize: "vertical", outline: "none" }} />
          {preview && (
            <div style={{ marginTop: 12, padding: 13, borderRadius: 11, background: preview.errores.length ? "#fff5f5" : "#eefaf3", border: `1px solid ${preview.errores.length ? "#f0cccc" : "#bfe6cf"}` }}>
              <b style={{ fontSize: 13, color: preview.errores.length ? "#bd4444" : "#158a55" }}>{preview.preguntas.length} pregunta(s) detectada(s).</b>
              {preview.advertencias.length > 0 && <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 12, color: "#9a6a12" }}>{preview.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              {preview.errores.length > 0 && <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 12, color: "#bd4444" }}>{preview.errores.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 15 }}>
            <button style={S.ghost} onClick={verPreview}><FileText size={15} /> Vista previa</button>
            <button style={S.btn} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar módulo"}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 2px 12px" }}>
        <h2 style={{ margin: 0, fontSize: 14, color: "#4a5168" }}>Módulos <span style={{ color: "#9199a8" }}>({quizzes.length} · {activos} activo{activos === 1 ? "" : "s"})</span></h2>
        <button style={{ ...S.ghost, height: 34 }} onClick={refrescar}><RefreshCw size={14} /> Actualizar</button>
      </div>

      {quizzes.length === 0 ? (
        <div style={{ ...S.card, padding: "34px 22px", textAlign: "center", color: "#9199a8", fontSize: 13.5 }}>Aún no hay módulos. Crea el primero con <b style={{ color: ACC }}>“Crear módulo”</b>.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {quizzes.map((q) => (
            <div key={q.id} style={{ ...S.card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderLeft: `4px solid ${q.activo ? "#22c55e" : "#d6dbe6"}` }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{q.nombre}</div>
                {q.descripcion && <div style={{ fontSize: 12.5, color: "#737e90", marginTop: 3 }}>{q.descripcion}</div>}
                <div style={{ fontSize: 11.5, color: "#9199a8", marginTop: 7 }}>{q.numPreguntas} preguntas · {q.duracionMin} min · aprueba {q.umbral}%</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: q.activo ? "#eafaf1" : "#f0f2f6", color: q.activo ? "#16834b" : "#6b7589" }}>{q.activo ? "ACTIVO" : "INACTIVO"}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.ghost} onClick={() => verResultados(q)}><Users size={14} /> Resultados</button>
                <button style={q.activo ? S.ghost : S.btn} onClick={() => toggleActivo(q)}>{q.activo ? "Desactivar" : "Activar"}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resModal && (
        <div onClick={() => setResModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,18,40,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "44px 16px", overflowY: "auto", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 660, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 30px 70px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div><div style={{ fontSize: 10.5, color: "#9199a8", fontWeight: 700, letterSpacing: 1 }}>CALIFICACIONES</div><h3 style={{ margin: "3px 0 0", fontSize: 19 }}>{resModal.quiz.nombre}</h3></div>
              <button style={{ ...S.ghost, width: 38, padding: 0, justifyContent: "center" }} onClick={() => setResModal(null)}><X size={16} /></button>
            </div>
            {cargandoRes ? <p style={{ textAlign: "center", color: "#9199a8", padding: 24 }}>Cargando…</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: "#9199a8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 }}><th style={{ padding: "8px 6px" }}>Asesora</th><th style={{ padding: "8px 6px" }}>Estado</th><th style={{ padding: "8px 6px" }}>Nota</th><th style={{ padding: "8px 6px" }}>Fecha</th></tr></thead>
                <tbody>
                  {resModal.filas.length === 0 ? <tr><td colSpan={4} style={{ padding: 18, textAlign: "center", color: "#9199a8" }}>No hay asesoras con el módulo asignado.</td></tr> :
                    resModal.filas.map((f) => (
                      <tr key={f.usuario} style={{ borderTop: "1px solid #eef0f4" }}>
                        <td style={{ padding: "9px 6px" }}><b>{f.nombre}</b><div style={{ fontSize: 10, color: "#9199a8" }}>{f.usuario}</div></td>
                        <td style={{ padding: "9px 6px" }}>{f.hizo ? <span style={{ color: f.resultado === "APROBADO" ? "#16834b" : "#d64545", fontWeight: 650 }}>{f.resultado || "Hecho"}</span> : <span style={{ color: "#b45309", fontWeight: 600 }}>Pendiente</span>}</td>
                        <td style={{ padding: "9px 6px", fontWeight: 700 }}>{f.porcentaje !== null ? `${f.porcentaje}%` : "—"}</td>
                        <td style={{ padding: "9px 6px", color: "#9199a8" }}>{f.fecha || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 28 }}><Link href="/" style={{ color: ACC, fontWeight: 600, fontSize: 14 }}>← Volver al inicio</Link></div>
    </div>
  );
}
