"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ClipboardCheck, Users, CircleGauge, Send, FileBarChart,
  Bell, Settings, Upload, MoreVertical, CalendarDays,
  Search, SlidersHorizontal, Eye, Play, TrendingUp, AlertTriangle, Target,
  BadgeCheck, ClipboardList, ChevronDown, CheckCircle2, Clock3,
  XCircle, Loader2, X, LogOut,
} from "lucide-react";
import Link from "next/link";
import type { DashboardAuditorias, DashboardFiltros, AuditoriaHistorial } from "@/lib/auditorias-admin";
import {
  ejecutarAuditoriasAction,
  generarResumenCortesAction,
  cargarTranscripcionesAction,
  obtenerDashboardAuditoriasAction,
} from "./actions";
import styles from "./auditorias.module.css";

/* Formateo es-CO: 1021 → "1.021", 91.4 → "91,4" */
function fmtEntero(n: number): string {
  return n.toLocaleString("es-CO");
}
function fmtDecimal(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/* Convierte una serie de números a puntos "x,y ..." para el sparkline (0..100 x, 0..32 y). */
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
      const y = 30 - norm * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AdminDashboard({
  nombre,
  dashboardInicial,
  errorInicial,
}: {
  nombre: string;
  dashboardInicial: DashboardAuditorias | null;
  errorInicial: string | null;
}) {
  const [data, setData] = useState(dashboardInicial);
  const [error, setError] = useState(errorInicial);
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);

  const [filtros, setFiltros] = useState<DashboardFiltros>({});
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [detalle, setDetalle] = useState<AuditoriaHistorial | null>(null);
  const primeraCarga = useRef(true);

  // Re-consulta el dashboard cuando cambian los filtros.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    let vigente = true;
    setCargando(true);
    obtenerDashboardAuditoriasAction(filtros)
      .then((res) => {
        if (vigente) setData(res);
      })
      .catch((e) => {
        if (vigente) setError(e instanceof Error ? e.message : "Error al filtrar");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [filtros]);

  async function refrescar() {
    try {
      const res = await obtenerDashboardAuditoriasAction(filtros);
      setData(res);
    } catch {
      /* el banner de la acción ya informa */
    }
  }

  function setFiltro(patch: Partial<DashboardFiltros>) {
    setFiltros((f) => ({ ...f, ...patch }));
  }

  async function subirCsv(file: File) {
    setSubiendo(true);
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("archivo", file);
      const res = await cargarTranscripcionesAction(fd);
      setBanner({ tipo: "ok", msg: `Se cargaron ${res.cantidad} transcripción${res.cantidad === 1 ? "" : "es"} a Transcripciones1.` });
      await refrescar();
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al cargar el CSV" });
    } finally {
      setSubiendo(false);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
  }

  async function ejecutarPendientes() {
    setProcesando(true);
    setBanner(null);
    try {
      const res = await ejecutarAuditoriasAction();
      const corte = res.detuvoPorTope ? " (se alcanzó el tope de 50)" : res.detuvoPorTiempo ? " (se alcanzó el límite de tiempo)" : "";
      setBanner({ tipo: "ok", msg: `Procesadas ${res.procesadas}, errores ${res.errores}, resúmenes ${res.resumenesCortes}${corte}.` });
      await refrescar();
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al ejecutar auditorías" });
    } finally {
      setProcesando(false);
    }
  }

  async function generarCortes() {
    setGenerando(true);
    setBanner(null);
    try {
      const n = await generarResumenCortesAction();
      setBanner({ tipo: "ok", msg: n > 0 ? `Se generaron resúmenes para ${n} asesor${n === 1 ? "" : "es"}.` : "No hay auditorías del día para resumir." });
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al generar cortes" });
    } finally {
      setGenerando(false);
    }
  }

  const k = data?.kpi;
  const cards = k
    ? [
        { title: "Auditorías totales", value: fmtEntero(k.total), tone: styles.violet, Icon: ClipboardList, spark: k.sparklines.total, trend: k.tendencia.total, unidad: "%", peor: "up" as const },
        { title: "Calidad promedio", value: `${fmtDecimal(k.calidadPromedio)}%`, tone: styles.green, Icon: BadgeCheck, spark: k.sparklines.calidadPromedio, trend: k.tendencia.calidadPromedio, unidad: " pts", peor: "down" as const },
        { title: "PENC", value: fmtEntero(k.penc), tone: styles.red, Icon: AlertTriangle, spark: k.sparklines.penc, trend: k.tendencia.penc, unidad: "%", peor: "down" as const },
        { title: "Cumplimiento", value: `${fmtDecimal(k.cumplimiento)}%`, tone: styles.blue, Icon: Target, spark: k.sparklines.cumplimiento, trend: k.tendencia.cumplimiento, unidad: " pts", peor: "up" as const },
      ]
    : [];

  const nav: [typeof LayoutDashboard, string][] = [
    [LayoutDashboard, "Resumen"], [ClipboardCheck, "Auditorías"], [Users, "Asesores"],
    [CircleGauge, "Criterios"], [Send, "Cortes de envío"], [FileBarChart, "Reportes"],
    [Bell, "Alertas"], [Settings, "Configuración"],
  ];

  return (
    <div className={styles.app}>
      <input
        ref={inputArchivoRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subirCsv(f);
        }}
      />

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>Du</div>
          <b>Du Labs</b>
        </div>
        <nav className={styles.nav}>
          {nav.map(([Icon, label], i) => (
            <button key={label} className={i === 1 ? styles.navActive : styles.navItem}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.profile}>
            <div className={styles.avatar}>{nombre.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{nombre}</strong>
              <small>Administrador</small>
            </div>
            <ChevronDown size={16} />
          </div>
          <Link href="/" className={styles.collapse}>
            <LogOut size={16} /> Volver al inicio
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.titleLine}>
              <TrendingUp size={25} />
              <h1>Auditorías</h1>
            </div>
            <p>Supervisa la calidad de las interacciones y el desempeño de los asesores.</p>
          </div>
          <div className={styles.topActions}>
            <div className={styles.actionRow}>
              <button className={styles.secondary} onClick={() => inputArchivoRef.current?.click()} disabled={subiendo}>
                {subiendo ? <Loader2 size={16} className={styles.spin} /> : <Upload size={16} />}
                Importar CSV
              </button>
              <button className={styles.primary} onClick={ejecutarPendientes} disabled={procesando}>
                {procesando ? <Loader2 size={16} className={styles.spin} /> : <Play size={16} />}
                Ejecutar pendientes
              </button>
              <button className={styles.iconButton} onClick={generarCortes} disabled={generando} title="Generar cortes">
                {generando ? <Loader2 size={16} className={styles.spin} /> : <MoreVertical size={18} />}
              </button>
            </div>
            <div className={styles.filterRow}>
              <select
                className={styles.selectButton}
                value={filtros.mes ?? ""}
                onChange={(e) => setFiltro({ mes: e.target.value || undefined })}
              >
                <option value="">Todos los meses</option>
                {data?.meses.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className={styles.dateButton}>
                <CalendarDays size={16} />
                <input
                  type="date"
                  className={styles.dateInput}
                  value={filtros.fechaDesde ?? ""}
                  onChange={(e) => setFiltro({ fechaDesde: e.target.value || undefined })}
                />
                <span>–</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={filtros.fechaHasta ?? ""}
                  onChange={(e) => setFiltro({ fechaHasta: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>
        </header>

        {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
        {banner && <div className={`${styles.banner} ${banner.tipo === "ok" ? styles.bannerOk : styles.bannerError}`}>{banner.msg}</div>}

        {/* ── KPIs ── */}
        <div className={styles.statsGrid}>
          {cards.map((c) => {
            const points = sparkPoints(c.spark);
            const trendOk = c.trend !== null && (c.peor === "up" ? c.trend >= 0 : c.trend <= 0);
            const arrow = c.trend === null ? "" : c.trend > 0 ? "↑" : c.trend < 0 ? "↓" : "→";
            return (
              <article className={styles.statCard} key={c.title}>
                <div className={`${styles.statIcon} ${c.tone}`}><c.Icon size={23} /></div>
                <div className={styles.statMain}><span>{c.title}</span><strong>{c.value}</strong></div>
                {points ? (
                  <svg className={styles.spark} viewBox="0 0 100 32" preserveAspectRatio="none">
                    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  <span />
                )}
                <div className={`${styles.trend} ${trendOk ? styles.positive : styles.negative}`}>
                  {c.trend === null ? (
                    <span>Sin dato del mes anterior</span>
                  ) : (
                    <>
                      <b>{arrow} {fmtDecimal(Math.abs(c.trend))}{c.unidad}</b> vs. mes anterior
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Paneles analíticos ── */}
        <div className={styles.analyticsGrid}>
          {/* Estado */}
          <section className={styles.panel}>
            <h2><TrendingUp size={18} />Estado de auditorías</h2>
            <div className={styles.miniStats}>
              <div><Clock3 className={styles.warnIcon} /><b>{data?.estado.pendientes ?? 0}</b><span>Pendientes</span></div>
              <div><CheckCircle2 className={styles.goodIcon} /><b>{data?.estado.procesadasHoy ?? 0}</b><span>Procesadas hoy</span></div>
              <div><XCircle className={styles.badIcon} /><b>{data?.estado.conError ?? 0}</b><span>Con error</span></div>
            </div>
            <div className={styles.progressMeta}>
              <span><b>{data?.estado.procesadasHoy ?? 0}</b> / {data?.estado.totalLote ?? 0} procesadas</span>
              <b>{data?.estado.progresoPct ?? 0}%</b>
            </div>
            <div className={styles.progress}><span style={{ width: `${data?.estado.progresoPct ?? 0}%` }} /></div>
            <div className={styles.panelActions}>
              <button className={styles.primary} onClick={ejecutarPendientes} disabled={procesando}>
                {procesando ? <Loader2 size={14} className={styles.spin} /> : <Play size={14} />}
                Ejecutar pendientes
              </button>
              <button className={styles.secondary} onClick={generarCortes} disabled={generando}>
                {generando ? <Loader2 size={14} className={styles.spin} /> : null}
                Generar cortes
              </button>
            </div>
          </section>

          {/* Cumplimiento por criterio */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2><FileBarChart size={18} />Cumplimiento por criterio</h2>
              {cargando && <Loader2 size={15} className={styles.spin} />}
            </div>
            <div className={styles.criteria}>
              {(data?.criterios ?? []).map((c) => (
                <div className={styles.criterion} key={c.nombre}>
                  <span>{c.nombre}</span>
                  <div className={styles.bar}><i className={c.pct < 80 ? styles.barWarning : ""} style={{ width: `${c.pct}%` }} /></div>
                  <b>{c.pct}%</b>
                  {c.pct < 85 ? <span className={styles.down}>↓</span> : <span />}
                </div>
              ))}
            </div>
          </section>

          {/* Alertas */}
          <section className={styles.panel}>
            <h2><Bell size={18} />Alertas de calidad</h2>
            <div className={styles.alertTotal}>
              <strong>{data?.kpi.penc ?? 0}</strong>
              <span>PENC detectados</span>
            </div>
            {data && data.alertas.length > 0 ? (
              <div className={styles.alertList}>
                {data.alertas.map((a) => (
                  <div key={a.criterio}>
                    <span><i className={`${styles.dot} ${styles.red}`} />{a.criterio}</span>
                    <b>{a.cantidad}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyMini}>Sin incumplimientos registrados en las PENC filtradas.</p>
            )}
          </section>
        </div>

        {/* ── Historial ── */}
        <section className={`${styles.panel} ${styles.history}`}>
          <h2><ClipboardCheck size={18} />Historial de auditorías</h2>
          <div className={styles.tableTools}>
            <div className={styles.search}>
              <Search size={16} />
              <input
                placeholder="Buscar asesor o ID de gestión..."
                defaultValue={filtros.busqueda ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFiltro({ busqueda: (e.target as HTMLInputElement).value || undefined });
                }}
                onBlur={(e) => setFiltro({ busqueda: e.target.value || undefined })}
              />
            </div>
            <select className={styles.tableSelectNative} value={filtros.asesor ?? ""} onChange={(e) => setFiltro({ asesor: e.target.value || undefined })}>
              <option value="">Todos los asesores</option>
              {data?.asesores.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className={styles.tableSelectNative} value={filtros.canal ?? ""} onChange={(e) => setFiltro({ canal: e.target.value || undefined })}>
              <option value="">Todos los canales</option>
              {data?.canales.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={styles.tableSelectNative} value={filtros.mes ?? ""} onChange={(e) => setFiltro({ mes: e.target.value || undefined })}>
              <option value="">Todos los meses</option>
              {data?.meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className={styles.tableSelectNative} value={filtros.resultado ?? ""} onChange={(e) => setFiltro({ resultado: e.target.value || undefined })}>
              <option value="">Todos los resultados</option>
              <option value="OK">Cumple</option>
              <option value="PENC">PENC</option>
            </select>
            <button
              className={styles.filterButton}
              onClick={() => setFiltros({})}
              title="Limpiar filtros"
            >
              <SlidersHorizontal size={16} />Limpiar
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th><th>Asesor</th><th>Canal</th><th>ID Gestión</th><th>Nota</th><th>Resultado</th><th>Tipo</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data && data.historial.length > 0 ? (
                  data.historial.map((a, i) => {
                    const penc = a.tipoNota.toUpperCase() === "PENC";
                    return (
                      <tr key={`${a.idGestion}-${i}`} className={styles.rowClickable} onClick={() => setDetalle(a)}>
                        <td>{a.fecha}</td>
                        <td><b>{a.asesor}</b></td>
                        <td>{a.canal}</td>
                        <td>{a.idGestion.slice(0, 12)}…</td>
                        <td><b>{a.nota}</b></td>
                        <td><span className={penc ? styles.penc : styles.ok}>{penc ? "PENC" : "Cumple"}</span></td>
                        <td>{a.tipoConsulta}</td>
                        <td><button className={styles.view} onClick={(e) => { e.stopPropagation(); setDetalle(a); }}><Eye size={15} />Ver</button></td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={8} className={styles.emptyRow}>{cargando ? "Cargando…" : "No hay auditorías para estos filtros."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <span>{cargando ? "Actualizando…" : ""}</span>
            <span>
              {data ? `Mostrando ${data.historial.length} de ${fmtEntero(data.totalHistorial)}` : "—"}
            </span>
          </div>
        </section>
      </main>

      {detalle && <DetalleModal a={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function DetalleModal({ a, onClose }: { a: AuditoriaHistorial; onClose: () => void }) {
  const penc = a.tipoNota.toUpperCase() === "PENC";
  const criterios: [string, string][] = [
    ["Saludo", a.saludo], ["Empatía", a.empatia], ["Sonrisa", a.sonrisa], ["Claridad", a.claridad],
    ["Encuesta", a.encuesta], ["Información", a.informacion], ["Proceso", a.proceso], ["Cierre", a.cierre],
  ];
  const critClass = (v: string) =>
    v.toLowerCase().includes("no cumple") ? styles.critNo : v.toLowerCase().includes("no aplica") ? styles.critNa : styles.critOk;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <small>Auditoría</small>
            <h3>{a.asesor}</h3>
            <div className={styles.modalId}>{a.idGestion}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div className={styles.modalNota}>
              <strong>{a.nota}</strong>
              <div><span className={penc ? styles.penc : styles.ok}>{penc ? "PENC" : "Cumple"}</span></div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
          </div>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}><span>Fecha</span><b>{a.fecha || "—"}</b></div>
            <div className={styles.metaItem}><span>Canal</span><b>{a.canal || "—"}</b></div>
            <div className={styles.metaItem}><span>Tipo consulta</span><b>{a.tipoConsulta || "—"}</b></div>
            <div className={styles.metaItem}><span>Correo</span><b>{a.correo || "—"}</b></div>
            <div className={styles.metaItem}><span>Tuteo</span><b>{a.puntajeTuteo || "—"}</b></div>
            <div className={styles.metaItem}><span>Tono</span><b>{a.tonoGeneral || "—"}</b></div>
            <div className={styles.metaItem}><span>Evaluador</span><b>{a.evaluador || "—"}</b></div>
            <div className={styles.metaItem}><span>Tipo gestión</span><b>{a.tipoGestion || "—"}</b></div>
          </div>
          <div>
            <div className={styles.critGrid}>
              {criterios.map(([nombre, valor]) => (
                <div className={styles.critBox} key={nombre}>
                  <span>{nombre}</span>
                  <b className={critClass(valor)}>{valor || "—"}</b>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.bloque}><span>Observación</span><p>{a.observacion || "—"}</p></div>
          <div className={styles.bloque}><span>Hallazgos</span><p>{a.hallazgos || "—"}</p></div>
          <div className={styles.bloque}><span>Puntos de mejora</span><p>{a.mejora || "—"}</p></div>
        </div>
      </div>
    </div>
  );
}
