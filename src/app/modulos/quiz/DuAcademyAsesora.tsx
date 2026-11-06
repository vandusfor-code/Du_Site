"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen, CheckCircle2, XCircle, ArrowLeft, Flame, Award } from "lucide-react";
import type { Letra } from "@/lib/evaluaciones-tipos";
import type { PanelCursos, CursoDetalle, ExamenParaPresentar, ResultadoExamen } from "@/lib/duacademy-cursos";
import { obtenerPanelCursosAction, abrirCursoAction, iniciarExamenAction, finalizarExamenAction, obtenerMiProgresoAction } from "./actions";

const ACC = "#4f46e5";
const S = {
  page: { maxWidth: 920, margin: "0 auto", padding: "32px 22px 72px", fontFamily: "Inter, system-ui, sans-serif", color: "#1b2233" } as const,
  card: { border: "1px solid #eceef3", borderRadius: 16, background: "#fff", boxShadow: "0 8px 28px rgba(23,30,56,.05)" } as const,
  btn: { height: 44, borderRadius: 10, padding: "0 20px", fontSize: 13.5, fontWeight: 650, cursor: "pointer", border: `1px solid ${ACC}`, background: ACC, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 } as const,
  ghost: { height: 42, borderRadius: 10, padding: "0 15px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: "1px solid #e3e6ee", background: "#fff", color: "#4a5168", display: "inline-flex", alignItems: "center", gap: 7 } as const,
};

type Vista =
  | { v: "panel" }
  | { v: "curso"; curso: CursoDetalle }
  | { v: "examen"; examen: ExamenParaPresentar }
  | { v: "resultado"; titulo: string; res: ResultadoExamen };

export default function DuAcademyAsesora({ nombre }: { nombre: string }) {
  const [panel, setPanel] = useState<PanelCursos | null>(null);
  const [stats, setStats] = useState<{ completados: number; aprobados: number; promedio: number; racha: number } | null>(null);
  const [vista, setVista] = useState<Vista>({ v: "panel" });
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, Letra>>({});
  const [enviando, setEnviando] = useState(false);

  const cargarPanel = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([obtenerPanelCursosAction(), obtenerMiProgresoAction()]);
      setPanel(p); setStats(s);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar"); }
  }, []);

  useEffect(() => { cargarPanel(); }, [cargarPanel]);

  async function abrir(id: string) {
    setError(null); setCargando(true);
    try { const r = await abrirCursoAction(id); if (r.ok) setVista({ v: "curso", curso: r.data }); else setError(r.error); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setCargando(false); }
  }
  async function empezarExamen(id: string) {
    setError(null); setCargando(true); setRespuestas({});
    try { const r = await iniciarExamenAction(id); if (r.ok) setVista({ v: "examen", examen: r.data }); else setError(r.error); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setCargando(false); }
  }
  async function enviar(examen: ExamenParaPresentar) {
    if (enviando) return;
    const faltan = examen.preguntas.filter((p) => !respuestas[p.id]).length;
    if (faltan > 0 && !window.confirm(`Te faltan ${faltan} pregunta(s) por responder. ¿Enviar de todas formas?`)) return;
    setEnviando(true); setError(null);
    try {
      const r = await finalizarExamenAction(examen.curso.id, respuestas);
      if (r.ok) { setVista({ v: "resultado", titulo: examen.curso.titulo, res: r.data }); await cargarPanel(); }
      else setError(r.error);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setEnviando(false); }
  }

  /* ── Header con stats ── */
  const header = (
    <div style={{ ...S.card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#eef0fe", color: ACC, display: "grid", placeItems: "center", flexShrink: 0 }}><GraduationCap size={26} /></div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, color: "#9199a8" }}>DUACADEMY</div>
        <h1 style={{ margin: "2px 0 3px", fontSize: 24 }}>Hola, {nombre}</h1>
        <p style={{ margin: 0, color: "#737e90", fontSize: 13.5 }}>Estudia cada curso y presenta su examen.</p>
      </div>
      {stats && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Stat icon={<Award size={16} />} label="Aprobados" valor={`${stats.aprobados}`} />
          <Stat icon={<CheckCircle2 size={16} />} label="Promedio" valor={`${stats.promedio}%`} />
          <Stat icon={<Flame size={16} />} label="Racha" valor={`${stats.racha}`} />
        </div>
      )}
    </div>
  );

  return (
    <div style={S.page}>
      {header}
      {error && <div style={{ margin: "0 0 16px", padding: "11px 15px", borderRadius: 11, fontSize: 13, fontWeight: 600, background: "#fff0f1", color: "#d93142", border: "1px solid #ffd4d2" }}>{error}</div>}

      {vista.v === "panel" && (
        panel === null ? <p style={{ color: "#9199a8", textAlign: "center", padding: 30 }}>Cargando…</p> : (
          <>
            <h2 style={{ fontSize: 14, color: "#4a5168", margin: "4px 2px 12px" }}>Cursos pendientes <span style={{ color: "#9199a8" }}>({panel.pendientes.length})</span></h2>
            {panel.pendientes.length === 0 ? <div style={{ ...S.card, padding: "28px", textAlign: "center", color: "#9199a8" }}>No tienes cursos pendientes. 🎉</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {panel.pendientes.map((c) => (
                  <button key={c.id} onClick={() => abrir(c.id)} disabled={cargando} style={{ ...S.card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", borderLeft: `4px solid ${ACC}` }}>
                    <BookOpen size={20} color={ACC} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15.5 }}>{c.titulo}</div>{c.descripcion && <div style={{ fontSize: 12.5, color: "#737e90", marginTop: 3 }}>{c.descripcion}</div>}<div style={{ fontSize: 11.5, color: "#9199a8", marginTop: 6 }}>{c.numPreguntas} preguntas</div></div>
                    <span style={{ ...S.ghost, pointerEvents: "none" }}>Estudiar →</span>
                  </button>
                ))}
              </div>
            )}

            {panel.realizados.length > 0 && (
              <>
                <h2 style={{ fontSize: 14, color: "#4a5168", margin: "26px 2px 12px" }}>Completados <span style={{ color: "#9199a8" }}>({panel.realizados.length})</span></h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {panel.realizados.map((c) => (
                    <div key={c.id} style={{ ...S.card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderLeft: `4px solid ${c.aprobado ? "#22c55e" : "#f59e0b"}` }}>
                      {c.aprobado ? <CheckCircle2 size={20} color="#16834b" /> : <XCircle size={20} color="#d64545" />}
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.titulo}</div><div style={{ fontSize: 11.5, color: "#9199a8", marginTop: 4 }}>{c.fecha}</div></div>
                      <span style={{ fontWeight: 700, fontSize: 15, color: c.aprobado ? "#16834b" : "#d64545" }}>{c.nota}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )
      )}

      {vista.v === "curso" && (
        <div style={{ ...S.card, padding: "26px 28px" }}>
          <button style={{ ...S.ghost, marginBottom: 16 }} onClick={() => { setVista({ v: "panel" }); setError(null); }}><ArrowLeft size={15} /> Volver</button>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{vista.curso.titulo}</h2>
          {vista.curso.descripcion && <p style={{ margin: "0 0 18px", color: "#737e90", fontSize: 14 }}>{vista.curso.descripcion}</p>}
          <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "#2b3444", whiteSpace: "pre-line", borderTop: "1px solid #eef0f4", paddingTop: 18 }}>
            {vista.curso.contenido || "Este curso no tiene contenido escrito; pasa directo al examen."}
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14 }}>
            {vista.curso.yaPresentado ? <span style={{ color: "#16834b", fontWeight: 650, fontSize: 13.5 }}>Ya presentaste este examen ✓</span> :
              <button style={S.btn} onClick={() => empezarExamen(vista.curso.id)} disabled={cargando}>{cargando ? "Abriendo…" : `Presentar examen (${vista.curso.numPreguntas} preguntas)`}</button>}
          </div>
        </div>
      )}

      {vista.v === "examen" && (
        <div>
          <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>{vista.examen.curso.titulo} — Examen</h2>
          <p style={{ color: "#9199a8", fontSize: 13, margin: "0 0 18px" }}>Responde todas las preguntas y envía.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {vista.examen.preguntas.map((p, idx) => (
              <div key={p.id} style={{ ...S.card, padding: "18px 20px" }}>
                <div style={{ fontWeight: 650, fontSize: 14.5, marginBottom: 12 }}>{idx + 1}. {p.pregunta}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.opciones.map((o) => {
                    const sel = respuestas[p.id] === o.letra;
                    return (
                      <label key={o.letra} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, cursor: "pointer", border: `1px solid ${sel ? ACC : "#e3e6ee"}`, background: sel ? "#eef0fe" : "#fff" }}>
                        <input type="radio" name={p.id} checked={sel} onChange={() => setRespuestas((r) => ({ ...r, [p.id]: o.letra }))} />
                        <span style={{ fontWeight: 700, color: ACC, fontSize: 13 }}>{o.letra}</span>
                        <span style={{ fontSize: 13.5 }}>{o.texto}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
            <button style={S.ghost} onClick={() => { setVista({ v: "panel" }); setError(null); }}><ArrowLeft size={15} /> Cancelar</button>
            <button style={S.btn} onClick={() => enviar(vista.examen)} disabled={enviando}>{enviando ? "Enviando…" : "Enviar examen"}</button>
          </div>
        </div>
      )}

      {vista.v === "resultado" && (
        <div style={{ ...S.card, padding: "34px 28px", textAlign: "center" }}>
          {vista.res.resultado === "APROBADO" ? <CheckCircle2 size={56} color="#16834b" style={{ margin: "0 auto" }} /> : <XCircle size={56} color="#d64545" style={{ margin: "0 auto" }} />}
          <h2 style={{ margin: "14px 0 4px", fontSize: 24, color: vista.res.resultado === "APROBADO" ? "#16834b" : "#d64545" }}>{vista.res.resultado}</h2>
          <p style={{ color: "#737e90", margin: "0 0 10px" }}>{vista.titulo}</p>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{vista.res.porcentaje}%</div>
          <p style={{ color: "#9199a8", fontSize: 13.5 }}>{vista.res.aciertos} de {vista.res.total} correctas</p>
          <button style={{ ...S.btn, margin: "18px auto 0" }} onClick={() => { setVista({ v: "panel" }); setError(null); }}>Volver a mis cursos</button>
        </div>
      )}

      <div style={{ marginTop: 28 }}><Link href="/" style={{ color: ACC, fontWeight: 600, fontSize: 14 }}>← Volver al inicio</Link></div>
    </div>
  );
}

function Stat({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div style={{ border: "1px solid #eceef3", borderRadius: 12, padding: "10px 14px", minWidth: 86, textAlign: "center", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "center", color: ACC, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{valor}</div>
      <div style={{ fontSize: 10.5, color: "#9199a8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}
