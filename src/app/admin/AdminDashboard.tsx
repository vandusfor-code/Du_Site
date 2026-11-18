"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck, FileBarChart, Bell, Upload, MoreVertical, CalendarDays,
  Search, SlidersHorizontal, Eye, Play, TrendingUp, AlertTriangle, Target,
  BadgeCheck, ClipboardList, CheckCircle2, Clock3,
  XCircle, Loader2, X, Trash2, Pencil, MessageSquare, Save,
} from "lucide-react";
import type { DashboardAuditorias, DashboardFiltros, AuditoriaHistorial, FuncionarioOpcion } from "@/lib/auditorias-admin";
import { mesEnCursoNombre } from "@/lib/meses";
import {
  ejecutarAuditoriasAction,
  generarResumenCortesAction,
  cargarTranscripcionesAction,
  obtenerDashboardAuditoriasAction,
  progresoAuditoriasAction,
  eliminarDuplicadasAction,
  eliminarAuditoriaAction,
  obtenerTranscripcionAction,
  editarAuditoriaAction,
  notificarResumenDiaAction,
} from "./actions";
import type { ProgresoAuditorias } from "@/lib/auditorias-admin";
import type { ResultadoNotificacionResumen } from "@/lib/resumen-diario";
import { calcularNota, VALORES_CRITERIO, VALORES_TUTEO } from "@/lib/auditoria-chatgpt-contrato";
import AdminSidebar from "./AdminSidebar";
import AuditoriaManualForm from "./AuditoriaManualForm";
import AuditoriaChatGPTForm from "./AuditoriaChatGPTForm";
import EnvioAuditorias from "./EnvioAuditorias";
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

/* Números de página a mostrar: primera, última, ventana alrededor de la actual, con "…". */
function rangoPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas: (number | "…")[] = [1];
  const desde = Math.max(2, actual - 1);
  const hasta = Math.min(total - 1, actual + 1);
  if (desde > 2) paginas.push("…");
  for (let p = desde; p <= hasta; p++) paginas.push(p);
  if (hasta < total - 1) paginas.push("…");
  paginas.push(total);
  return paginas;
}

export default function AdminDashboard({
  nombre,
  dashboardInicial,
  errorInicial,
  funcionarios,
}: {
  nombre: string;
  dashboardInicial: DashboardAuditorias | null;
  errorInicial: string | null;
  funcionarios: FuncionarioOpcion[];
}) {
  const [data, setData] = useState(dashboardInicial);
  const [error, setError] = useState(errorInicial);
  const [banner, setBanner] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [tipoAuditoria, setTipoAuditoria] = useState<"ia" | "co" | "chatgpt">("ia");
  const [subVistaChatgpt, setSubVistaChatgpt] = useState<"importar" | "envio">("importar");

  // Vista por defecto: el MES EN CURSO (coincide con lo que precargó el servidor
  // en page.tsx). El usuario puede cambiar a otros meses o a "Todos los meses".
  const [filtros, setFiltros] = useState<DashboardFiltros>({ mes: mesEnCursoNombre() });
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoAuditorias | null>(null);
  const [eliminandoDup, setEliminandoDup] = useState(false);
  // Notificar resumen del día (desde el panel de auditorías IA).
  const hoyISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [fechaResumen, setFechaResumen] = useState(hoyISO);
  const [notificandoR, setNotificandoR] = useState(false);
  const [resNotif, setResNotif] = useState<ResultadoNotificacionResumen | null>(null);
  const [errNotif, setErrNotif] = useState("");

  async function notificarResumen() {
    setNotificandoR(true); setResNotif(null); setErrNotif("");
    try {
      setResNotif(await notificarResumenDiaAction(fechaResumen));
    } catch (e) {
      setErrNotif(e instanceof Error ? e.message : "No se pudo notificar.");
    } finally {
      setNotificandoR(false);
    }
  }
  const [generando, setGenerando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [detalle, setDetalle] = useState<AuditoriaHistorial | null>(null);
  const primeraCarga = useRef(true);
  const [pagina, setPagina] = useState(1);

  const PAGE_SIZE = 10;

  // Opciones de mes para los filtros: siempre incluye el mes en curso (aunque
  // todavía no tenga auditorías) para que sea seleccionable por defecto.
  const mesActual = mesEnCursoNombre();
  const mesesOpciones = Array.from(new Set([mesActual, ...(data?.meses ?? [])]));

  // Re-consulta el dashboard cuando cambian los filtros.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    setPagina(1);
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
    try { setProgreso(await progresoAuditoriasAction()); } catch { /* no bloquea */ }
    // Barra de progreso en vivo: consulta ligera cada 5 s mientras corre.
    const intv = setInterval(async () => {
      try { setProgreso(await progresoAuditoriasAction()); } catch { /* ignora */ }
    }, 5000);
    try {
      const res = await ejecutarAuditoriasAction();
      if (res.yaEnCurso) {
        setBanner({ tipo: "error", msg: "Ya hay una ejecución en curso. Espera a que termine antes de volver a darle." });
      } else {
        const corte = res.detuvoPorTope ? " (se alcanzó el tope de 50)" : res.detuvoPorTiempo ? " (quedaron pendientes — dale de nuevo para continuar)" : "";
        setBanner({ tipo: "ok", msg: `Procesadas ${res.procesadas}, errores ${res.errores}, resúmenes ${res.resumenesCortes}${corte}.` });
      }
      await refrescar();
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al ejecutar auditorías" });
    } finally {
      clearInterval(intv);
      setProcesando(false);
      setProgreso(null);
    }
  }

  async function eliminarDuplicadas() {
    setEliminandoDup(true);
    setBanner(null);
    try {
      const res = await eliminarDuplicadasAction();
      setBanner(res.duplicadosEliminados > 0
        ? { tipo: "ok", msg: `Se eliminaron ${res.duplicadosEliminados} auditoría(s) duplicada(s) de ${res.idsAfectados} gestión(es).` }
        : { tipo: "ok", msg: "No se encontraron auditorías duplicadas." });
      await refrescar();
    } catch (e) {
      setBanner({ tipo: "error", msg: e instanceof Error ? e.message : "Error al eliminar duplicadas" });
    } finally {
      setEliminandoDup(false);
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

  // ── Paginación del historial (10 por página) ──
  const historialTodo = data?.historial ?? [];
  const totalPaginas = Math.max(1, Math.ceil(historialTodo.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const historialPagina = historialTodo.slice(inicio, inicio + PAGE_SIZE);
  const paginasVisibles = rangoPaginas(paginaActual, totalPaginas);

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

      {/* ── Sidebar (compartido con Auditoría Documental) ── */}
      <AdminSidebar nombre={nombre} activo="Auditorías" />

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
              <select
                className={styles.selectButton}
                value={tipoAuditoria}
                onChange={(e) => setTipoAuditoria(e.target.value as "ia" | "co" | "chatgpt")}
                title="Tipo de auditoría"
              >
                <option value="ia">Auditoría IA</option>
                <option value="co">Auditoría CO</option>
                <option value="chatgpt">Auditoría ChatGPT</option>
              </select>
              {tipoAuditoria === "ia" && (
                <>
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
                </>
              )}
            </div>
            <div className={styles.filterRow}>
              <select
                className={styles.selectButton}
                value={filtros.mes ?? ""}
                onChange={(e) => setFiltro({ mes: e.target.value || undefined })}
              >
                <option value="">Todos los meses</option>
                {mesesOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
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
          {/* Estado (IA) · registro manual (CO) · importación estructurada (ChatGPT) */}
          {tipoAuditoria === "co" ? (
            <AuditoriaManualForm
              funcionarios={funcionarios}
              canales={data?.canales ?? []}
              evaluadorDefault={nombre}
              onGuardado={async (msg) => {
                setBanner(msg);
                if (msg.tipo === "ok") await refrescar();
              }}
            />
          ) : tipoAuditoria === "chatgpt" ? (
            <section className={`${styles.panel} ${styles.manualForm}`} style={{ padding: 0, border: "none", background: "transparent", boxShadow: "none" }}>
              <div className={styles.subTabs}>
                <button className={subVistaChatgpt === "importar" ? styles.subTabActive : styles.subTab} onClick={() => setSubVistaChatgpt("importar")}>
                  Importar auditoría
                </button>
                <button className={subVistaChatgpt === "envio" ? styles.subTabActive : styles.subTab} onClick={() => setSubVistaChatgpt("envio")}>
                  Envío de auditorías
                </button>
              </div>
              {subVistaChatgpt === "importar" ? (
                <AuditoriaChatGPTForm
                  funcionarios={funcionarios}
                  evaluadorDefault={nombre}
                  onGuardado={async (msg) => {
                    setBanner(msg);
                    if (msg.tipo === "ok") await refrescar();
                  }}
                />
              ) : (
                <EnvioAuditorias funcionarios={funcionarios} onBanner={(msg) => setBanner(msg)} />
              )}
            </section>
          ) : (
            <>
            <section className={styles.panel}>
              <h2><TrendingUp size={18} />Estado de auditorías</h2>
              <div className={styles.miniStats}>
                <div><Clock3 className={styles.warnIcon} /><b>{data?.estado.pendientes ?? 0}</b><span>Pendientes</span></div>
                <div><CheckCircle2 className={styles.goodIcon} /><b>{data?.estado.procesadasHoy ?? 0}</b><span>Procesadas hoy</span></div>
                <div><XCircle className={styles.badIcon} /><b>{data?.estado.conError ?? 0}</b><span>Con error</span></div>
              </div>
              {(() => {
                const liveTotal = procesando && progreso ? progreso.total : (data?.estado.totalLote ?? 0);
                const liveHechas = procesando && progreso ? progreso.procesadas + progreso.errores : (data?.estado.procesadasHoy ?? 0);
                const livePct = procesando && progreso
                  ? (progreso.total ? Math.round(((progreso.procesadas + progreso.errores) / progreso.total) * 100) : 0)
                  : (data?.estado.progresoPct ?? 0);
                return (
                  <>
                    <div className={styles.progressMeta}>
                      <span><b>{liveHechas}</b> / {liveTotal} procesadas{procesando ? "…" : ""}</span>
                      <b>{livePct}%</b>
                    </div>
                    <div className={styles.progress}><span style={{ width: `${livePct}%` }} /></div>
                    {procesando && progreso && (
                      <div style={{ fontSize: 12, color: "#667189", marginTop: 6 }}>
                        Auditando con IA… {progreso.procesadas} ok · {progreso.errores} con error · {progreso.pendientes} por procesar
                      </div>
                    )}
                  </>
                );
              })()}
              <div className={styles.panelActions}>
                <button className={styles.primary} onClick={ejecutarPendientes} disabled={procesando}>
                  {procesando ? <Loader2 size={14} className={styles.spin} /> : <Play size={14} />}
                  Ejecutar pendientes
                </button>
                <button className={styles.secondary} onClick={generarCortes} disabled={generando}>
                  {generando ? <Loader2 size={14} className={styles.spin} /> : null}
                  Generar cortes
                </button>
                <button className={styles.secondary} onClick={eliminarDuplicadas} disabled={eliminandoDup || procesando} title="Elimina auditorías con el mismo ID de gestión repetido">
                  {eliminandoDup ? <Loader2 size={14} className={styles.spin} /> : null}
                  Eliminar duplicadas
                </button>
              </div>
            </section>

            {/* Notificar resumen del día (1 correo + 1 firma por asesora) */}
            <section className={styles.panel} style={{ marginTop: 16 }}>
              <h2><Bell size={18} /> Notificar resumen del día</h2>
              <p className={styles.gptHint}>
                Envía <b>un solo correo por asesora</b> con el resumen (IA) de sus auditorías del día —lo positivo y lo que debe
                mejorar— y un enlace donde <b>firma una sola vez</b>. Aparece también en el tablero de Calidad.
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className={styles.formField} style={{ maxWidth: 200 }}>
                  <label><CalendarDays size={12} /> Fecha</label>
                  <input type="date" value={fechaResumen} onChange={(e) => setFechaResumen(e.target.value)} />
                </div>
                <button className={styles.primary} onClick={notificarResumen} disabled={notificandoR}>
                  {notificandoR ? <Loader2 size={14} className={styles.spin} /> : <Bell size={14} />} Notificar resumen del día
                </button>
              </div>
            </section>
            </>
          )}

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
              {mesesOpciones.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className={styles.tableSelectNative} value={filtros.resultado ?? ""} onChange={(e) => setFiltro({ resultado: e.target.value || undefined })}>
              <option value="">Todos los resultados</option>
              <option value="OK">Cumple</option>
              <option value="PENC">PENC</option>
            </select>
            <button
              className={styles.filterButton}
              onClick={() => setFiltros({ mes: mesEnCursoNombre() })}
              title="Limpiar filtros (vuelve al mes en curso)"
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
                {historialPagina.length > 0 ? (
                  historialPagina.map((a, i) => {
                    const penc = a.tipoNota.toUpperCase() === "PENC";
                    return (
                      <tr key={`${a.idGestion}-${inicio + i}`} className={styles.rowClickable} onClick={() => setDetalle(a)}>
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
            <div className={styles.pageNums}>
              <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual <= 1} aria-label="Anterior">‹</button>
              {paginasVisibles.map((p, i) =>
                p === "…" ? (
                  <span key={`dots-${i}`} className={styles.pageDots}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPagina(p)}
                    className={p === paginaActual ? styles.pageActive : ""}
                  >
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas} aria-label="Siguiente">›</button>
            </div>
            <span className={styles.pageInfo}>
              {historialTodo.length > 0
                ? `Mostrando ${inicio + 1}-${inicio + historialPagina.length} de ${fmtEntero(data?.totalHistorial ?? historialTodo.length)}`
                : ""}
            </span>
          </div>
        </section>
      </main>

      {detalle && <DetalleModal a={detalle} onClose={() => setDetalle(null)} onCambio={() => { setDetalle(null); refrescar(); }} />}

      {/* Pop-up del resultado de "Notificar resumen del día" */}
      {(resNotif || errNotif) && (() => {
        const total = resNotif ? resNotif.asesorasNotificadas + resNotif.sinCorreo + resNotif.fallidas : 0;
        return (
          <div role="dialog" aria-modal="true" onClick={() => { setResNotif(null); setErrNotif(""); }}
            style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#0e0a2a", borderRadius: 16, padding: "26px 26px 22px", maxWidth: 460, width: "100%", boxShadow: "0 24px 70px rgba(0,0,0,.35)", textAlign: "center" }}>
              {errNotif ? (
                <><AlertTriangle size={44} color="#e11d48" /><h3 style={{ margin: "10px 0 6px", fontSize: 20 }}>No se pudo notificar</h3><p style={{ color: "#6b6a85", margin: "0 0 18px" }}>{errNotif}</p></>
              ) : total === 0 ? (
                <><CheckCircle2 size={44} color="#8a93a8" /><h3 style={{ margin: "10px 0 6px", fontSize: 20 }}>Sin auditorías para resumir</h3><p style={{ color: "#6b6a85", margin: "0 0 18px" }}>No hay auditorías del <b>{fechaResumen}</b>.</p></>
              ) : (
                <>
                  <CheckCircle2 size={48} color="#16a34a" />
                  <h3 style={{ margin: "10px 0 6px", fontSize: 21 }}>¡Auditorías notificadas! ✅</h3>
                  <p style={{ color: "#6b6a85", margin: "0 0 14px" }}>
                    <b style={{ color: "#16a34a" }}>{resNotif!.asesorasNotificadas}</b> asesora(s) del <b>{fechaResumen}</b>
                    {resNotif!.sinCorreo > 0 ? ` · ${resNotif!.sinCorreo} sin correo` : ""}
                    {resNotif!.fallidas > 0 ? ` · ${resNotif!.fallidas} con fallo` : ""}.
                  </p>
                  {resNotif!.detalle.length > 0 && (
                    <div style={{ textAlign: "left", maxHeight: 200, overflowY: "auto", border: "1px solid #e7e4f5", borderRadius: 10, padding: "8px 12px", margin: "0 0 16px", fontSize: 13.5 }}>
                      {resNotif!.detalle.map((d, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span>{d.nombre}</span><b style={{ color: d.estado === "Notificada" ? "#16a34a" : "#e11d48" }}>{d.estado}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button className={styles.primary} onClick={() => { setResNotif(null); setErrNotif(""); }} style={{ width: "100%", justifyContent: "center" }}>Entendido</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const CRITS = [
  ["saludo", "Saludo"], ["empatia", "Empatía"], ["sonrisa", "Sonrisa"], ["claridad", "Claridad"],
  ["encuesta", "Encuesta"], ["informacion", "Información"], ["proceso", "Proceso"], ["cierre", "Cierre"],
] as const;

// Burbujas de chat a partir de la transcripción "AGENTE: … | CLIENTE: … | …".
function Transcripcion({ texto }: { texto: string }) {
  const turnos = texto.split("|").map((t) => t.trim()).filter(Boolean);
  if (turnos.length === 0) return <p style={{ color: "#8a93a8", fontSize: 13 }}>No hay transcripción guardada para esta gestión.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto", padding: "4px 2px" }}>
      {turnos.map((t, i) => {
        const esAgente = /^AGENTE\s*:/i.test(t);
        const esCliente = /^CLIENTE\s*:/i.test(t);
        const cuerpo = t.replace(/^(AGENTE|CLIENTE)\s*:/i, "").trim();
        const quien = esAgente ? "Agente" : esCliente ? "Usuario" : "";
        return (
          <div key={i} style={{ display: "flex", justifyContent: esAgente ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "78%", padding: "9px 13px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.45,
              background: esAgente ? "#21175d" : "#eef0f6", color: esAgente ? "#fff" : "#1f2430",
              borderBottomRightRadius: esAgente ? 4 : 14, borderBottomLeftRadius: esAgente ? 14 : 4,
            }}>
              {quien && <div style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.7, marginBottom: 2, textTransform: "uppercase", letterSpacing: ".4px" }}>{quien}</div>}
              {cuerpo || t}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetalleModal({ a, onClose, onCambio }: { a: AuditoriaHistorial; onClose: () => void; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [error, setError] = useState("");
  // Transcripción
  const [verTrans, setVerTrans] = useState(false);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);
  const [cargandoTrans, setCargandoTrans] = useState(false);
  // Campos editables
  const [f, setF] = useState({
    saludo: a.saludo, empatia: a.empatia, sonrisa: a.sonrisa, claridad: a.claridad,
    encuesta: a.encuesta, informacion: a.informacion, proceso: a.proceso, cierre: a.cierre,
    puntajeTuteo: a.puntajeTuteo || "Sin tuteo", observacion: a.observacion, hallazgos: a.hallazgos, mejora: a.mejora,
  });

  const penc = a.tipoNota.toUpperCase() === "PENC";
  const notaViva = useMemo(() => calcularNota(f), [f]);
  const critClass = (v: string) =>
    v.toLowerCase().includes("no cumple") ? styles.critNo : v.toLowerCase().includes("no aplica") ? styles.critNa : styles.critOk;

  async function toggleTrans() {
    if (!verTrans && transcripcion === null) {
      setCargandoTrans(true);
      try { const r = await obtenerTranscripcionAction(a.idGestion); setTranscripcion(r.texto || ""); }
      catch { setTranscripcion(""); }
      finally { setCargandoTrans(false); }
    }
    setVerTrans((v) => !v);
  }

  async function guardar() {
    setGuardando(true); setError("");
    const res = await editarAuditoriaAction({ idGestion: a.idGestion, ...f });
    setGuardando(false);
    if (res.ok) onCambio();
    else setError(res.error);
  }

  async function eliminar() {
    setEliminando(true); setError("");
    const res = await eliminarAuditoriaAction(a.idGestion);
    setEliminando(false);
    if ("ok" in res && res.ok) onCambio();
    else setError("error" in res ? res.error : "No se pudo eliminar.");
  }

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

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
              <strong>{editando ? notaViva.nota + "%" : a.nota}</strong>
              <div><span className={(editando ? notaViva.tipoNota === "PENC" : penc) ? styles.penc : styles.ok}>{(editando ? notaViva.tipoNota === "PENC" : penc) ? "PENC" : "Cumple"}</span></div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
          </div>
        </div>

        {/* Barra de acciones */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 0 12px" }}>
          <button className={styles.secondary} onClick={toggleTrans} disabled={cargandoTrans}>
            {cargandoTrans ? <Loader2 size={14} className={styles.spin} /> : <MessageSquare size={14} />} {verTrans ? "Ocultar transcripción" : "Ver transcripción"}
          </button>
          {!editando && <button className={styles.secondary} onClick={() => setEditando(true)}><Pencil size={14} /> Editar notas</button>}
          {!confirmarEliminar
            ? <button className={styles.secondary} style={{ color: "#d93142", borderColor: "#f3b4b4" }} onClick={() => setConfirmarEliminar(true)}><Trash2 size={14} /> Eliminar</button>
            : <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <button className={styles.secondary} style={{ background: "#d93142", color: "#fff", borderColor: "#d93142" }} onClick={eliminar} disabled={eliminando}>
                  {eliminando ? <Loader2 size={14} className={styles.spin} /> : <Trash2 size={14} />} Confirmar
                </button>
                <button className={styles.secondary} onClick={() => setConfirmarEliminar(false)} disabled={eliminando}>Cancelar</button>
              </span>}
        </div>

        {error && <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginBottom: 12 }}>{error}</div>}

        {verTrans && (
          <div style={{ border: "1px solid #e7e4f5", borderRadius: 12, padding: 12, marginBottom: 14, background: "#fafaff" }}>
            {transcripcion === null ? <p style={{ color: "#8a93a8", fontSize: 13 }}>Cargando…</p> : <Transcripcion texto={transcripcion} />}
          </div>
        )}

        <div className={styles.modalBody}>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}><span>Fecha</span><b>{a.fecha || "—"}</b></div>
            <div className={styles.metaItem}><span>Canal</span><b>{a.canal || "—"}</b></div>
            <div className={styles.metaItem}><span>Tipo consulta</span><b>{a.tipoConsulta || "—"}</b></div>
            <div className={styles.metaItem}><span>Correo</span><b>{a.correo || "—"}</b></div>
            <div className={styles.metaItem}><span>Tuteo</span><b>{editando ? f.puntajeTuteo : (a.puntajeTuteo || "—")}</b></div>
            <div className={styles.metaItem}><span>Tono</span><b>{a.tonoGeneral || "—"}</b></div>
            <div className={styles.metaItem}><span>Evaluador</span><b>{a.evaluador || "—"}</b></div>
            <div className={styles.metaItem}><span>Tipo gestión</span><b>{a.tipoGestion || "—"}</b></div>
          </div>

          {editando ? (
            <>
              <div className={styles.critGrid}>
                {CRITS.map(([k, label]) => (
                  <div className={styles.critBox} key={k}>
                    <span>{label}</span>
                    <select value={(f as Record<string, string>)[k]} onChange={(e) => set(k as keyof typeof f, e.target.value)} style={{ marginTop: 4, width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #e7e4f5", fontSize: 13 }}>
                      {VALORES_CRITERIO.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div className={styles.critBox}>
                  <span>Tuteo</span>
                  <select value={f.puntajeTuteo} onChange={(e) => set("puntajeTuteo", e.target.value)} style={{ marginTop: 4, width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid #e7e4f5", fontSize: 13 }}>
                    {VALORES_TUTEO.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.bloque}><span>Observación</span><textarea value={f.observacion} onChange={(e) => set("observacion", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box" }} /></div>
              <div className={styles.bloque}><span>Hallazgos</span><textarea value={f.hallazgos} onChange={(e) => set("hallazgos", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box" }} /></div>
              <div className={styles.bloque}><span>Puntos de mejora</span><textarea value={f.mejora} onChange={(e) => set("mejora", e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box" }} /></div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button className={styles.secondary} onClick={() => setEditando(false)} disabled={guardando}>Cancelar</button>
                <button className={styles.primary} onClick={guardar} disabled={guardando}>
                  {guardando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />} Guardar cambios
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.critGrid}>
                {CRITS.map(([k, label]) => (
                  <div className={styles.critBox} key={k}>
                    <span>{label}</span>
                    <b className={critClass((f as Record<string, string>)[k])}>{(f as Record<string, string>)[k] || "—"}</b>
                  </div>
                ))}
              </div>
              <div className={styles.bloque}><span>Observación</span><p>{a.observacion || "—"}</p></div>
              <div className={styles.bloque}><span>Hallazgos</span><p>{a.hallazgos || "—"}</p></div>
              <div className={styles.bloque}><span>Puntos de mejora</span><p>{a.mejora || "—"}</p></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
