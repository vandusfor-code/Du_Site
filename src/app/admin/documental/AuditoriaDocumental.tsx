"use client";

import { useMemo, useState } from "react";
import {
  Sparkles, History, Plus, FileText, XCircle, ClipboardCheck, ShieldCheck,
  UserRound, Search, SlidersHorizontal, ChevronRight, ChevronLeft,
  Download, Copy, CheckCircle2, Circle, FileSpreadsheet, X, AlertCircle, type LucideIcon,
} from "lucide-react";
import { auditorias, resumen, procesando, type AuditoriaDoc } from "./mock";
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

export default function AuditoriaDocumental() {
  const [selected, setSelected] = useState<AuditoriaDoc | null>(auditorias[0]);
  const [tab, setTab] = useState<Tab>("Análisis");
  const [busqueda, setBusqueda] = useState("");
  const [erroresOnly, setErroresOnly] = useState(false);
  const [pagina, setPagina] = useState(1);
  const PAGE = 10;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return auditorias.filter((a) => {
      if (erroresOnly && a.errores === 0) return false;
      if (q && !a.asesora.toLowerCase().includes(q) && !a.usuario.toLowerCase().includes(q) && !a.tipoSolicitud.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [busqueda, erroresOnly]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE;
  const visibles = filtrados.slice(inicio, inicio + PAGE);

  function abrir(a: AuditoriaDoc) {
    setSelected(a);
    setTab("Análisis");
  }

  return (
    <div className={`${s.page} ${selected ? s.withDrawer : ""}`}>
      <header className={s.top}>
        <div>
          <div className={s.title}><Sparkles size={24} /><h1>Auditoría Documental</h1></div>
          <p>Analiza automáticamente la ortografía, redacción y calidad documental de las gestiones.</p>
        </div>
        <div className={s.topActions}>
          <button className={s.secondary}><History size={16} /> Historial de auditorías</button>
          <button className={s.primary}><Plus size={16} /> Nueva auditoría</button>
        </div>
      </header>

      <section className={s.kpis}>
        <StatCard Icon={FileText} tone={s.purple} label="Documentos auditados" value={String(resumen.documentosAuditados)} helper="100% del archivo" />
        <StatCard Icon={XCircle} tone={s.red} label="Con errores ortográficos" value={String(resumen.conErrores)} helper="14,9% del total" helperTone={s.helperRed} />
        <StatCard Icon={ClipboardCheck} tone={s.green} label="Promedio de calidad" value={`${resumen.promedioCalidad}%`} helper="↑ 6,3 pts. vs. última auditoría" helperTone={s.helperGreen} />
        <StatCard Icon={ShieldCheck} tone={s.blue} label="Sin novedades" value={String(resumen.sinNovedades)} helper="85,1% del total" />
        <StatCard Icon={UserRound} tone={s.amber} label="Asesoras evaluadas" value={String(resumen.asesorasEvaluadas)} helper="Activas en el archivo" />
      </section>

      {/* Procesamiento */}
      <section className={s.processing}>
        <div className={s.excel}><FileSpreadsheet size={40} /></div>
        <div className={s.processMain}>
          <h3>Analizando archivo...</h3>
          <p>{procesando.archivo}</p>
          <div className={s.meta}>
            <span>{procesando.procesados} de {procesando.total} documentos procesados</span>
            <b>{procesando.pct}%</b>
          </div>
          <div className={s.track}><i style={{ width: `${procesando.pct}%` }} /></div>
          <div className={s.steps}>
            {procesando.etapas.map((e) => (
              <span key={e.nombre} className={e.estado === "hecho" ? s.done : e.estado === "activo" ? s.active : ""}>
                {e.estado === "hecho" ? <CheckCircle2 size={13} /> : e.estado === "activo" ? "◉" : <Circle size={13} />} {e.nombre}
              </span>
            ))}
          </div>
        </div>
        <aside className={s.iaPanel}>
          <b><Sparkles size={15} /> Inteligencia artificial</b>
          <p>Revisando ortografía, redacción, claridad y calidad documental de cada gestión.</p>
          {procesando.iaChecks.map((c) => (
            <span key={c}><CheckCircle2 size={13} className={s.ok} /> {c}</span>
          ))}
        </aside>
      </section>

      {/* Resultados */}
      <section className={s.results}>
        <h3>Resultados de la auditoría</h3>
        <div className={s.filters}>
          <label className={s.search}>
            <Search size={16} />
            <input placeholder="Buscar por asesora, usuario o tipo de solicitud..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
          </label>
          <select><option>Todas las asesoras</option></select>
          <select><option>Todos los tipos</option></select>
          <button className={erroresOnly ? s.activeFilter : ""} onClick={() => { setErroresOnly((v) => !v); setPagina(1); }}>
            {erroresOnly ? `Con errores ortográficos · ${resumen.conErrores}` : "Todos los estados"}
          </button>
          <button><SlidersHorizontal size={15} /> Filtros</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>ASESORA</th><th>USUARIO</th><th>TIPO DE SOLICITUD</th><th>FECHA</th><th>PUNTAJE</th><th>ERRORES</th><th>ESTADO</th><th />
            </tr>
          </thead>
          <tbody>
            {visibles.length > 0 ? visibles.map((r) => (
              <tr key={r.id} className={selected?.id === r.id ? s.sel : ""} onClick={() => abrir(r)}>
                <td><span className={s.avatar}>{r.initials}</span><b>{r.asesora}</b></td>
                <td><b>{r.usuario}</b></td>
                <td>{r.tipoSolicitud}</td>
                <td>{r.fecha}</td>
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
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPagina(p)} className={p === paginaActual ? s.pageActive : ""}>{p}</button>
            ))}
            <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas}><ChevronRight size={14} /></button>
          </div>
          <span className={s.rowsPP}>Filas por página: <select defaultValue="10"><option>10</option><option>20</option></select></span>
        </div>
      </section>

      {selected && <Drawer row={selected} tab={tab} setTab={setTab} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Drawer({ row, tab, setTab, onClose }: { row: AuditoriaDoc; tab: Tab; setTab: (t: Tab) => void; onClose: () => void }) {
  const c = row.calidad;
  const donutBg = `conic-gradient(#22c55e ${c.general}%, #eef0f4 ${c.general}% 100%)`;
  return (
    <aside className={s.drawer}>
      <div className={s.drawerHead}>
        <div>
          <h3>Detalle de auditoría</h3>
          <span className={s.idPill}>ID Auditoría: {row.auditoriaId}</span>
        </div>
        <button className={s.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
      </div>

      <div className={s.info}>
        <h4>Información general</h4>
        <div className={s.infoGrid}>
          <div><small>Asesora</small><b>{row.asesora}</b></div>
          <div><small>Usuario</small><b>{row.usuario}</b></div>
          <div className={s.full}><small>Tipo de solicitud</small><b>{row.tipoSolicitud}</b></div>
          <div className={s.full}><small>Fecha de gestión</small><b>{row.fecha}</b></div>
          <div><small>Puntaje obtenido</small><b className={s.score}>{row.puntaje}%</b></div>
          <div><small>Estado</small><b>{row.estado === "Sin novedades" ? <span className={s.okBadge}>Sin novedades</span> : <span className={s.review}>Revisar</span>}</b></div>
        </div>
      </div>

      <nav className={s.tabs}>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? s.tabActive : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      <main className={s.drawerBody}>
        {tab === "Análisis" && (
          <>
            <h4>Resumen de calidad</h4>
            <div className={s.quality}>
              <div className={s.donut} style={{ background: donutBg }}>
                <div className={s.donutC}><b>{c.general}%</b><small>Calidad general</small></div>
              </div>
              <div className={s.qbars}>
                {([["Ortografía", c.ortografia], ["Redacción", c.redaccion], ["Claridad", c.claridad], ["Coherencia", c.coherencia], ["Cumplimiento", c.cumplimiento]] as [string, number][]).map(([n, v]) => (
                  <p key={n}><span>{n}</span><i><b style={{ width: `${v}%` }} /></i><strong>{v}%</strong></p>
                ))}
              </div>
            </div>

            <h4>Errores detectados <span className={s.errCount}>{row.erroresList.length}</span></h4>
            {row.erroresList.length > 0 ? row.erroresList.map((e, i) => (
              <div className={s.errorBox} key={i} style={{ marginBottom: 10 }}>
                <b><AlertCircle size={14} /> {e.categoria}</b>
                <p className={s.wrong}>{e.original}</p>
                <h5>Corrección sugerida</h5>
                <p className={s.correct}>{e.corregido}</p>
                <h5>¿Por qué se corrigió?</h5>
                <p>{e.explicacion}</p>
              </div>
            )) : <div className={s.textbox}>Sin errores ortográficos en esta gestión.</div>}

            <h4>Versión corregida de la respuesta</h4>
            <div className={s.corrected}>{row.respuestaCorregida}</div>
          </>
        )}

        {tab === "Respuesta" && (
          <>
            <h4>Solicitud original</h4>
            <div className={s.textbox}>{row.solicitudOriginal}</div>
            <h4>Respuesta de la asesora</h4>
            <div className={`${s.textbox} ${row.errores ? s.textboxWrong : ""}`}>{row.respuestaOriginal}</div>
            <h4>Radicados con falla ortográfica</h4>
            {row.radicadosFalla.length > 0 ? row.radicadosFalla.map((r) => (
              <div className={s.radicado} key={r.radicado} style={{ marginBottom: 8 }}>
                <b>{r.radicado}</b>
                <span>{r.errores} {r.errores === 1 ? "error detectado" : "errores detectados"}</span>
              </div>
            )) : <div className={s.textbox}>Ningún radicado con falla ortográfica.</div>}
          </>
        )}

        {tab === "Criterios" && (
          <>
            <h4>Criterios evaluados</h4>
            {row.criterios.map((cr) => (
              <div className={s.criterioRow} key={cr.nombre}>
                <span>{cr.nombre}</span>
                {cr.resultado === "Cumple" ? <em className={s.okBadge}>Cumple</em> : <em className={s.review}>Revisar</em>}
              </div>
            ))}
          </>
        )}

        {tab === "Historial" && (
          <>
            <h4>Historial de la auditoría</h4>
            {row.historial.map((h, i) => (
              <div className={s.histItem} key={i}>
                <div className={s.histDot} />
                <div><small>{h.fecha}</small><p>{h.evento}</p></div>
              </div>
            ))}
          </>
        )}
      </main>

      <div className={s.drawerFooter}>
        <button><Copy size={15} /> Copiar corrección</button>
        <button className={s.primary}><Download size={15} /> Descargar detalle</button>
      </div>
    </aside>
  );
}
