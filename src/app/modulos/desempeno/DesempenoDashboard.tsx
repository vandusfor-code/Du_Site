"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BadgeCheck, AlertTriangle, DollarSign, Download, Search, SlidersHorizontal,
  Eye, Trophy, Target, BarChart3, Medal, ChevronDown, ClipboardCheck,
  LogOut, Loader2, X, CalendarCheck, Save, RefreshCw,
} from "lucide-react";

import type { DashboardDesempeno, FilaTabla, CampoDesempeno, Area } from "@/lib/desempeno-tipos";
import { AREAS_ORDEN, CAMPOS_PORCENTAJE, esCampoAutomatico } from "@/lib/desempeno-tipos";
import { camposEditablesDe } from "@/lib/desempeno-bono";
import { obtenerDashboardTodasAreasAction, cerrarMesAction, guardarMetricasAction, borrarMetricasAction, sincronizarAutomaticasAction } from "./actions";
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

// Normaliza para la búsqueda en el navegador (sin tildes, minúsculas).
function normClient(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
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
  esAdmin,
  dashboardInicial,
  errorInicial,
}: {
  nombre: string;
  esAdmin: boolean;
  dashboardInicial: DashboardDesempeno | null;
  errorInicial: string | null;
}) {
  // Todas las vistas de área del mes, en memoria. "" = Todos. El primer render ya
  // trae la vista "Todos" del servidor (SSR); el resto llega con el efecto.
  const [vistas, setVistas] = useState<Record<string, DashboardDesempeno>>(
    dashboardInicial ? { "": dashboardInicial } : {}
  );
  const [error] = useState(errorInicial);
  const [area, setArea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [mes, setMes] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<FilaTabla | null>(null);
  const [snap, setSnap] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const PAGE_SIZE = 10;

  // Vista del área seleccionada. Mientras cargan todas, cae a "Todos" / al inicial.
  const data = vistas[area] ?? vistas[""] ?? dashboardInicial;

  // Recarga TODAS las áreas del mes en una sola llamada (tras guardar/cerrar/
  // sincronizar o al cambiar de mes). Cambiar de pestaña o buscar NO llama aquí.
  async function recargar(mesSel: string = mes) {
    setCargando(true);
    try {
      const r = await obtenerDashboardTodasAreasAction(mesSel || undefined);
      setVistas(r.vistas);
    } finally {
      setCargando(false);
    }
  }

  // Solo el MES va al servidor (incluido el primer render, para poblar todas las
  // pestañas). Área y búsqueda se resuelven en el navegador, al instante.
  useEffect(() => {
    let vig = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const r = await obtenerDashboardTodasAreasAction(mes || undefined);
        if (vig) setVistas(r.vistas);
      } finally {
        if (vig) setCargando(false);
      }
    };
    cargar();
    return () => {
      vig = false;
    };
  }, [mes]);

  // Cambiar de pestaña o buscar es instantáneo (en el navegador) y vuelve a la
  // página 1. No se llama al servidor.
  function cambiarArea(a: string) {
    setArea(a);
    setPagina(1);
  }
  function cambiarBusqueda(v: string) {
    setBusqueda(v);
    setPagina(1);
  }

  async function confirmarCierre() {
    setGuardando(true);
    setSnap(null);
    try {
      const r = await cerrarMesAction();
      setCierreOpen(false);
      const sig = data?.mesActivoSiguiente ? ` Ahora el mes activo es ${data.mesActivoSiguiente} (automático).` : "";
      setSnap({ tipo: "ok", msg: `¡Perfecto! Mes de ${r.mesLabel} cerrado. 🎉 Ya puedes avisarles a las asesoras que pueden ver su bono en su inicio.${sig}` });
      setMes("");
      await recargar("");
    } catch (e) {
      setSnap({ tipo: "error", msg: e instanceof Error ? e.message : "Error al cerrar el mes" });
    } finally {
      setGuardando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    setSnap(null);
    try {
      const r = await sincronizarAutomaticasAction();
      setSnap({
        tipo: "ok",
        msg: r.actualizados > 0
          ? `Automáticas actualizadas (auditorías y radicaciones): ${r.actualizados} celdas.`
          : "Automáticas al día — no hubo cambios este mes.",
      });
      await recargar();
    } catch (e) {
      setSnap({ tipo: "error", msg: e instanceof Error ? e.message : "Error al sincronizar" });
    } finally {
      setSincronizando(false);
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

  // Paginación de la tabla. La BÚSQUEDA filtra en el navegador (instantánea).
  const nb = normClient(busqueda);
  const filasTodo = (data?.tabla.filas ?? []).filter(
    (f) => !nb || normClient(f.funcionario).includes(nb) || normClient(f.usuario).includes(nb)
  );
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
          <b>Du Site</b>
        </div>
        <nav className={s.nav}>
          <Link href="/admin" className={s.navItem}><ClipboardCheck size={19} /><span>Auditorías</span></Link>
          <span className={s.navActive}><BarChart3 size={19} /><span>Bonos</span></span>
        </nav>
        <div className={s.sidebarBottom}>
          <div className={s.profile}>
            <div className={s.avatar}>{nombre.slice(0, 2).toUpperCase()}</div>
            <div><strong>{nombre}</strong><small>{esAdmin ? "Administrador" : "Coordinadora"}</small></div>
            <ChevronDown size={16} />
          </div>
          <Link href="/" className={s.collapse}><LogOut size={16} /><span>Volver al inicio</span></Link>
        </div>
      </aside>

      <main className={s.main}>
        <header className={s.top}>
          <div>
            <div className={s.title}><BarChart3 size={25} /><h1>Bonos</h1></div>
            <p>Captura métricas, cumplimiento y bonificación del equipo · <b>{data?.mesActualLabel ?? "Mes en curso"}</b></p>
          </div>
          <div className={s.filters}>
            <select className={s.select} value={mes} onChange={(e) => { setMes(e.target.value); setPagina(1); }} title="Período">
              {(data?.mesesDisponibles ?? [{ value: "", label: "Mes en curso" }]).map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button onClick={sincronizar} disabled={sincronizando || data?.esHistorico} title="Traer automáticas del mes en curso: PEC/PENC/#auditorías desde las auditorías y radicados/SNC desde Radicaciones">
              {sincronizando ? <Loader2 size={15} className={s.spin} /> : <RefreshCw size={15} />} Sincronizar
            </button>
            <button onClick={() => setCierreOpen(true)} disabled={guardando || data?.esHistorico} title="Cerrar un mes: lo archiva y reinicia las métricas">
              <CalendarCheck size={15} /> Cerrar mes
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
          <button className={area === "" ? s.tabActive : ""} onClick={() => cambiarArea("")}>Todos</button>
          {AREAS_ORDEN.filter((a) => !data || data.areasDisponibles.includes(a)).map((a) => (
            <button key={a} className={area === a ? s.tabActive : ""} onClick={() => cambiarArea(a)}>{a}</button>
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
                  onKeyDown={(e) => { if (e.key === "Enter") cambiarBusqueda((e.target as HTMLInputElement).value); }}
                  onBlur={(e) => cambiarBusqueda(e.target.value)}
                />
              </label>
              <button onClick={() => { setArea(""); cambiarBusqueda(""); }}><SlidersHorizontal size={15} />Limpiar</button>
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

      {detalle && data && (
        <EditarDrawer
          f={detalle}
          labels={data.labels}
          editable={!data.esHistorico}
          onClose={() => setDetalle(null)}
          onSaved={async () => { setDetalle(null); await recargar(); }}
        />
      )}

      {cierreOpen && (
        <div className={s.overlay} onClick={() => { if (!guardando) setCierreOpen(false); }}>
          <div className={s.cierreModal} onClick={(e) => e.stopPropagation()}>
            <h3><CalendarCheck size={18} /> Cerrar mes</h3>
            <p>
              Vas a cerrar <b>{data?.mesActivoNombre || "el mes activo"}</b>
              {data?.mesActivoSiguiente ? <> y pasar a <b>{data.mesActivoSiguiente}</b></> : null}.
            </p>
            <p className={s.cierreLabel}>Al confirmar:</p>
            <ul style={{ margin: "0 0 4px 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
              <li>Se <b>archiva</b> el resultado del mes al histórico (consultable en el selector de meses).</li>
              <li>Se <b>avanza el mes activo</b> → auditorías, radicados, SNC y PQRSF se recalculan solos para el mes nuevo.</li>
              <li>Se <b>reinician solo las métricas manuales</b> (satisfacción, productividad, adherencia, precisión). Las fórmulas no se tocan.</li>
            </ul>
            <div className={s.cierreFoot}>
              <button className={s.cancelBtn} onClick={() => setCierreOpen(false)} disabled={guardando}>Cancelar</button>
              <button className={s.saveBtn} onClick={confirmarCierre} disabled={guardando}>
                {guardando ? <Loader2 size={15} className={s.spin} /> : <CalendarCheck size={15} />} Cerrar y pasar de mes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditarDrawer({
  f, labels, editable, onClose, onSaved,
}: {
  f: FilaTabla;
  labels: Record<string, string>;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const campos = camposEditablesDe(f.area as Area, f.usuario) as CampoDesempeno[];
  const [valores, setValores] = useState<Partial<Record<CampoDesempeno, string>>>(() => {
    const init: Partial<Record<CampoDesempeno, string>> = {};
    for (const c of campos) init[c] = f.valores[c] ?? "";
    return init;
  });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Toda métrica del área es editable (cada asesora es distinta; muchas son
  // 100% manuales). Solo los meses cerrados (histórico) quedan de solo lectura.
  function campoBloqueado(_c: CampoDesempeno): boolean {
    return !editable;
  }

  async function guardar() {
    setErr(null);
    // Solo lo que cambió respecto al valor original.
    const cambios: Partial<Record<CampoDesempeno, string>> = {};
    for (const c of campos) {
      const nuevo = (valores[c] ?? "").trim();
      const original = (f.valores[c] ?? "").trim();
      if (nuevo !== original && !campoBloqueado(c)) cambios[c] = nuevo;
    }
    if (Object.keys(cambios).length === 0) { onClose(); return; }
    setGuardando(true);
    try {
      const r = await guardarMetricasAction(f.usuario, f.area, cambios);
      if (r.ok) await onSaved();
      else setErr(r.error ?? "No se pudo guardar");
    } catch {
      setErr("No se pudo guardar. Revisa la conexión e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function limpiar() {
    setErr(null);
    setGuardando(true);
    try {
      const r = await borrarMetricasAction(f.usuario);
      if (r.ok) await onSaved();
      else setErr(r.error ?? "No se pudo limpiar");
    } catch {
      setErr("No se pudo limpiar. Revisa la conexión e intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

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

        {!editable && (
          <div className={s.drawerNote}>Mes cerrado (histórico): solo lectura.</div>
        )}
        {err && <div className={s.drawerErr}>{err}</div>}

        <div className={s.drawerBody}>
          {campos.map((c) => {
            const bloq = campoBloqueado(c);
            const auto = esCampoAutomatico(c);
            const pct = CAMPOS_PORCENTAJE.includes(c);
            return (
              <div className={s.editItem} key={c}>
                <label>
                  {labels[c] ?? c}
                  {auto && <span className={s.autoTag}>auto</span>}
                </label>
                <input
                  type="text"
                  value={valores[c] ?? ""}
                  disabled={bloq}
                  placeholder={pct ? "ej. 95%" : auto ? "automático" : "—"}
                  onChange={(e) => setValores((v) => ({ ...v, [c]: e.target.value }))}
                />
              </div>
            );
          })}

          {f.valores.bono !== undefined && (
            <div className={s.editItem}>
              <label>{labels.bono ?? "Bono Ganado"}<span className={s.autoTag}>calculado</span></label>
              <input type="text" value={f.valores.bono ?? ""} disabled className={s.money} />
            </div>
          )}
        </div>

        {editable && (
          <div className={s.drawerFoot}>
            <button className={s.cancelBtn} onClick={limpiar} disabled={guardando} title="Borra las métricas manuales capturadas de esta asesora">
              Limpiar
            </button>
            <button className={s.cancelBtn} onClick={onClose} disabled={guardando}>Cancelar</button>
            <button className={s.saveBtn} onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 size={15} className={s.spin} /> : <Save size={15} />} Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
