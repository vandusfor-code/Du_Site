"use client";

import { useMemo, useRef, useState } from "react";
import {
  Sparkles, History, Plus, FileText, XCircle, ClipboardCheck, ShieldCheck,
  UserRound, Search, SlidersHorizontal, ChevronRight, ChevronLeft,
  Download, Copy, CheckCircle2, FileSpreadsheet, X, AlertCircle, Loader2, Upload, type LucideIcon,
} from "lucide-react";
import { subirArchivoDocumentalAction, obtenerDashboardDocumentalAction } from "./actions";
import type { DashboardDocumental, RegistroDoc, ResultadoImportacionUI } from "./tipos";
import s from "./documental.module.css";

const TABS = ["Análisis", "Respuesta", "Criterios", "Historial"] as const;
type Tab = (typeof TABS)[number];

function StatCard({ Icon, label, value, helper, tone, helperTone }: {
  Icon: LucideIcon; label: string; value: string; helper: string; tone: string; helperTone?: string;
}) {
  return (
    <article className={s.statCard}>
      <div className={`${s.iconBox} ${tone}`}><Icon size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={helperTone}>{helper}</small>
      </div>
    </article>
  );
}

export default function AuditoriaDocumental({
  dashboardInicial,
  errorInicial,
}: {
  dashboardInicial: DashboardDocumental | null;
  errorInicial: string | null;
}) {
  const [data, setData] = useState(dashboardInicial);
  const [error, setError] = useState(errorInicial);
  const [selected, setSelected] = useState<RegistroDoc | null>(null);
  const [tab, setTab] = useState<Tab>("Análisis");
  const [busqueda, setBusqueda] = useState("");
  const [erroresOnly, setErroresOnly] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionUI | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const PAGE = 10;

  const registros = useMemo(() => data?.registros ?? [], [data]);
  const resumen = data?.resumen;

  async function subir(file: File) {
    setSubiendo(true);
    setError(null);
    setResultado(null);
    try {
      const r = await subirArchivoDocumentalAction(construirFormData(file));
      setResultado(r);
      const nuevo = await obtenerDashboardDocumentalAction();
      setData(nuevo);
      setPagina(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return registros.filter((r) => {
      if (erroresOnly && r.errores === 0) return false;
      if (q && !r.asesora.toLowerCase().includes(q) && !r.usuario.toLowerCase().includes(q) && !r.tipoSolicitud.toLowerCase().includes(q) && !r.radicado.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [registros, busqueda, erroresOnly]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE;
  const visibles = filtrados.slice(inicio, inicio + PAGE);

  const sinRegistros = registros.length === 0;

  return (
    <div className={`${s.page} ${selected ? s.withDrawer : ""}`}>
      <input ref={inputRef} type="file" accept=".xls,.xlsx,.html,.htm" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }} />

      <header className={s.top}>
        <div>
          <div className={s.title}><Sparkles size={24} /><h1>Auditoría Documental</h1></div>
          <p>Analiza automáticamente la ortografía, redacción y calidad documental de las gestiones.</p>
        </div>
        <div className={s.topActions}>
          <button className={s.secondary}><History size={16} /> Historial de auditorías</button>
          <button className={s.primary} onClick={() => inputRef.current?.click()} disabled={subiendo}>
            {subiendo ? <Loader2 size={16} className={s.spin} /> : <Plus size={16} />} Nueva auditoría
          </button>
        </div>
      </header>

      {error && <div className={s.banner} style={{ background: "#fff0f1", color: "#d93142", border: "1px solid #ffd4d2", borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>}
      {resultado && (
        <div style={{ background: "#eafaf1", color: "#158a55", border: "1px solid #b7e6cd", borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          Archivo procesado: {resultado.encontrados} encontrados · {resultado.nuevos} nuevos · {resultado.duplicados} duplicados · {resultado.procesados} auditados ({resultado.conErrores} con errores).
        </div>
      )}

      <section className={s.kpis}>
        <StatCard Icon={FileText} tone={s.purple} label="Documentos auditados" value={String(resumen?.documentosAuditados ?? 0)} helper="En el histórico" />
        <StatCard Icon={XCircle} tone={s.red} label="Con errores ortográficos" value={String(resumen?.conErrores ?? 0)} helper={resumen && resumen.documentosAuditados ? `${Math.round((resumen.conErrores / resumen.documentosAuditados) * 100)}% del total` : "—"} helperTone={s.helperRed} />
        <StatCard Icon={ClipboardCheck} tone={s.green} label="Promedio de calidad" value={`${resumen?.promedioCalidad ?? 0}%`} helper="Calidad People" helperTone={s.helperGreen} />
        <StatCard Icon={ShieldCheck} tone={s.blue} label="Sin novedades" value={String(resumen?.sinNovedades ?? 0)} helper={resumen && resumen.documentosAuditados ? `${Math.round((resumen.sinNovedades / resumen.documentosAuditados) * 100)}% del total` : "—"} />
        <StatCard Icon={UserRound} tone={s.amber} label="Asesoras evaluadas" value={String(resumen?.asesorasEvaluadas ?? 0)} helper="En el histórico" />
      </section>

      {subiendo && (
        <section className={s.processing}>
          <div className={s.excel}><FileSpreadsheet size={40} /></div>
          <div className={s.processMain}>
            <h3>Analizando archivo...</h3>
            <p>Validando estructura, leyendo registros y analizando el texto con IA. Esto puede tardar según la cantidad de PQR.</p>
            <div className={s.track}><i style={{ width: "100%", animation: "none", opacity: .5 }} /></div>
          </div>
          <aside className={s.iaPanel}>
            <b><Sparkles size={15} /> Inteligencia artificial</b>
            <p>Revisando ortografía, redacción, claridad y correspondencia de cada gestión.</p>
            {["Ortografía y gramática", "Redacción y estilo", "Claridad y coherencia", "Correspondencia solicitud/respuesta"].map((c) => (
              <span key={c}><CheckCircle2 size={13} className={s.ok} /> {c}</span>
            ))}
          </aside>
        </section>
      )}

      <section className={s.results}>
        <h3>Resultados de la auditoría</h3>

        {sinRegistros && !subiendo ? (
          <div style={{ textAlign: "center", padding: "44px 20px", color: "#97a0b4" }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, background: "#eef0f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><FileSpreadsheet size={26} /></div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#4b5468", margin: "0 0 16px" }}>Aún no hay documentos auditados. Carga el archivo de PQRSF del día.</p>
            <button className={s.primary} onClick={() => inputRef.current?.click()} disabled={subiendo}><Upload size={16} /> Cargar archivo</button>
          </div>
        ) : (
          <>
            <div className={s.filters}>
              <label className={s.search}>
                <Search size={16} />
                <input placeholder="Buscar por asesora, usuario, radicado o tipo..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
              </label>
              <button className={erroresOnly ? s.activeFilter : ""} onClick={() => { setErroresOnly((v) => !v); setPagina(1); }}>
                {erroresOnly ? `Con errores ortográficos · ${resumen?.conErrores ?? 0}` : "Todos los estados"}
              </button>
              <button><SlidersHorizontal size={15} /> Filtros</button>
            </div>

            <table>
              <thead>
                <tr><th>ASESORA</th><th>USUARIO</th><th>TIPO DE SOLICITUD</th><th>FECHA</th><th>PUNTAJE</th><th>ERRORES</th><th>ESTADO</th><th /></tr>
              </thead>
              <tbody>
                {visibles.length > 0 ? visibles.map((r, i) => (
                  <tr key={r.radicado + i} className={selected?.radicado === r.radicado ? s.sel : ""} onClick={() => { setSelected(r); setTab("Análisis"); }}>
                    <td><span className={s.avatar}>{iniciales(r.asesora)}</span><b>{r.asesora}</b></td>
                    <td><b>{r.usuario || "—"}</b></td>
                    <td>{r.tipoSolicitud || "—"}</td>
                    <td>{r.fecha || "—"}</td>
                    <td><em className={s.score}>{r.puntaje}%</em></td>
                    <td><em className={r.errores ? s.err : s.ok}>{r.errores}</em></td>
                    <td>{r.estado === "Sin novedades" ? <em className={s.okBadge}>Sin novedades</em> : <em className={s.review}>Revisar</em>}</td>
                    <td><ChevronRight size={16} className={s.chev} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className={s.emptyRow}>No hay resultados para estos filtros.</td></tr>
                )}
              </tbody>
            </table>

            <div className={s.footer}>
              <span>Mostrando {filtrados.length === 0 ? 0 : inicio + 1} a {inicio + visibles.length} de {filtrados.length} resultados</span>
              <div className={s.pageNums}>
                <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual <= 1}><ChevronLeft size={14} /></button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).slice(0, 8).map((p) => (
                  <button key={p} onClick={() => setPagina(p)} className={p === paginaActual ? s.pageActive : ""}>{p}</button>
                ))}
                <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas}><ChevronRight size={14} /></button>
              </div>
              <span className={s.rowsPP}>Filas por página: 10</span>
            </div>
          </>
        )}
      </section>

      {selected && <Drawer row={selected} tab={tab} setTab={setTab} onClose={() => setSelected(null)} />}
    </div>
  );
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Drawer({ row, tab, setTab, onClose }: { row: RegistroDoc; tab: Tab; setTab: (t: Tab) => void; onClose: () => void }) {
  const c = row.calidad;
  const donutBg = `conic-gradient(#22c55e ${row.puntaje}%, #eef0f4 ${row.puntaje}% 100%)`;
  const esPeople = row.origen === "PEOPLE";
  const criterios: [string, number][] = [
    ["Ortografía", c.ortografia], ["Redacción", c.redaccion], ["Claridad", c.claridad], ["Coherencia", c.coherencia], ["Correspondencia", row.correspondencia],
  ];
  return (
    <aside className={s.drawer}>
      <div className={s.drawerHead}>
        <div>
          <h3>Detalle de auditoría</h3>
          <span className={s.idPill}>{row.radicado}{row.audId ? ` · ${row.audId}` : ""}</span>
        </div>
        <button className={s.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
      </div>

      <div className={s.info}>
        <h4>Información general</h4>
        <div className={s.infoGrid}>
          <div><small>Asesora (radicador)</small><b>{row.asesora}</b></div>
          <div><small>Usuario</small><b>{row.usuario || "—"}</b></div>
          <div className={s.full}><small>Tipo de solicitud</small><b>{row.tipoSolicitud || "—"}</b></div>
          <div><small>Fecha de recibido</small><b>{row.fecha || "—"}</b></div>
          <div><small>Origen de la respuesta</small><b>{row.origen}</b></div>
          <div><small>Puntaje People</small><b className={s.score}>{row.puntaje}%</b></div>
          <div><small>Estado</small><b>{row.estado === "Sin novedades" ? <span className={s.okBadge}>Sin novedades</span> : <span className={s.review}>Revisar</span>}</b></div>
        </div>
      </div>

      <nav className={s.tabs}>
        {TABS.map((t) => <button key={t} className={tab === t ? s.tabActive : ""} onClick={() => setTab(t)}>{t}</button>)}
      </nav>

      <main className={s.drawerBody}>
        {tab === "Análisis" && (
          <>
            {!esPeople && (
              <div className={s.textbox} style={{ marginBottom: 14 }}>
                La respuesta se detectó con origen <b>{row.origen}</b>. Los errores ortográficos no se atribuyen a la calidad de People.
              </div>
            )}
            <h4>Resumen de calidad</h4>
            <div className={s.quality}>
              <div className={s.donut} style={{ background: donutBg }}>
                <div className={s.donutC}><b>{row.puntaje}%</b><small>Calidad general</small></div>
              </div>
              <div className={s.qbars}>
                {criterios.map(([n, v]) => <p key={n}><span>{n}</span><i><b style={{ width: `${v}%` }} /></i><strong>{v}%</strong></p>)}
              </div>
            </div>

            <h4>Errores detectados <span className={s.errCount}>{row.errores}</span></h4>
            <div className={s.errorBox}>
              <b><AlertCircle size={14} /> Ortografía / redacción</b>
              <p className={s.wrong}>{row.erroresDetectados || "Sin errores detectados."}</p>
              {row.explicacion && (<><h5>¿Por qué?</h5><p>{row.explicacion}</p></>)}
            </div>

            {row.respuestaCorregida && (<>
              <h4>Versión corregida de la respuesta</h4>
              <div className={s.corrected}>{row.respuestaCorregida}</div>
            </>)}
          </>
        )}

        {tab === "Respuesta" && (
          <>
            <h4>Solicitud original (usuario)</h4>
            <div className={s.textbox}>{row.solicitudOriginal || "—"}</div>
            <h4>Respuesta ({row.origen})</h4>
            <div className={`${s.textbox} ${row.errores ? s.textboxWrong : ""}`}>{row.respuestaOriginal || "—"}</div>
            <h4>Radicado con falla ortográfica</h4>
            {row.errores > 0 ? (
              <div className={s.radicado}><b>{row.radicado}</b><span>{row.errores} {row.errores === 1 ? "error detectado" : "errores detectados"}</span></div>
            ) : <div className={s.textbox}>Este radicado no presenta fallas ortográficas.</div>}
          </>
        )}

        {tab === "Criterios" && (
          <>
            <h4>Criterios evaluados</h4>
            {criterios.map(([n, v]) => (
              <div className={s.criterioRow} key={n}>
                <span>{n}</span>
                {v >= 90 ? <em className={s.okBadge}>Cumple</em> : <em className={s.review}>Revisar</em>}
              </div>
            ))}
            <div className={s.criterioRow}>
              <span>Correspondencia solicitud/respuesta</span>
              <em className={row.estadoCorrespondencia === "CORRESPONDE" ? s.okBadge : s.review}>{row.estadoCorrespondencia}</em>
            </div>
            {row.hallazgo && <div className={s.textbox} style={{ marginTop: 10 }}>{row.hallazgo}</div>}
          </>
        )}

        {tab === "Historial" && (
          <>
            <h4>Historial de la auditoría</h4>
            <div className={s.histItem}>
              <div className={s.histDot} />
              <div><small>{row.fechaCarga || "—"}</small><p>Auditoría generada por IA e incorporada al histórico.</p></div>
            </div>
            {row.audId && (
              <div className={s.histItem}>
                <div className={s.histDot} />
                <div><small>{row.fechaCarga || "—"}</small><p>Registrada en la importación {row.audId}.</p></div>
              </div>
            )}
          </>
        )}
      </main>

      <div className={s.drawerFooter}>
        <button onClick={() => navigator.clipboard?.writeText(row.respuestaCorregida || row.respuestaOriginal || "")}><Copy size={15} /> Copiar corrección</button>
        <button className={s.primary}><Download size={15} /> Descargar detalle</button>
      </div>
    </aside>
  );
}

function construirFormData(file: File): FormData {
  const fd = new FormData();
  fd.set("archivo", file);
  return fd;
}
