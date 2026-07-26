"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Users, BadgeCheck, AlertTriangle, DollarSign, Download, Search, SlidersHorizontal,
  Eye, Trophy, Target, BarChart3, Medal, ChevronDown, ClipboardCheck,
  LogOut, Loader2, X, Camera,
} from "lucide-react";
import type { DashboardDesempeno, DesempenoFiltros, FilaTabla, CampoDesempeno } from "@/lib/desempeno-tipos";
import { AREAS_ORDEN } from "@/lib/desempeno-tipos";
import { obtenerDashboardDesempenoAction, guardarSnapshotAction } from "./actions";
import s from "./desempeno.module.css";

const AREA_COLOR: Record<string, string> = {
  "Línea amiga / Chat": "#7044ed",
  "G. Empleo": "#2f78ee",
  "Encuestas": "#f6a51c",
  "Radicación": "#2fc777",
  "G. Empleo Cofrem": "#0d9488",
};
const PALETA_FALLBACK = ["#7044ed", "#2f78ee", "#f6a51c", "#2fc777", "#0d9488", "#db2777", "#778196"];

function fmtDecimal(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function sparkPoints(values: number[]): string | null {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rango = max - min;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const norm = rango === 0 ? 0.5 : (v - min) / rango;
      return `${x.toFixed(1)},${(30 - norm * 26).toFixed(1)}`;
    })
    .join(" ");
}

function rangoPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p: (number | "…")[] = [1];
  const desde = Math.max(2, actual - 1);
  const hasta = Math.min(total - 1, actual + 1);
  if (desde > 2) p.push("…");
  for (let i = desde; i <= hasta; i++) p.push(i);
  if (hasta < total - 1) p.push("…");
  p.push(total);
  return p;
}

export default function DesempenoDashboard({
  nombre,
  dashboardInicial,
  errorInicial,
}: {
  nombre: string;
  dashboardInicial: DashboardDesempeno | null;
  errorInicial: string | null;
}) {
  const [data, setData] = useState(dashboardInicial);
  const [error] = useState(errorInicial);
  const [area, setArea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<FilaTabla | null>(null);
  const [snap, setSnap] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const primera = useRef(true);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setPagina(1);
    let vig = true;
    setCargando(true);
    const filtros: DesempenoFiltros = { area: area || undefined, busqueda: busqueda || undefined };
    obtenerDashboardDesempenoAction(filtros)
      .then((r) => vig && setData(r))
      .finally(() => vig && setCargando(false));
    return () => {
      vig = false;
    };
  }, [area, busqueda]);

  async function guardarSnapshot() {
    setGuardando(true);
    setSnap(null);
    try {
      const r = await guardarSnapshotAction();
      setSnap({ tipo: "ok", msg: `Snapshot de ${r.fecha}: ${r.guardados} nuevos, ${r.actualizados} actualizados.` });
    } catch (e) {
      setSnap({ tipo: "error", msg: e instanceof Error ? e.message : "Error al guardar snapshot" });
    } finally {
      setGuardando(false);
    }
  }

  function exportar() {
    if (!data) return;
    const cols = data.tabla.columnas;
    const cab = ["Funcionario", "Área", ...cols.map((c) => data.labels[c] ?? c)];
    const filas = data.tabla.filas.map((f) => [
      f.funcionario,
      f.area,
      ...cols.map((c) => (f.valores[c] ?? "").replace(/;/g, ",")),
    ]);
    const csv = [cab, ...filas].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desempeno${area ? "-" + area.replace(/[^\w]+/g, "-") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const k = data?.kpi;
  const cards = k
    ? [
        { title: "Funcionarios activos", value: String(k.funcionariosActivos), tone: s.violet, Icon: Users, spark: k.sparklines.funcionarios, trend: k.tendencia.funcionarios, unidad: "%", peor: "up" as const },
        { title: "PEC promedio", value: k.pecPromedio === null ? "—" : `${fmtDecimal(k.pecPromedio)}%`, tone: s.green, Icon: BadgeCheck, spark: k.sparklines.pec, trend: k.tendencia.pec, unidad: " pts", peor: "up" as const },
        { title: "PENC promedio", value: k.pencPromedio === null ? "—" : `${fmtDecimal(k.pencPromedio)}%`, tone: s.red, Icon: AlertTriangle, spark: k.sparklines.penc, trend: k.tendencia.penc, unidad: " pts", peor: "down" as const },
        { title: "Bonos generados", value: k.bonosGeneradosLabel, tone: s.blue, Icon: DollarSign, spark: k.sparklines.bonos, trend: k.tendencia.bonos, unidad: "%", peor: "up" as const },
      ]
    : [];

  // Paginación de la tabla.
  const filasTodo = data?.tabla.filas ?? [];
  const totalPaginas = Math.max(1, Math.ceil(filasTodo.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const filasPagina = filasTodo.slice(inicio, inicio + PAGE_SIZE);
  const columnas = data?.tabla.columnas ?? [];

  // Dona: conic-gradient por área.
  const dona = data?.bonificacion.porArea ?? [];
  const tramos: string[] = [];
  dona.reduce((desde, d, i) => {
    const color = AREA_COLOR[d.area] ?? PALETA_FALLBACK[i % PALETA_FALLBACK.length];
    const hasta = desde + d.pct;
    tramos.push(`${color} ${desde}% ${hasta}%`);
    return hasta;
  }, 0);
  const donutBg = tramos.length > 0 ? `conic-gradient(${tramos.join(", ")})` : "#eef0f4";

  return (
    <div className={s.app}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <div className={s.logo}>Du</div>
          <b>Du Labs</b>
        </div>
        <nav className={s.nav}>
          <Link href="/admin" className={s.navItem}><ClipboardCheck size={19} /><span>Auditorías</span></Link>
          <span className={s.navActive}><BarChart3 size={19} /><span>Desempeño</span></span>
        </nav>
        <div className={s.sidebarBottom}>
          <div className={s.profile}>
            <div className={s.avatar}>{nombre.slice(0, 2).toUpperCase()}</div>
            <div><strong>{nombre}</strong><small>Administrador</small></div>
            <ChevronDown size={16} />
          </div>
          <Link href="/" className={s.collapse}><LogOut size={16} /><span>Volver al inicio</span></Link>
        </div>
      </aside>

      <main className={s.main}>
        <header className={s.top}>
          <div>
            <div className={s.title}><BarChart3 size={25} /><h1>Métricas de desempeño</h1></div>
            <p>Monitorea indicadores, cumplimiento y bonificación del equipo.</p>
          </div>
          <div className={s.filters}>
            <button onClick={guardarSnapshot} disabled={guardando} title="Guardar snapshot histórico de hoy">
              {guardando ? <Loader2 size={15} className={s.spin} /> : <Camera size={15} />} Guardar snapshot
            </button>
            <button className={s.primary} onClick={exportar}><Download size={15} />Exportar</button>
          </div>
        </header>

        {error && <div className={`${s.banner} ${s.bannerError}`}>{error}</div>}
        {snap && <div className={`${s.banner} ${snap.tipo === "ok" ? s.bannerOk : s.bannerError}`}>{snap.msg}</div>}
        {data && data.bloquesDesconocidos > 0 && (
          <div className={`${s.banner} ${s.bannerError}`}>
            Hay {data.bloquesDesconocidos} bloque(s) en la hoja TO cuya área no se pudo reconocer. Revisa sus encabezados.
          </div>
        )}

        {/* KPIs */}
        <div className={s.stats}>
          {cards.map((c) => {
            const points = data?.kpi.hayHistorico ? sparkPoints(c.spark) : null;
            const trendOk = c.trend !== null && (c.peor === "up" ? c.trend >= 0 : c.trend <= 0);
            const arrow = c.trend === null ? "" : c.trend > 0 ? "↑" : c.trend < 0 ? "↓" : "→";
            return (
              <article className={s.stat} key={c.title}>
                <div className={`${s.statIcon} ${c.tone}`}><c.Icon size={23} /></div>
                <div className={s.statText}><span>{c.title}</span><strong>{c.value}</strong></div>
                {points ? (
                  <svg className={s.spark} viewBox="0 0 100 32" preserveAspectRatio="none">
                    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  <span />
                )}
                {data?.kpi.hayHistorico && c.trend !== null ? (
                  <div className={`${s.trend} ${trendOk ? s.goodTrend : s.badTrend}`}>
                    <b>{arrow} {fmtDecimal(Math.abs(c.trend))}{c.unidad}</b> vs. período anterior
                  </div>
                ) : (
                  <div className={s.sinHist}>Sin histórico</div>
                )}
              </article>
            );
          })}
        </div>

        {/* Tabs de área */}
        <div className={s.tabs}>
          <button className={area === "" ? s.tabActive : ""} onClick={() => setArea("")}>Todos</button>
          {AREAS_ORDEN.filter((a) => !data || data.areasDisponibles.includes(a)).map((a) => (
            <button key={a} className={area === a ? s.tabActive : ""} onClick={() => setArea(a)}>{a}</button>
          ))}
        </div>

        {/* Paneles */}
        <div className={s.panels}>
          {/* Indicadores */}
          <section className={s.panel}>
            <h2><Target size={18} />Cumplimiento de indicadores</h2>
            <div className={s.selector}>{area || "Todos"} <ChevronDown size={15} /></div>
            <div className={s.indicators}>
              {(data?.indicadores ?? []).map((ind) => (
                <div className={s.indicator} key={ind.nombre}>
                  <span>{ind.nombre}</span>
                  <div><i className={ind.pct < 80 ? s.warn : ""} style={{ width: `${Math.min(ind.pct, 100)}%` }} /></div>
                  <b>{fmtDecimal(ind.pct)}%</b>
                </div>
              ))}
            </div>
          </section>

          {/* Ranking */}
          <section className={s.panel}>
            <h2><Trophy size={18} />Ranking de desempeño</h2>
            <div className={s.rankHead}><span>#</span><span>Funcionario</span><span>PEC</span><span>PENC</span><span>Bonos</span></div>
            {(data?.ranking ?? []).map((r, i) => (
              <div className={s.rankRow} key={r.funcionario + i}>
                <span>{i < 3 ? <Medal size={16} /> : i + 1}</span>
                <b>{r.funcionario}</b>
                <em>{r.pec}</em>
                <em className={s.pencBadge}>{r.penc}</em>
                <strong>{r.bono}</strong>
              </div>
            ))}
            {data && data.ranking.length === 0 && <p className={s.emptyMini}>Sin datos para este filtro.</p>}
          </section>

          {/* Bonificación del equipo */}
          <section className={s.panel}>
            <h2><DollarSign size={18} />Bonificación del equipo</h2>
            <div className={s.bonusTotal}>
              <strong>{data?.bonificacion.totalLabel ?? "—"}</strong>
              <span>en bonos {area ? `· ${area}` : "· total"}</span>
            </div>
            {dona.length > 0 ? (
              <div className={s.bonusBody}>
                <div className={s.donut} style={{ background: donutBg }}>
                  <div className={s.donutCenter}>
                    <strong>{dona.length}</strong>
                    <span>{dona.length === 1 ? "área" : "áreas"}</span>
                  </div>
                </div>
                <div className={s.legend}>
                  {dona.map((d, i) => (
                    <div key={d.area}>
                      <span className={s.legName}>
                        <i className={s.dot} style={{ background: AREA_COLOR[d.area] ?? PALETA_FALLBACK[i % PALETA_FALLBACK.length] }} />
                        <span>{d.area}</span>
                      </span>
                      <b>{d.montoLabel}</b>
                      <em>{fmtDecimal(d.pct)}%</em>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={s.emptyMini}>Sin bonos registrados para este filtro.</p>
            )}
          </section>
        </div>

        {/* Tabla */}
        <section className={`${s.panel} ${s.tablePanel}`}>
          <div className={s.tableTitle}>
            <h2>Desempeño por funcionario {area && `· ${area}`}</h2>
            <div className={s.tools}>
              <label className={s.search}>
                <Search size={15} />
                <input
                  placeholder="Buscar funcionario..."
                  defaultValue={busqueda}
                  onKeyDown={(e) => { if (e.key === "Enter") setBusqueda((e.target as HTMLInputElement).value); }}
                  onBlur={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <button onClick={() => { setArea(""); setBusqueda(""); }}><SlidersHorizontal size={15} />Limpiar</button>
              {cargando && <Loader2 size={15} className={s.spin} />}
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>#</th><th>Funcionario</th><th>Área</th>
                  {columnas.map((c) => <th key={c}>{data?.labels[c] ?? c}</th>)}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.length > 0 ? (
                  filasPagina.map((f, i) => (
                    <tr key={f.usuario + i} className={s.rowClickable} onClick={() => setDetalle(f)}>
                      <td>{inicio + i + 1}</td>
                      <td className={s.name}>{f.funcionario}</td>
                      <td><span className={s.areaBadge}>{f.area}</span></td>
                      {columnas.map((c) => (
                        <td key={c} className={c === "bono" ? s.money : ""}>{f.valores[c] ?? "—"}</td>
                      ))}
                      <td><button className={s.view} onClick={(e) => { e.stopPropagation(); setDetalle(f); }}><Eye size={14} />Ver</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={columnas.length + 4} className={s.emptyRow}>{cargando ? "Cargando…" : "No hay funcionarios para este filtro."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={s.pager}>
            <span>{cargando ? "Actualizando…" : ""}</span>
            <div className={s.pageNums}>
              <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual <= 1}>‹</button>
              {rangoPaginas(paginaActual, totalPaginas).map((p, i) =>
                p === "…" ? <span key={`d${i}`} className={s.pageDots}>…</span> : (
                  <button key={p} onClick={() => setPagina(p)} className={p === paginaActual ? s.pageActive : ""}>{p}</button>
                )
              )}
              <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas}>›</button>
            </div>
            <span className={s.pageInfo}>
              {filasTodo.length > 0 ? `Mostrando ${inicio + 1}-${inicio + filasPagina.length} de ${filasTodo.length}` : ""}
            </span>
          </div>
        </section>
      </main>

      {detalle && data && <DetalleDrawer f={detalle} labels={data.labels} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function DetalleDrawer({ f, labels, onClose }: { f: FilaTabla; labels: Record<string, string>; onClose: () => void }) {
  const orden: CampoDesempeno[] = [
    "pec", "penc", "productividad", "adherencia", "bono", "satisfaccion", "calidadLlamada",
    "precision", "errorRespuesta", "radicadosPct", "snc", "sncRecibidos", "cantidadRadicados",
    "correccion", "sncSolucionados", "pqrsfCreados", "pqrsfDevueltos", "auditorias",
  ];
  const items = orden.filter((c) => f.valores[c] !== undefined);
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={s.drawerHead}>
          <div>
            <small>Funcionario</small>
            <h3>{f.funcionario}</h3>
            <span className={s.badge2}>{f.area}</span>
          </div>
          <button className={s.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className={s.drawerBody}>
          {items.map((c) => (
            <div className={s.detItem} key={c}>
              <span>{labels[c] ?? c}</span>
              <b>{f.valores[c]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
