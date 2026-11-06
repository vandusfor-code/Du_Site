"use client";

import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Download, RotateCcw, ChevronDown, ChevronRight, CalendarDays, Layers, Target, FileText } from "lucide-react";
import { ETIQUETA_NOVEDAD } from "@/lib/empleo/pila-tipos";
import { MONEDA, fmtPeriodo, type VistaResultado } from "./empleo-vista";
import { generarInformePdf } from "./generar-pdf";

const ACC = "#6d28d9";
const S = {
  card: { border: "1px solid #eceef3", borderRadius: 16, background: "#fff", boxShadow: "0 8px 28px rgba(23,30,56,.05)" } as const,
  btn: { height: 42, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: `1px solid ${ACC}`, background: ACC, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8 } as const,
  ghost: { height: 40, borderRadius: 10, padding: "0 14px", fontSize: 13, fontWeight: 650, cursor: "pointer", border: "1px solid #e3e6ee", background: "#fff", color: "#4a5168", display: "inline-flex", alignItems: "center", gap: 7 } as const,
  label: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4, color: "#9199a8" },
  th: { padding: "9px 8px", textAlign: "left" as const, fontSize: 10.5, textTransform: "uppercase" as const, letterSpacing: 0.3, color: "#9199a8", fontWeight: 700 },
  td: { padding: "9px 8px", fontSize: 12.5, borderTop: "1px solid #eef0f4" },
};

const POR_PAGINA = 8;

function tema(estado: string) {
  if (estado === "CUMPLE") return { color: "#16834b", bg: "#eafaf1", bd: "#b7e6cd", Icon: CheckCircle2, texto: "CUMPLE" };
  if (estado === "NO_CUMPLE") return { color: "#d64545", bg: "#fff0f1", bd: "#ffd4d2", Icon: XCircle, texto: "NO CUMPLE" };
  return { color: "#b45309", bg: "#fff8ec", bd: "#f5d9a8", Icon: AlertTriangle, texto: "REQUIERE REVISIÓN" };
}

export default function ResultadoPila({
  vista, onNueva, onGuardarObservacion,
}: {
  vista: VistaResultado;
  onNueva: () => void;
  onGuardarObservacion?: (texto: string) => Promise<void>;
}) {
  const t = tema(vista.estado);
  const [pagina, setPagina] = useState(1);
  const [empresa, setEmpresa] = useState<string>("todas");
  const [verExcluidos, setVerExcluidos] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [obs, setObs] = useState(vista.observacionAsesor);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const empresas = useMemo(() => Array.from(new Set(vista.resumenPorPeriodo.flatMap((p) => p.nits))).sort(), [vista]);
  const filtrados = useMemo(() => {
    return vista.resumenPorPeriodo.filter((p) => {
      if (!verExcluidos && p.estado === "excluido") return false;
      if (empresa !== "todas" && !p.nits.includes(empresa)) return false;
      return true;
    });
  }, [vista, empresa, verExcluidos]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  async function guardar() {
    if (!onGuardarObservacion || guardando) return;
    setGuardando(true); setGuardado(false);
    try { await onGuardarObservacion(obs); setGuardado(true); } finally { setGuardando(false); }
  }

  const indicadores = [
    { icon: <Target size={18} />, label: "Días requeridos", valor: vista.diasRequeridos, color: "#6b7280" },
    { icon: <Layers size={18} />, label: "Días acreditados", valor: vista.diasAcreditados, color: t.color },
    { icon: <CheckCircle2 size={18} />, label: vista.diasDiferencia >= 0 ? "Días de excedente" : "Días faltantes", valor: Math.abs(vista.diasDiferencia), color: vista.diasDiferencia >= 0 ? "#16834b" : "#d64545" },
    { icon: <CalendarDays size={18} />, label: "Periodos con aporte", valor: vista.periodosConAporte, color: ACC },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Breadcrumb + acciones */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 12, color: "#9199a8" }}>Gestión de empleo <span style={{ margin: "0 6px" }}>›</span> Validador PILA <span style={{ margin: "0 6px" }}>›</span> <b style={{ color: "#4a5168" }}>Resultado</b></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.ghost} onClick={onNueva}><RotateCcw size={15} /> Nueva validación</button>
          <button style={S.btn} onClick={() => generarInformePdf(vista)}><Download size={15} /> Descargar PDF</button>
        </div>
      </div>

      {vista.advertenciasLectura.length > 0 && (
        <div style={{ padding: "11px 15px", borderRadius: 11, fontSize: 13, background: "#fff8ec", color: "#b45309", border: "1px solid #f5d9a8" }}>
          {vista.advertenciasLectura.map((a, i) => <div key={i}>⚠ {a}</div>)}
        </div>
      )}

      {/* A. Estado + B. indicadores */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div style={{ ...S.card, padding: 22, display: "flex", alignItems: "center", gap: 18, background: t.bg, borderColor: t.bd }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: t.color, flexShrink: 0 }}><t.Icon size={34} /></div>
          <div>
            <div style={{ ...S.label, color: t.color }}>Resultado de la validación</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: t.color, lineHeight: 1.1, margin: "2px 0 6px" }}>{t.texto}</div>
            <div style={{ fontSize: 13, color: "#4a5168" }}>{vista.motivo}</div>
          </div>
        </div>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Información de la validación</div>
          <InfoRow k="Trabajador" v={vista.trabajadorNombre} />
          <InfoRow k="Documento" v={vista.trabajadorDocumento} />
          <InfoRow k="Tipo" v={vista.tipoTrabajador === "dependiente" ? "Dependiente" : "Independiente"} />
          <InfoRow k="Fecha de solicitud" v={vista.fechaSolicitud} />
          <InfoRow k="Periodo evaluado" v={`${vista.ventana.desde} a ${vista.ventana.hasta}`} />
          <InfoRow k="Asesor" v={vista.asesorNombre} />
          <InfoRow k="Archivo" v={vista.archivoNombre} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {indicadores.map((ind, i) => (
          <div key={i} style={{ ...S.card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: ind.color }}>{ind.icon}<span style={{ ...S.label }}>{ind.label}</span></div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: "#1b2233" }}>{ind.valor}</div>
          </div>
        ))}
      </div>

      {/* D. Detalle por periodo */}
      <div style={{ ...S.card, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Detalle de aportes por periodo</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={empresa} onChange={(e) => { setEmpresa(e.target.value); setPagina(1); }} style={{ height: 36, borderRadius: 8, border: "1px solid #e3e6ee", padding: "0 10px", fontSize: 12.5 }}>
              <option value="todas">Todas las empresas</option>
              {empresas.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label style={{ fontSize: 12.5, color: "#4a5168", display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={verExcluidos} onChange={(e) => { setVerExcluidos(e.target.checked); setPagina(1); }} /> Ver excluidos
            </label>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...S.th, width: 28 }}></th>
              <th style={S.th}>Periodo</th><th style={S.th}>Empresa (NIT)</th><th style={S.th}>Reg.</th>
              <th style={S.th}>Días rep.</th><th style={S.th}>Días válidos</th><th style={S.th}>Aporte total</th>
              <th style={S.th}>Novedades</th><th style={S.th}>Estado</th>
            </tr></thead>
            <tbody>
              {visibles.length === 0 ? <tr><td colSpan={9} style={{ ...S.td, textAlign: "center", color: "#9199a8", padding: 22 }}>Sin periodos para este filtro.</td></tr> :
                visibles.map((p) => {
                  const abierto = expandido === p.periodo;
                  return (
                    <Fragment key={p.periodo}>
                      <tr style={{ cursor: "pointer" }} onClick={() => setExpandido(abierto ? null : p.periodo)}>
                        <td style={S.td}>{abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{fmtPeriodo(p.periodo)}<div style={{ fontSize: 10, color: "#9199a8" }}>{p.periodo}</div></td>
                        <td style={S.td}>{p.nits.join(", ")}</td>
                        <td style={S.td}>{p.registros}</td>
                        <td style={S.td}>{p.diasReportados}{p.excedeLimite && <span title="Excede el tope mensual" style={{ color: "#b45309" }}> ⚠</span>}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{p.diasReconocidos}</td>
                        <td style={S.td}>{MONEDA.format(p.aporteAcumulado)}</td>
                        <td style={{ ...S.td, fontSize: 11.5, color: "#737e90" }}>{p.novedades.length ? p.novedades.map((n) => ETIQUETA_NOVEDAD[n]).join(", ") : "—"}</td>
                        <td style={S.td}><Estado estado={p.estado} fuera={p.fueraDeVentana} /></td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td colSpan={9} style={{ background: "#fbfbfe", padding: "6px 12px 12px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                              <thead><tr>{["Fila", "NIT", "Fecha pago", "Aporte", "Días Cot", "IBC", "# planilla", "Estado"].map((h) => <th key={h} style={{ ...S.th, fontSize: 9.5, padding: "6px 6px" }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {p.detalle.map((d) => (
                                  <tr key={d.fila}>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.fila}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.nit}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.fechaPago}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{MONEDA.format(d.aporte)}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.diasCot}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.ibc != null ? MONEDA.format(d.ibc) : "—"}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.planilla ?? "—"}</td>
                                    <td style={{ ...S.td, padding: "6px 6px" }}>{d.aporte <= 0 ? <span style={{ color: "#d64545" }}>Excluido (aporte $0)</span> : <span style={{ color: "#16834b" }}>Contabilizado</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 12, color: "#9199a8" }}>Mostrando {visibles.length} de {filtrados.length} periodos</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={{ ...S.ghost, height: 32 }} disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>←</button>
            <span style={{ fontSize: 12.5, fontWeight: 650 }}>{pag} / {totalPaginas}</span>
            <button style={{ ...S.ghost, height: 32 }} disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)}>→</button>
          </div>
        </div>
      </div>

      {/* E. Resumen + F. Observaciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Resumen del análisis</div>
          <ResRow k="Total de registros leídos" v={vista.analisis.registrosLeidos} />
          <ResRow k="Registros con aporte" v={vista.analisis.registrosConAporte} />
          <ResRow k="Registros con aporte $0" v={vista.analisis.registrosAporteCero} />
          <ResRow k="Registros fuera de la ventana" v={vista.analisis.registrosFueraVentana} />
          <ResRow k="Sospechosos de duplicidad" v={vista.analisis.registrosSospechososDuplicado} />
          <ResRow k="Días acreditados" v={vista.diasAcreditados} />
          <ResRow k="Días requeridos" v={vista.diasRequeridos} />
          <div style={{ borderTop: "1px solid #eef0f4", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <b style={{ fontSize: 13 }}>Resultado</b><Estado estado={vista.estado === "CUMPLE" ? "contabilizado" : "x"} textoForzado={t.texto} color={t.color} />
          </div>
        </div>
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><FileText size={16} color={ACC} /><div style={S.label}>Observaciones para el asesor</div></div>
          <div style={{ fontSize: 12.5, color: "#4a5168", background: "#f7f7fc", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <b style={{ color: ACC }}>Automática:</b> {vista.observacionAuto}
          </div>
          {vista.inconsistencias.filter((i) => i.nivel !== "info").length > 0 && (
            <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: "#b45309" }}>
              {vista.inconsistencias.filter((i) => i.nivel !== "info").slice(0, 6).map((i, k) => <li key={k}>{i.mensaje}</li>)}
            </ul>
          )}
          {onGuardarObservacion ? (
            <>
              <div style={S.label}>Observación del asesor (manual)</div>
              <textarea value={obs} onChange={(e) => { setObs(e.target.value); setGuardado(false); }} rows={3} placeholder="Agrega una nota sobre esta validación…"
                style={{ width: "100%", border: "1px solid #e1e5ee", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginTop: 6, resize: "vertical" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, alignItems: "center" }}>
                {guardado && <span style={{ color: "#16834b", fontSize: 12.5 }}>Guardada ✓</span>}
                <button style={S.btn} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar observación"}</button>
              </div>
            </>
          ) : vista.observacionAsesor ? (
            <div style={{ fontSize: 12.5 }}><b>Del asesor:</b> {vista.observacionAsesor}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 12.5 }}><span style={{ color: "#9199a8" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div>;
}
function ResRow({ k, v }: { k: string; v: number }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, borderTop: "1px solid #f3f4f8" }}><span style={{ color: "#737e90" }}>{k}</span><b>{v}</b></div>;
}
function Estado({ estado, fuera, textoForzado, color }: { estado: string; fuera?: boolean; textoForzado?: string; color?: string }) {
  if (textoForzado) return <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#eef0fe", color: color ?? ACC }}>{textoForzado}</span>;
  const exc = estado === "excluido";
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: exc ? "#f0f2f6" : "#eafaf1", color: exc ? "#6b7589" : "#16834b" }}>{fuera ? "Fuera de ventana" : exc ? "Excluido" : "Contabilizado"}</span>;
}
