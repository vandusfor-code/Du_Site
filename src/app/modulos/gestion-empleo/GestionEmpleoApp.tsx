"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Upload, FileText, X, Calendar, Layers, Sigma, Settings, CheckCircle2 } from "lucide-react";
import type { ConfigReglas } from "@/lib/empleo/pila-tipos";
import { VistaResultado, desdeResultado } from "./empleo-vista";
import ResultadoPila from "./ResultadoPila";
import { validarPilaAction, obtenerConfigAction, guardarConfigAction } from "./actions";

const ACC = "#6d28d9";
const S = {
  page: { width: "100%", maxWidth: 1760, margin: "0 auto", padding: "28px 32px 72px", fontFamily: "Inter, system-ui, sans-serif", color: "#1b2233" } as const,
  card: { border: "1px solid #eceef3", borderRadius: 16, background: "#fff", boxShadow: "0 8px 28px rgba(23,30,56,.05)" } as const,
  btn: { height: 44, borderRadius: 10, padding: "0 20px", fontSize: 13.5, fontWeight: 650, cursor: "pointer", border: `1px solid ${ACC}`, background: ACC, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 } as const,
  ghost: { height: 40, borderRadius: 10, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: "1px solid #e3e6ee", background: "#fff", color: "#4a5168", display: "inline-flex", alignItems: "center", gap: 7 } as const,
  input: { width: "100%", height: 44, border: "1px solid #e1e5ee", borderRadius: 10, padding: "0 13px", fontSize: 13.5, outline: "none" } as const,
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#9199a8", display: "block", marginBottom: 7 },
  tab: (on: boolean) => ({ height: 40, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: on ? `1px solid ${ACC}` : "1px solid #e3e6ee", background: on ? "#f1edfd" : "#fff", color: on ? ACC : "#4a5168", display: "inline-flex", alignItems: "center", gap: 7 } as const),
};

type Seccion = "validador" | "config";
type TipoT = "dependiente" | "independiente";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GestionEmpleoApp({ nombre, esSupervision }: { nombre: string; esSupervision: boolean }) {
  const [seccion, setSeccion] = useState<Seccion>("validador");
  const [vista, setVista] = useState<VistaResultado | null>(null);

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100vh", width: "100%", colorScheme: "light" }}>
    <div style={S.page}>
      <div style={{ ...S.card, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "#f1edfd", color: ACC, display: "grid", placeItems: "center", flexShrink: 0 }}><Briefcase size={26} /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: "0 0 2px", fontSize: 24, letterSpacing: -0.4 }}>Gestión de empleo</h1>
          <p style={{ margin: 0, color: "#737e90", fontSize: 13.5 }}>Validación de aportes y requisitos del Subsidio de Desempleo.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        <button style={S.tab(seccion === "validador")} onClick={() => setSeccion("validador")}><Sigma size={15} /> Validador PILA</button>
        {esSupervision && <button style={S.tab(seccion === "config")} onClick={() => { setSeccion("config"); setVista(null); }}><Settings size={15} /> Configuración</button>}
      </div>

      {seccion === "validador" && (
        vista ? <ResultadoPila vista={vista} onNueva={() => setVista(null)} /> : <Validador onResultado={(v) => setVista(v)} />
      )}
      {seccion === "config" && esSupervision && <Configuracion />}

      <div style={{ marginTop: 28 }}><Link href="/" style={{ color: ACC, fontWeight: 600, fontSize: 14 }}>← Volver al inicio</Link></div>
    </div>
    </div>
  );
}

/* ====================== VALIDADOR (3 pasos) ====================== */
function Validador({ onResultado }: { onResultado: (v: VistaResultado) => void }) {
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoT | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function elegir(f: File | null) {
    setError(null);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { setError("El archivo debe ser PDF."); return; }
    if (f.size > 12 * 1024 * 1024) { setError("El PDF supera 12 MB."); return; }
    setArchivo(f);
  }

  async function procesar() {
    if (!tipo || !archivo || procesando) return;
    setProcesando(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("tipo", tipo); fd.append("fechaSolicitud", fecha); fd.append("archivo", archivo);
      const r = await validarPilaAction(fd);
      if (r.ok) onResultado(desdeResultado(r));
      else setError(r.error);
    } catch (e) { setError(e instanceof Error ? e.message : "Error al procesar."); }
    finally { setProcesando(false); }
  }

  const Pasos = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, fontSize: 12.5 }}>
      {[[1, "Tipo de trabajador"], [2, "Cargar reporte"], [3, "Resultado"]].map(([n, t], i) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: paso >= (n as number) ? ACC : "#e9ebf2", color: paso >= (n as number) ? "#fff" : "#9199a8" }}>{n}</span>
          <span style={{ fontWeight: 600, color: paso >= (n as number) ? "#1b2233" : "#9199a8" }}>{t}</span>
          {i < 2 && <span style={{ width: 28, height: 1, background: "#e3e6ee" }} />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18 }}>
      <div style={{ ...S.card, padding: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Nueva validación de aportes</h2>
        <p style={{ margin: "0 0 18px", color: "#737e90", fontSize: 13.5 }}>Analiza el histórico de aportes (PILA) y determina si el usuario cumple con el requisito.</p>
        {Pasos}
        {error && <div style={{ margin: "0 0 14px", padding: "11px 14px", borderRadius: 10, background: "#fff0f1", color: "#d93142", fontSize: 13, border: "1px solid #ffd4d2" }}>{error}</div>}

        {paso === 1 && (
          <>
            <div style={S.label}>Selecciona el tipo de trabajador</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              {([["dependiente", "Dependiente", "Requiere 360 días (12 meses)"], ["independiente", "Independiente", "Requiere 720 días (24 meses)"]] as const).map(([val, tit, sub]) => (
                <button key={val} onClick={() => setTipo(val)} style={{ textAlign: "left", cursor: "pointer", padding: "16px 16px", borderRadius: 12, border: tipo === val ? `2px solid ${ACC}` : "1px solid #e3e6ee", background: tipo === val ? "#f6f3fe" : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Briefcase size={20} color={tipo === val ? ACC : "#9199a8"} />
                    <span style={{ width: 18, height: 18, borderRadius: "50%", border: tipo === val ? `6px solid ${ACC}` : "2px solid #cfd4e0" }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{tit}</div>
                  <div style={{ fontSize: 12, color: "#737e90", marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>Fecha de solicitud</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={S.input} />
              <div style={{ fontSize: 11.5, color: "#9199a8", marginTop: 6 }}>Define la ventana de evaluación de los últimos 3 años.</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={{ ...S.btn, opacity: tipo && fecha ? 1 : 0.5 }} disabled={!tipo || !fecha} onClick={() => setPaso(2)}>Continuar →</button>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Cargar histórico de aportes PILA</h3>
            <p style={{ margin: "0 0 14px", color: "#737e90", fontSize: 13 }}>Adjunta el reporte descargado desde SSuRhipp para analizar los periodos cotizados. El archivo se procesa al momento y no se almacena.</p>
            {!archivo ? (
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); elegir(e.dataTransfer.files?.[0] ?? null); }}
                style={{ display: "block", border: `2px dashed ${drag ? ACC : "#d8dce8"}`, borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: drag ? "#f6f3fe" : "#fbfbfe" }}>
                <input type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
                <div style={{ width: 54, height: 54, borderRadius: 14, background: "#f1edfd", color: ACC, display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Upload size={26} /></div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Arrastra el archivo aquí o haz clic para seleccionarlo</div>
                <div style={{ fontSize: 12, color: "#9199a8", marginTop: 4 }}>Archivo PDF descargado del sistema SSuRhipp · máx. 12 MB</div>
              </label>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: "1px solid #e3e6ee", background: "#fff" }}>
                <FileText size={26} color={ACC} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 650, fontSize: 13.5 }}>{archivo.name}</div>
                  <div style={{ fontSize: 11.5, color: "#9199a8" }}>{(archivo.size / 1024).toFixed(0)} KB · listo para procesar</div>
                </div>
                <button style={{ ...S.ghost, width: 38, padding: 0, justifyContent: "center" }} onClick={() => setArchivo(null)}><X size={16} /></button>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
              <button style={S.ghost} onClick={() => setPaso(1)}>← Atrás</button>
              <button style={{ ...S.btn, opacity: archivo && !procesando ? 1 : 0.5 }} disabled={!archivo || procesando} onClick={procesar}>{procesando ? "Procesando…" : "Procesar documento →"}</button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...S.card, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Calendar size={16} color={ACC} /><b style={{ fontSize: 14 }}>Información del proceso</b></div>
          {[[<Calendar size={16} key="1" />, "Tiempo de evaluación", "Últimos 3 años desde la fecha de solicitud."],
            [<Layers size={16} key="2" />, "Cálculo del requisito", "360 días (dependiente) o 720 días (independiente)."],
            [<Sigma size={16} key="3" />, "Reglas de validación", "Se suman los días por periodo, con un máximo de 30 días."],
            [<FileText size={16} key="4" />, "Aporte en cero", "No se contabiliza en el cálculo."]].map(([ic, t, d], i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: i ? "1px solid #f3f4f8" : "none" }}>
              <span style={{ color: ACC, marginTop: 2 }}>{ic}</span>
              <div><div style={{ fontWeight: 650, fontSize: 13 }}>{t as string}</div><div style={{ fontSize: 12, color: "#737e90" }}>{d as string}</div></div>
            </div>
          ))}
        </div>
        <div style={{ ...S.card, padding: 20, background: "#f6f3fe", borderColor: "#e3dafb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><CheckCircle2 size={16} color={ACC} /><b style={{ fontSize: 14 }}>Resultado que obtendrás</b></div>
          {["Estado de cumplimiento (Cumple / No cumple / Revisión).", "Total de días acreditados.", "Detalle de aportes por periodo.", "Inconsistencias y observaciones.", "Descarga del reporte en PDF."].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: "#4a5168", padding: "4px 0" }}><CheckCircle2 size={15} color={ACC} /> {t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================== CONFIGURACIÓN ====================== */
function Configuracion() {
  const [cfg, setCfg] = useState<ConfigReglas | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { obtenerConfigAction().then(setCfg).catch(() => setCfg(null)); }, []);
  if (!cfg) return <div style={{ ...S.card, padding: 30, textAlign: "center", color: "#9199a8" }}>Cargando…</div>;

  async function guardar() {
    if (!cfg || guardando) return;
    setGuardando(true); setMsg(null);
    try { const r = await guardarConfigAction(cfg); setMsg(r.ok ? { ok: true, t: "Configuración guardada." } : { ok: false, t: r.error ?? "Error" }); }
    finally { setGuardando(false); }
  }
  const campo = (label: string, val: number, set: (n: number) => void) => (
    <div><label style={S.label}>{label}</label><input type="number" value={val} onChange={(e) => set(parseInt(e.target.value, 10) || 0)} style={S.input} /></div>
  );

  return (
    <div style={{ ...S.card, padding: 24, maxWidth: 680 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Parámetros de validación</h3>
      <p style={{ margin: "0 0 18px", color: "#737e90", fontSize: 13 }}>Umbrales operativos (versión {cfg.version}).</p>
      <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fff8ec", color: "#b45309", fontSize: 12.5, border: "1px solid #f5d9a8", marginBottom: 18 }}>
        ⚠ Estos son criterios <b>operativos de esta versión</b>, no normativos. Deben validarse contra el procedimiento oficial de COFREM antes de producción.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {campo("Días requeridos · Dependiente", cfg.diasRequeridos.dependiente, (n) => setCfg({ ...cfg, diasRequeridos: { ...cfg.diasRequeridos, dependiente: n } }))}
        {campo("Días requeridos · Independiente", cfg.diasRequeridos.independiente, (n) => setCfg({ ...cfg, diasRequeridos: { ...cfg.diasRequeridos, independiente: n } }))}
        {campo("Ventana de evaluación (años)", cfg.ventanaAnios, (n) => setCfg({ ...cfg, ventanaAnios: n }))}
        {campo("Máximo de días por periodo", cfg.maxDiasPorPeriodo, (n) => setCfg({ ...cfg, maxDiasPorPeriodo: n }))}
      </div>
      {msg && <div style={{ padding: "10px 13px", borderRadius: 10, fontSize: 13, marginBottom: 12, background: msg.ok ? "#eafaf1" : "#fff0f1", color: msg.ok ? "#16834b" : "#d93142" }}>{msg.t}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={S.btn} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar configuración"}</button></div>
    </div>
  );
}
