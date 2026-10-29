"use client";

import { useState } from "react";
import Link from "next/link";
import { parsearPreguntasTSV, type ResultadoParseoPreguntas } from "@/lib/evaluaciones-tipos";
import type { QuizResumen, FilaResultado } from "@/lib/evaluaciones";
import {
  listarQuizzesAction,
  crearQuizAction,
  activarQuizAction,
  obtenerResultadosQuizAction,
  avisarEvaluacionesAction,
} from "./actions";

const C = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "40px 20px 70px", fontFamily: "Inter, system-ui, sans-serif", color: "#18202d" } as const,
  card: { border: "1px solid #e7eaee", borderRadius: 12, padding: 20, marginBottom: 14, background: "#fff", boxShadow: "0 5px 18px rgba(20,35,55,.03)" } as const,
  btn: { height: 38, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #1677ff", background: "#1677ff", color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 } as const,
  btnGhost: { height: 38, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #e2e6eb", background: "#f7f8fa", color: "#4a5168" } as const,
  input: { width: "100%", height: 42, border: "1px solid #dfe4ea", borderRadius: 8, padding: "0 12px", fontSize: 13, fontFamily: "inherit", color: "#273142", background: "#fff" } as const,
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#8a94a4", display: "block", marginBottom: 6 },
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

  // Formulario crear
  const [fNombre, setFNombre] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDur, setFDur] = useState("5");
  const [fUmbral, setFUmbral] = useState("60");
  const [fTexto, setFTexto] = useState("");
  const [preview, setPreview] = useState<ResultadoParseoPreguntas | null>(null);

  // Resultados
  const [resModal, setResModal] = useState<{ quiz: QuizResumen; filas: FilaResultado[] } | null>(null);
  const [cargandoRes, setCargandoRes] = useState(false);

  async function refrescar() {
    try { setQuizzes(await listarQuizzesAction()); } catch { /* banner ya informa */ }
  }

  function limpiarForm() {
    setFNombre(""); setFDesc(""); setFDur("5"); setFUmbral("60"); setFTexto(""); setPreview(null);
  }

  function verPreview() {
    setPreview(parsearPreguntasTSV(fTexto));
  }

  async function guardar() {
    if (guardando) return;
    if (!fNombre.trim()) { setBanner({ tipo: "error", msg: "Escribe el nombre del módulo." }); return; }
    const p = parsearPreguntasTSV(fTexto);
    setPreview(p);
    if (p.errores.length > 0 || p.preguntas.length === 0) {
      setBanner({ tipo: "error", msg: "Corrige las preguntas antes de guardar." });
      return;
    }
    setGuardando(true);
    setBanner(null);
    try {
      const res = await crearQuizAction({
        nombre: fNombre, descripcion: fDesc, duracionMin: parseInt(fDur, 10) || 5,
        umbral: parseInt(fUmbral, 10) || 60, preguntasTexto: fTexto,
      });
      if (res.ok) {
        setBanner({ tipo: "ok", msg: `Módulo "${fNombre}" creado con ${res.numPreguntas} preguntas (inactivo).` });
        limpiarForm(); setCreando(false); await refrescar();
      } else {
        setBanner({ tipo: "error", msg: res.error });
      }
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(q: QuizResumen) {
    const accion = q.activo ? "desactivar" : "activar";
    if (!window.confirm(`¿Deseas ${accion} el módulo "${q.nombre}"?`)) return;
    setBanner(null);
    try {
      const res = await activarQuizAction(q.id, !q.activo);
      if (res.ok) { setBanner({ tipo: "ok", msg: `Módulo "${q.nombre}" ${q.activo ? "desactivado" : "activado"}.` }); await refrescar(); }
      else setBanner({ tipo: "error", msg: res.error });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" });
    }
  }

  async function verResultados(q: QuizResumen) {
    setCargandoRes(true);
    setResModal({ quiz: q, filas: [] });
    try {
      const filas = await obtenerResultadosQuizAction(q.id);
      setResModal({ quiz: q, filas });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al cargar resultados" });
      setResModal(null);
    } finally {
      setCargandoRes(false);
    }
  }

  async function avisar() {
    if (!window.confirm("¿Enviar un correo a las asesoras avisando que tienen evaluaciones pendientes?")) return;
    setAvisando(true);
    setBanner(null);
    try {
      const r = await avisarEvaluacionesAction();
      setBanner({ tipo: r.enviados > 0 ? "ok" : "error", msg: r.enviados > 0 ? `Aviso enviado a ${r.enviados} asesora(s).` : "No se encontraron correos de asesoras para avisar." });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al avisar" });
    } finally {
      setAvisando(false);
    }
  }

  const activos = quizzes.filter((q) => q.activo).length;

  return (
    <div style={C.page}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#667085", marginBottom: 8 }}>GESTIÓN DE EVALUACIONES</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 30, color: "#17202d" }}>Evaluaciones</h1>
          <p style={{ margin: 0, color: "#737e90", fontSize: 14 }}>Hola, {nombre}. Crea módulos, actívalos y revisa las calificaciones.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={C.btnGhost} onClick={avisar} disabled={avisando}>{avisando ? "Enviando…" : "Avisar a las asesoras"}</button>
          <button style={C.btn} onClick={() => { setCreando((v) => !v); setBanner(null); }}>{creando ? "Cerrar" : "+ Crear módulo"}</button>
        </div>
      </div>

      {banner && (
        <div style={{ margin: "16px 0", padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, whiteSpace: "pre-line", background: banner.tipo === "ok" ? "#eafaf1" : "#fff0f1", color: banner.tipo === "ok" ? "#158a55" : "#d93142", border: `1px solid ${banner.tipo === "ok" ? "#b7e6cd" : "#ffd4d2"}` }}>
          {banner.msg}
        </div>
      )}

      {/* Crear módulo */}
      {creando && (
        <div style={{ ...C.card, marginTop: 16 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Nuevo módulo</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={C.label}>Nombre del módulo *</label><input style={C.input} value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Ej. Cuota monetaria" /></div>
            <div><label style={C.label}>Duración (min)</label><input style={C.input} value={fDur} onChange={(e) => setFDur(e.target.value)} /></div>
            <div><label style={C.label}>Aprueba con (%)</label><input style={C.input} value={fUmbral} onChange={(e) => setFUmbral(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={C.label}>Descripción (opcional)</label><input style={C.input} value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
          <div>
            <label style={C.label}>Preguntas — copia las filas desde tu hoja (ID · Pregunta · Opción A · B · C · D · Correcta · Explicación) y pégalas aquí</label>
            <textarea
              value={fTexto}
              onChange={(e) => { setFTexto(e.target.value); setPreview(null); }}
              rows={10}
              placeholder={"Pega aquí las filas copiadas de Excel/Sheets…"}
              style={{ width: "100%", border: "1px solid #dfe4ea", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#273142", background: "#fbfcfd", resize: "vertical" }}
            />
          </div>
          {preview && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: preview.errores.length ? "#fff5f5" : "#eafaf1", border: `1px solid ${preview.errores.length ? "#f0cccc" : "#b7e6cd"}` }}>
              <b style={{ fontSize: 13 }}>{preview.preguntas.length} pregunta(s) detectada(s).</b>
              {preview.advertencias.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#9a6a12" }}>{preview.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              {preview.errores.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#bd4444" }}>{preview.errores.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
            <button style={C.btnGhost} onClick={verPreview}>Vista previa</button>
            <button style={C.btn} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar módulo"}</button>
          </div>
        </div>
      )}

      {/* Lista de módulos */}
      <h2 style={{ margin: "26px 0 12px", fontSize: 14, color: "#273142" }}>Módulos ({quizzes.length}) · {activos} activo(s)</h2>
      {quizzes.length === 0 ? (
        <div style={{ ...C.card, textAlign: "center", color: "#8a94a4", fontSize: 13 }}>Aún no hay módulos. Crea el primero con “+ Crear módulo”.</div>
      ) : quizzes.map((q) => (
        <div key={q.id} style={{ ...C.card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{q.nombre}</div>
            {q.descripcion && <div style={{ fontSize: 12, color: "#737e90", marginTop: 3 }}>{q.descripcion}</div>}
            <div style={{ fontSize: 11, color: "#8a94a4", marginTop: 6 }}>{q.numPreguntas} preguntas · {q.duracionMin} min · aprueba {q.umbral}%</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 20, background: q.activo ? "#eaf8f0" : "#f0f2f4", color: q.activo ? "#16834b" : "#607086" }}>{q.activo ? "ACTIVO" : "INACTIVO"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={C.btnGhost} onClick={() => verResultados(q)}>Resultados</button>
            <button style={q.activo ? C.btnGhost : C.btn} onClick={() => toggleActivo(q)}>{q.activo ? "Desactivar" : "Activar"}</button>
          </div>
        </div>
      ))}

      {/* Modal resultados */}
      {resModal && (
        <div onClick={() => setResModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,18,40,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 11, color: "#8a94a4", fontWeight: 700 }}>CALIFICACIONES</div><h3 style={{ margin: "2px 0 0" }}>{resModal.quiz.nombre}</h3></div>
              <button style={C.btnGhost} onClick={() => setResModal(null)}>Cerrar</button>
            </div>
            {cargandoRes ? <p style={{ textAlign: "center", color: "#8a94a4", padding: 20 }}>Cargando…</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: "#607086", fontSize: 11 }}><th style={{ padding: "8px 6px" }}>Asesora</th><th style={{ padding: "8px 6px" }}>Estado</th><th style={{ padding: "8px 6px" }}>Nota</th><th style={{ padding: "8px 6px" }}>Fecha</th></tr></thead>
                <tbody>
                  {resModal.filas.length === 0 ? <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#8a94a4" }}>No hay asesoras con el módulo asignado.</td></tr> :
                    resModal.filas.map((f) => (
                      <tr key={f.usuario} style={{ borderTop: "1px solid #eef0f4" }}>
                        <td style={{ padding: "8px 6px" }}><b>{f.nombre}</b><div style={{ fontSize: 10, color: "#8a94a4" }}>{f.usuario}</div></td>
                        <td style={{ padding: "8px 6px" }}>{f.hizo ? <span style={{ color: f.resultado === "APROBADO" ? "#16834b" : "#d64545", fontWeight: 600 }}>{f.resultado || "Hecho"}</span> : <span style={{ color: "#b45309" }}>Pendiente</span>}</td>
                        <td style={{ padding: "8px 6px" }}>{f.porcentaje !== null ? `${f.porcentaje}%` : "—"}</td>
                        <td style={{ padding: "8px 6px", color: "#8a94a4" }}>{f.fecha || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 28 }}><Link href="/" style={{ color: "#1677ff", fontWeight: 600, fontSize: 14 }}>← Volver al inicio</Link></div>
    </div>
  );
}
