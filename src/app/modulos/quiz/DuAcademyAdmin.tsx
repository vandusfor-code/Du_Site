"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, RefreshCw, Users, X, FileText, BookOpen, Trophy, Trash2 } from "lucide-react";
import { parsearPreguntasTSV, type ResultadoParseoPreguntas } from "@/lib/evaluaciones-tipos";
import type { CursoResumen, FilaResultadoCurso, TemaBase, LeaderboardEntry } from "@/lib/duacademy-cursos";
import {
  listarCursosAction, crearCursoAction, activarCursoAction, eliminarCursoAction, obtenerResultadosCursoAction,
  listarBaseAction, crearTemaBaseAction, eliminarTemaBaseAction, obtenerLeaderboardAction,
} from "./actions";

const ACC = "#4f46e5";
const S = {
  page: { maxWidth: 1040, margin: "0 auto", padding: "32px 22px 72px", fontFamily: "Inter, system-ui, sans-serif", color: "#1b2233" } as const,
  card: { border: "1px solid #eceef3", borderRadius: 16, background: "#fff", boxShadow: "0 8px 28px rgba(23,30,56,.05)" } as const,
  btn: { height: 42, borderRadius: 10, padding: "0 18px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: `1px solid ${ACC}`, background: ACC, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" } as const,
  ghost: { height: 42, borderRadius: 10, padding: "0 15px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: "1px solid #e3e6ee", background: "#fff", color: "#4a5168", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" } as const,
  input: { width: "100%", height: 44, border: "1px solid #e1e5ee", borderRadius: 10, padding: "0 13px", fontSize: 13.5, fontFamily: "inherit", color: "#273142", background: "#fff", outline: "none" } as const,
  area: { width: "100%", border: "1px solid #e1e5ee", borderRadius: 10, padding: "11px 13px", fontSize: 13, fontFamily: "inherit", color: "#273142", background: "#fbfbfe", resize: "vertical" as const, outline: "none" },
  areaMono: { width: "100%", border: "1px solid #e1e5ee", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#273142", background: "#fbfbfe", resize: "vertical" as const, outline: "none" },
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#9199a8", display: "block", marginBottom: 7 },
  tab: (on: boolean) => ({ height: 38, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: on ? `1px solid ${ACC}` : "1px solid #e3e6ee", background: on ? "#eef0fe" : "#fff", color: on ? ACC : "#4a5168", display: "inline-flex", alignItems: "center", gap: 7 } as const),
};

type Tab = "cursos" | "base" | "ranking";

export default function DuAcademyAdmin({ nombre, cursosIniciales, errorInicial }: { nombre: string; cursosIniciales: CursoResumen[]; errorInicial: string | null }) {
  const [tab, setTab] = useState<Tab>("cursos");
  const [cursos, setCursos] = useState<CursoResumen[]>(cursosIniciales);
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(errorInicial ? { tipo: "error", msg: errorInicial } : null);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [fTitulo, setFTitulo] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fUmbral, setFUmbral] = useState("60");
  const [fContenido, setFContenido] = useState("");
  const [fTexto, setFTexto] = useState("");
  const [preview, setPreview] = useState<ResultadoParseoPreguntas | null>(null);

  const [resModal, setResModal] = useState<{ curso: CursoResumen; filas: FilaResultadoCurso[] } | null>(null);
  const [cargandoRes, setCargandoRes] = useState(false);

  const [base, setBase] = useState<TemaBase[] | null>(null);
  const [nuevoTema, setNuevoTema] = useState("");
  const [nuevaInfo, setNuevaInfo] = useState("");
  const [ranking, setRanking] = useState<LeaderboardEntry[] | null>(null);

  async function refrescar() { try { setCursos(await listarCursosAction()); } catch { /* banner */ } }
  function limpiar() { setFTitulo(""); setFDesc(""); setFUmbral("60"); setFContenido(""); setFTexto(""); setPreview(null); }

  async function guardar() {
    if (guardando) return;
    if (!fTitulo.trim()) { setBanner({ tipo: "error", msg: "Escribe el título del curso." }); return; }
    const p = parsearPreguntasTSV(fTexto); setPreview(p);
    if (p.errores.length > 0 || p.preguntas.length === 0) { setBanner({ tipo: "error", msg: "Corrige las preguntas del examen antes de guardar." }); return; }
    setGuardando(true); setBanner(null);
    try {
      const res = await crearCursoAction({ titulo: fTitulo, descripcion: fDesc, contenido: fContenido, umbral: parseInt(fUmbral, 10) || 60, preguntasTexto: fTexto });
      if (res.ok) { setBanner({ tipo: "ok", msg: `Curso "${fTitulo}" creado con ${res.numPreguntas} preguntas (inactivo).` }); limpiar(); setCreando(false); await refrescar(); }
      else setBanner({ tipo: "error", msg: res.error });
    } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al guardar" }); }
    finally { setGuardando(false); }
  }

  async function toggleActivo(c: CursoResumen) {
    if (!window.confirm(`¿${c.activo ? "Desactivar" : "Activar"} el curso "${c.titulo}"?`)) return;
    setBanner(null);
    try { const r = await activarCursoAction(c.id, !c.activo); if (r.ok) { await refrescar(); } else setBanner({ tipo: "error", msg: r.error }); }
    catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); }
  }
  async function borrar(c: CursoResumen) {
    if (!window.confirm(`¿Eliminar el curso "${c.titulo}" y su examen? Esta acción no se puede deshacer.`)) return;
    try { const r = await eliminarCursoAction(c.id); if (r.ok) { setBanner({ tipo: "ok", msg: `Curso "${c.titulo}" eliminado.` }); await refrescar(); } else setBanner({ tipo: "error", msg: r.error }); }
    catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); }
  }
  async function verResultados(c: CursoResumen) {
    setCargandoRes(true); setResModal({ curso: c, filas: [] });
    try { setResModal({ curso: c, filas: await obtenerResultadosCursoAction(c.id) }); }
    catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); setResModal(null); }
    finally { setCargandoRes(false); }
  }

  async function cargarBase() { try { setBase(await listarBaseAction()); } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); } }
  async function guardarTema() {
    if (!nuevoTema.trim()) { setBanner({ tipo: "error", msg: "Escribe el tema." }); return; }
    try { const r = await crearTemaBaseAction(nuevoTema, nuevaInfo); if (r.ok) { setNuevoTema(""); setNuevaInfo(""); await cargarBase(); } else setBanner({ tipo: "error", msg: r.error }); }
    catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); }
  }
  async function borrarTema(id: number) {
    if (!window.confirm("¿Eliminar este tema?")) return;
    try { await eliminarTemaBaseAction(id); await cargarBase(); } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); }
  }
  async function cargarRanking() { try { setRanking(await obtenerLeaderboardAction()); } catch (e) { setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error" }); } }

  const activos = cursos.filter((c) => c.activo).length;

  return (
    <div style={S.page}>
      <div style={{ ...S.card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#eef0fe", color: ACC, display: "grid", placeItems: "center", flexShrink: 0 }}><GraduationCap size={26} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, color: "#9199a8" }}>DUACADEMY · FORMACIÓN</div>
          <h1 style={{ margin: "2px 0 3px", fontSize: 25, letterSpacing: -0.5 }}>Cursos</h1>
          <p style={{ margin: 0, color: "#737e90", fontSize: 13.5 }}>Hola, {nombre}. Crea cursos con lección y examen, actívalos y revisa el avance.</p>
        </div>
        {tab === "cursos" && <button style={S.btn} onClick={() => { setCreando((v) => !v); setBanner(null); }}>{creando ? <X size={16} /> : <Plus size={16} />} {creando ? "Cerrar" : "Crear curso"}</button>}
      </div>

      <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        <button style={S.tab(tab === "cursos")} onClick={() => setTab("cursos")}><GraduationCap size={15} /> Cursos</button>
        <button style={S.tab(tab === "base")} onClick={() => { setTab("base"); if (base === null) cargarBase(); }}><BookOpen size={15} /> Base de conocimiento</button>
        <button style={S.tab(tab === "ranking")} onClick={() => { setTab("ranking"); if (ranking === null) cargarRanking(); }}><Trophy size={15} /> Ranking</button>
      </div>

      {banner && <div style={{ margin: "0 0 16px", padding: "11px 15px", borderRadius: 11, fontSize: 13, fontWeight: 600, whiteSpace: "pre-line", background: banner.tipo === "ok" ? "#eafaf1" : "#fff0f1", color: banner.tipo === "ok" ? "#158a55" : "#d93142", border: `1px solid ${banner.tipo === "ok" ? "#b7e6cd" : "#ffd4d2"}` }}>{banner.msg}</div>}

      {/* ── CURSOS ── */}
      {tab === "cursos" && (
        <>
          {creando && (
            <div style={{ ...S.card, padding: 22, marginBottom: 18 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Nuevo curso</h3>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 13, marginBottom: 13 }}>
                <div><label style={S.label}>Título del curso *</label><input style={S.input} value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="Ej. Cuota monetaria" /></div>
                <div><label style={S.label}>Aprueba con (%)</label><input style={S.input} value={fUmbral} onChange={(e) => setFUmbral(e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 13 }}><label style={S.label}>Descripción (opcional)</label><input style={S.input} value={fDesc} onChange={(e) => setFDesc(e.target.value)} /></div>
              <div style={{ marginBottom: 13 }}><label style={S.label}>Lección / contenido (lo que estudia la asesora antes del examen)</label><textarea value={fContenido} onChange={(e) => setFContenido(e.target.value)} rows={7} style={S.area} placeholder={"Escribe aquí el contenido del curso. Puedes usar saltos de línea para organizarlo."} /></div>
              <label style={S.label}>Examen — pega las preguntas (ID · Pregunta · A · B · C · D · Correcta · Explicación)</label>
              <textarea value={fTexto} onChange={(e) => { setFTexto(e.target.value); setPreview(null); }} rows={8} style={S.areaMono} placeholder={"Pega aquí las filas copiadas de Excel/Sheets…"} />
              {preview && (
                <div style={{ marginTop: 12, padding: 13, borderRadius: 11, background: preview.errores.length ? "#fff5f5" : "#eefaf3", border: `1px solid ${preview.errores.length ? "#f0cccc" : "#bfe6cf"}` }}>
                  <b style={{ fontSize: 13, color: preview.errores.length ? "#bd4444" : "#158a55" }}>{preview.preguntas.length} pregunta(s) detectada(s).</b>
                  {preview.advertencias.length > 0 && <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 12, color: "#9a6a12" }}>{preview.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>}
                  {preview.errores.length > 0 && <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 12, color: "#bd4444" }}>{preview.errores.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 15 }}>
                <button style={S.ghost} onClick={() => setPreview(parsearPreguntasTSV(fTexto))}><FileText size={15} /> Vista previa</button>
                <button style={S.btn} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar curso"}</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 2px 12px" }}>
            <h2 style={{ margin: 0, fontSize: 14, color: "#4a5168" }}>Cursos <span style={{ color: "#9199a8" }}>({cursos.length} · {activos} activo{activos === 1 ? "" : "s"})</span></h2>
            <button style={{ ...S.ghost, height: 34 }} onClick={refrescar}><RefreshCw size={14} /> Actualizar</button>
          </div>

          {cursos.length === 0 ? (
            <div style={{ ...S.card, padding: "34px 22px", textAlign: "center", color: "#9199a8", fontSize: 13.5 }}>Aún no hay cursos. Crea el primero con <b style={{ color: ACC }}>“Crear curso”</b>.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {cursos.map((c) => (
                <div key={c.id} style={{ ...S.card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderLeft: `4px solid ${c.activo ? "#22c55e" : "#d6dbe6"}` }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700 }}>{c.titulo}</div>
                    {c.descripcion && <div style={{ fontSize: 12.5, color: "#737e90", marginTop: 3 }}>{c.descripcion}</div>}
                    <div style={{ fontSize: 11.5, color: "#9199a8", marginTop: 7 }}>{c.numPreguntas} preguntas · aprueba {c.umbral}%</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: c.activo ? "#eafaf1" : "#f0f2f6", color: c.activo ? "#16834b" : "#6b7589" }}>{c.activo ? "ACTIVO" : "INACTIVO"}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={S.ghost} onClick={() => verResultados(c)}><Users size={14} /> Avance</button>
                    <button style={c.activo ? S.ghost : S.btn} onClick={() => toggleActivo(c)}>{c.activo ? "Desactivar" : "Activar"}</button>
                    <button style={{ ...S.ghost, width: 40, padding: 0, justifyContent: "center", color: "#d64545" }} onClick={() => borrar(c)} title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BASE DE CONOCIMIENTO ── */}
      {tab === "base" && (
        <>
          <div style={{ ...S.card, padding: 22, marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Agregar tema</h3>
            <div style={{ marginBottom: 12 }}><label style={S.label}>Tema</label><input style={S.input} value={nuevoTema} onChange={(e) => setNuevoTema(e.target.value)} placeholder="Ej. Requisitos de afiliación" /></div>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Información</label><textarea style={S.area} rows={5} value={nuevaInfo} onChange={(e) => setNuevaInfo(e.target.value)} placeholder="Detalle del tema…" /></div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn} onClick={guardarTema}><Plus size={16} /> Guardar tema</button></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {base === null ? <p style={{ color: "#9199a8", textAlign: "center" }}>Cargando…</p> :
              base.length === 0 ? <div style={{ ...S.card, padding: "28px", textAlign: "center", color: "#9199a8" }}>Aún no hay temas en la base de conocimiento.</div> :
                base.map((t) => (
                  <div key={t.id} style={{ ...S.card, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{t.tema}</div><div style={{ fontSize: 12.5, color: "#737e90", marginTop: 4, whiteSpace: "pre-line" }}>{t.info}</div></div>
                    <button style={{ ...S.ghost, width: 40, padding: 0, justifyContent: "center", color: "#d64545" }} onClick={() => borrarTema(t.id)}><Trash2 size={15} /></button>
                  </div>
                ))}
          </div>
        </>
      )}

      {/* ── RANKING ── */}
      {tab === "ranking" && (
        <div style={{ ...S.card, padding: 18 }}>
          {ranking === null ? <p style={{ color: "#9199a8", textAlign: "center", padding: 20 }}>Cargando…</p> :
            ranking.length === 0 ? <div style={{ padding: "26px", textAlign: "center", color: "#9199a8" }}>Aún no hay avance registrado.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: "#9199a8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 }}><th style={{ padding: "8px 6px" }}>#</th><th style={{ padding: "8px 6px" }}>Asesora</th><th style={{ padding: "8px 6px" }}>Aprobados</th><th style={{ padding: "8px 6px" }}>Completados</th><th style={{ padding: "8px 6px" }}>Promedio</th></tr></thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.usuario} style={{ borderTop: "1px solid #eef0f4" }}>
                      <td style={{ padding: "9px 6px", fontWeight: 700, color: i < 3 ? ACC : "#9199a8" }}>{i + 1}</td>
                      <td style={{ padding: "9px 6px" }}><b>{r.nombre}</b><div style={{ fontSize: 10, color: "#9199a8" }}>{r.usuario}</div></td>
                      <td style={{ padding: "9px 6px", fontWeight: 700, color: "#16834b" }}>{r.aprobados}</td>
                      <td style={{ padding: "9px 6px" }}>{r.completados}</td>
                      <td style={{ padding: "9px 6px", fontWeight: 700 }}>{r.promedio}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {resModal && (
        <div onClick={() => setResModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,18,40,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "44px 16px", overflowY: "auto", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 660, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 30px 70px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div><div style={{ fontSize: 10.5, color: "#9199a8", fontWeight: 700, letterSpacing: 1 }}>AVANCE DEL CURSO</div><h3 style={{ margin: "3px 0 0", fontSize: 19 }}>{resModal.curso.titulo}</h3></div>
              <button style={{ ...S.ghost, width: 38, padding: 0, justifyContent: "center" }} onClick={() => setResModal(null)}><X size={16} /></button>
            </div>
            {cargandoRes ? <p style={{ textAlign: "center", color: "#9199a8", padding: 24 }}>Cargando…</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", color: "#9199a8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 }}><th style={{ padding: "8px 6px" }}>Asesora</th><th style={{ padding: "8px 6px" }}>Estado</th><th style={{ padding: "8px 6px" }}>Nota</th><th style={{ padding: "8px 6px" }}>Fecha</th></tr></thead>
                <tbody>
                  {resModal.filas.length === 0 ? <tr><td colSpan={4} style={{ padding: 18, textAlign: "center", color: "#9199a8" }}>No hay asesoras.</td></tr> :
                    resModal.filas.map((f) => (
                      <tr key={f.usuario} style={{ borderTop: "1px solid #eef0f4" }}>
                        <td style={{ padding: "9px 6px" }}><b>{f.nombre}</b><div style={{ fontSize: 10, color: "#9199a8" }}>{f.usuario}</div></td>
                        <td style={{ padding: "9px 6px" }}>{f.hizo ? <span style={{ color: f.aprobado ? "#16834b" : "#d64545", fontWeight: 650 }}>{f.aprobado ? "APROBADO" : "NO APROBADO"}</span> : <span style={{ color: "#b45309", fontWeight: 600 }}>Pendiente</span>}</td>
                        <td style={{ padding: "9px 6px", fontWeight: 700 }}>{f.nota !== null ? `${f.nota}%` : "—"}</td>
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
