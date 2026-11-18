"use client";

import { useState, type CSSProperties } from "react";
import { ClipboardCheck, Mail, Clock, CircleCheck, TriangleAlert, Loader2 } from "lucide-react";
import CalidadSidebar from "./CalidadSidebar";
import { obtenerSeguimientoAction } from "./seguimiento-actions";
import type { FilaSeguimiento, KpisSeguimiento, EstadoSeguimiento } from "@/lib/seguimiento-resumen";

const TEMA: CSSProperties = {
  "--cal-bg": "#f7f8fc", "--cal-surface": "#ffffff", "--cal-border": "#e5e7ef",
  "--cal-text-strong": "#0f1022", "--cal-muted": "#68738c", "--cal-accent": "#7044ed",
  "--cal-accent-soft": "#f1ecff",
} as CSSProperties;

const ESTADO_LABEL: Record<EstadoSeguimiento, string> = {
  PENDIENTE_NOTIF: "Pendiente de notificar",
  NOTIFICADA: "Pendiente de firma",
  FIRMADA: "Firmada",
};

function badge(fila: FilaSeguimiento) {
  if (fila.estado === "FIRMADA") return { bg: "#ecfdf5", color: "#047857", txt: "Firmada" };
  if (fila.vencida) return { bg: "#fff1f2", color: "#be123c", txt: "Vencida sin firma" };
  if (fila.estado === "NOTIFICADA") return { bg: "#fffbeb", color: "#b45309", txt: "Pendiente de firma" };
  return { bg: "#f1f5f9", color: "#475569", txt: "Pendiente de notificar" };
}

export default function SeguimientoResumen({
  kpisIniciales, filasIniciales, nombreUsuario, rolUsuario,
}: {
  kpisIniciales: KpisSeguimiento;
  filasIniciales: FilaSeguimiento[];
  nombreUsuario: string;
  rolUsuario?: string;
}) {
  const [kpis, setKpis] = useState(kpisIniciales);
  const [filas, setFilas] = useState(filasIniciales);
  const [cargando, setCargando] = useState(false);
  const [fFecha, setFFecha] = useState("");
  const [fAsesora, setFAsesora] = useState("");
  const [fEstado, setFEstado] = useState<EstadoSeguimiento | "">("");
  const [fVencidas, setFVencidas] = useState(false);

  async function aplicar() {
    setCargando(true);
    try {
      const r = await obtenerSeguimientoAction({ fecha: fFecha || undefined, asesora: fAsesora || undefined, estado: fEstado || undefined, soloVencidas: fVencidas });
      setKpis(r.kpis); setFilas(r.filas);
    } finally { setCargando(false); }
  }
  function limpiar() { setFFecha(""); setFAsesora(""); setFEstado(""); setFVencidas(false); setTimeout(aplicar, 0); }

  const card = (icon: React.ReactNode, n: number, titulo: string, sub: string, color: string) => (
    <div style={{ background: "var(--cal-surface)", border: "1px solid var(--cal-border)", borderRadius: 16, padding: "16px 18px", flex: "1 1 180px", minWidth: 170 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, fontSize: 13, fontWeight: 600 }}>{icon}{titulo}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--cal-text-strong)", margin: "6px 0 2px" }}>{n}</div>
      <div style={{ fontSize: 12, color: "var(--cal-muted)" }}>{sub}</div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ ...TEMA, background: "var(--cal-bg)" }}>
      <CalidadSidebar nombre={nombreUsuario} rol={rolUsuario} />
      <main className="ml-[228px] max-w-[1700px] px-[30px] pt-5 pb-7">
        <header className="mb-4 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl" style={{ background: "var(--cal-accent-soft)", color: "var(--cal-accent)" }}>
            <ClipboardCheck size={19} />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: "var(--cal-text-strong)" }}>Calidad</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--cal-muted)" }}>Seguimiento consolidado por asesora (una firma por día).</p>
          </div>
        </header>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          {card(<Mail size={16} />, kpis.notificadas, "Notificadas", "Asesoras con resumen del día", "#7044ed")}
          {card(<Clock size={16} />, kpis.pendientesFirma, "Pendientes de firma", "Aún no firman", "#b45309")}
          {card(<TriangleAlert size={16} />, kpis.vencidas, "Vencidas sin firma", `Más de 2 días sin firmar`, "#be123c")}
          {card(<CircleCheck size={16} />, kpis.firmadas, "Firmadas", "Acuse + compromiso listos", "#047857")}
        </div>

        {/* Filtros */}
        <div style={{ background: "var(--cal-surface)", border: "1px solid var(--cal-border)", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-muted)" }}>Fecha
            <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--cal-border)" }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-muted)" }}>Asesora
            <input value={fAsesora} onChange={(e) => setFAsesora(e.target.value)} placeholder="Nombre o código" style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--cal-border)", minWidth: 180 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-muted)" }}>Estado
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value as EstadoSeguimiento | "")} style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--cal-border)" }}>
              <option value="">Todos</option>
              <option value="NOTIFICADA">Pendiente de firma</option>
              <option value="FIRMADA">Firmada</option>
            </select>
          </label>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, color: "var(--cal-text-strong)" }}>
            <input type="checkbox" checked={fVencidas} onChange={(e) => setFVencidas(e.target.checked)} /> Solo vencidas
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={limpiar} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--cal-border)", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Limpiar</button>
            <button onClick={aplicar} disabled={cargando} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "var(--cal-accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {cargando ? <Loader2 size={14} className="animate-spin" /> : null} Aplicar filtros
            </button>
          </div>
        </div>

        {/* Tabla consolidada */}
        <div style={{ background: "var(--cal-surface)", border: "1px solid var(--cal-border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#fafbfe", color: "var(--cal-muted)", textAlign: "left" }}>
                  {["ASESORA", "FECHA", "# AUDITORÍAS", "CALIDAD PROM.", "ESTADO", "DÍAS SIN FIRMAR", "COMPROMISO"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", fontSize: 11, fontWeight: 700, letterSpacing: ".3px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--cal-muted)" }}>Sin resultados para estos filtros.</td></tr>
                ) : filas.map((f) => {
                  const b = badge(f);
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid var(--cal-border)" }}>
                      <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--cal-text-strong)" }}>{f.nombre}</td>
                      <td style={{ padding: "11px 14px", color: "var(--cal-muted)" }}>{f.fecha}</td>
                      <td style={{ padding: "11px 14px" }}>{f.numAuditorias}</td>
                      <td style={{ padding: "11px 14px", fontWeight: 700 }}>{f.promedio}%</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ background: b.bg, color: b.color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{b.txt}</span>
                      </td>
                      <td style={{ padding: "11px 14px", color: f.vencida ? "#be123c" : "var(--cal-muted)", fontWeight: f.vencida ? 700 : 400 }}>{f.estado === "NOTIFICADA" ? `${f.diasSinFirmar} día(s)` : "—"}</td>
                      <td style={{ padding: "11px 14px", color: "var(--cal-muted)", maxWidth: 320 }}>{f.compromiso || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--cal-muted)", marginTop: 10 }}>{filas.length} asesora(s) · una fila por asesora/día.</p>
      </main>
    </div>
  );
}
