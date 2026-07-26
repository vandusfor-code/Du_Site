"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Plus, FileText, Pencil, Eye, CheckCircle2, Search, Calendar,
  MoreVertical, ChevronLeft, ChevronRight, Clock, AlertTriangle, ArrowLeft,
  GitBranch,
} from "lucide-react";
import type { DashboardDocumentacion, ProcedimientoDoc } from "@/lib/documentacion-tipos";
import { ESTADO_META, estadoLabel } from "@/lib/documentacion-tipos";
import { obtenerDashboardDocumentacionAction } from "./actions";
import AsignarProcedimientoModal from "./AsignarProcedimientoModal";
import s from "./documentacion.module.css";

const PAGE_SIZE = 5;

const BADGE_ICON: Record<string, typeof Clock> = {
  neutral: Clock,
  amber: Pencil,
  red: Eye,
  redStrong: AlertTriangle,
  green: CheckCircle2,
};

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function rangoPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const desde = Math.max(2, actual - 1);
  const hasta = Math.min(total - 1, actual + 1);
  if (desde > 2) out.push("…");
  for (let i = desde; i <= hasta; i++) out.push(i);
  if (hasta < total - 1) out.push("…");
  out.push(total);
  return out;
}

export default function DocumentacionDashboard({
  dashboardInicial,
  errorInicial,
}: {
  dashboardInicial: DashboardDocumentacion | null;
  errorInicial: string | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fApp, setFApp] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState(dashboardInicial);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function recargarDashboard() {
    try {
      const r = await obtenerDashboardDocumentacionAction();
      setData(r);
    } catch {
      // el dashboard actual permanece visible si la recarga falla
    }
  }

  async function alAsignar() {
    setModalAbierto(false);
    await recargarDashboard();
    setToast("Procedimiento asignado correctamente.");
    setTimeout(() => setToast(null), 4000);
  }

  const filtrados = useMemo(() => {
    if (!data) return [] as ProcedimientoDoc[];
    const q = busqueda.trim().toLowerCase();
    return data.procedimientos.filter((p) => {
      if (q && !p.titulo.toLowerCase().includes(q) && !p.descripcion.toLowerCase().includes(q)) return false;
      if (fApp && p.aplicativo !== fApp) return false;
      if (fEstado && p.estado !== fEstado) return false;
      return true;
    });
  }, [data, busqueda, fApp, fEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const visibles = filtrados.slice(inicio, inicio + PAGE_SIZE);

  function reset(setter: (v: string) => void, v: string) {
    setter(v);
    setPagina(1);
  }

  function proximamente() {
    alert("El flujo de creación/asignación estará disponible en la próxima fase.");
  }

  const kpis = data
    ? [
        { label: "Asignados", value: data.kpi.asignados, Icon: FileText, bg: s.violetBg, bar: s.violetBar },
        { label: "En elaboración", value: data.kpi.enElaboracion, Icon: Pencil, bg: s.amberBg, bar: s.amberBar },
        { label: "Por revisar", value: data.kpi.porRevisar, Icon: Eye, bg: s.redBg, bar: s.redBar },
        { label: "Publicados", value: data.kpi.publicados, Icon: CheckCircle2, bg: s.greenBg, bar: s.greenBar },
      ]
    : [];

  const sinProcedimientos = data && data.procedimientos.length === 0;

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <Link href="/" className={s.back}><ArrowLeft size={14} /> Volver al inicio</Link>

        <header className={s.head}>
          <div>
            <div className={s.title}><BookOpen size={26} /><h1>Documentación Operativa</h1></div>
            <p>Centraliza, documenta y valida el conocimiento operativo de los aplicativos.</p>
          </div>
          <button className={s.primary} onClick={() => setModalAbierto(true)}><Plus size={17} /> Asignar procedimiento</button>
        </header>

        {errorInicial && <div className={s.banner}>{errorInicial}</div>}
        {toast && <div className={`${s.banner} ${s.bannerOk}`}>{toast}</div>}

        {data && (
          <>
            <div className={s.kpis}>
              {kpis.map((k) => (
                <div className={s.kpi} key={k.label}>
                  <div className={s.kpiTop}>
                    <div className={`${s.kpiIcon} ${k.bg}`}><k.Icon size={20} /></div>
                    <div>
                      <div className={s.kpiVal}>{k.value}</div>
                      <div className={s.kpiLabel}>{k.label}</div>
                    </div>
                  </div>
                  <div className={`${s.kpiBar} ${k.bar}`} />
                </div>
              ))}
            </div>

            <section className={s.card}>
              <div className={s.cardHead}><h2>Procedimientos</h2></div>

              {sinProcedimientos ? (
                <div className={s.empty}>
                  <div className={s.emptyIcon}><BookOpen size={26} /></div>
                  <p>Aún no hay procedimientos documentados.</p>
                  <button className={s.primary} onClick={() => setModalAbierto(true)}><Plus size={17} /> Asignar procedimiento</button>
                </div>
              ) : (
                <>
                  <div className={s.searchRow}>
                    <div className={s.search}>
                      <Search size={16} />
                      <input
                        placeholder="Buscar procedimiento..."
                        value={busqueda}
                        onChange={(e) => reset(setBusqueda, e.target.value)}
                      />
                    </div>
                    <select className={s.select} value={fApp} onChange={(e) => reset(setFApp, e.target.value)}>
                      <option value="">Todos los aplicativos</option>
                      {data.aplicativos.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className={s.select} value={fEstado} onChange={(e) => reset(setFEstado, e.target.value)}>
                      <option value="">Todos los estados</option>
                      {data.estados.map((e) => <option key={e} value={e}>{estadoLabel(e)}</option>)}
                    </select>
                  </div>

                  <div className={s.tableWrap}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th>Procedimiento</th><th>Aplicativo</th><th>Responsable</th><th>Estado</th><th>Fecha límite</th><th>Versión</th><th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.length > 0 ? visibles.map((p) => {
                          const meta = ESTADO_META[p.estado] ?? { label: p.estado, tone: "neutral" };
                          const BadgeIcon = BADGE_ICON[meta.tone] ?? Clock;
                          const fechaCls = p.urgency === "danger" ? s.fechaDanger : p.urgency === "warning" ? s.fechaWarning : "";
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className={s.procName}>{p.titulo}</div>
                                {p.descripcion && <div className={s.procDesc}>{p.descripcion}</div>}
                              </td>
                              <td>{p.aplicativo}</td>
                              <td>
                                {p.responsable ? (
                                  <div className={s.resp}>
                                    <span className={s.avatar}>{iniciales(p.responsable)}</span>
                                    <span>{p.responsable}</span>
                                  </div>
                                ) : (
                                  <span className={s.sinAsignar}>Sin asignar</span>
                                )}
                              </td>
                              <td>
                                <span className={`${s.badge} ${s[meta.tone]}`}><BadgeIcon size={13} />{meta.label}</span>
                              </td>
                              <td>
                                {p.fechaLimite ? (
                                  <span className={`${s.fecha} ${fechaCls}`}><Calendar size={13} />{p.fechaLimite}</span>
                                ) : (
                                  <span className={s.dash}>—</span>
                                )}
                              </td>
                              <td>{p.version === "—" ? <span className={s.dash}>—</span> : p.version}</td>
                              <td>
                                <div className={s.acciones}>
                                  <Link href={`/modulos/documentacion/${p.id}/revision`} className={s.iconBtn} title="Revisar"><Eye size={15} /></Link>
                                  <Link href={`/modulos/documentacion/${p.id}/revision`} className={s.iconBtn} title="Abrir"><MoreVertical size={15} /></Link>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan={7} className={s.empty}><p>No hay procedimientos para estos filtros.</p></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className={s.pager}>
                    <span>Mostrando {filtrados.length === 0 ? 0 : inicio + 1} a {inicio + visibles.length} de {filtrados.length} procedimientos</span>
                    <div className={s.pageNums}>
                      <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual <= 1}><ChevronLeft size={14} /></button>
                      {rangoPaginas(paginaActual, totalPaginas).map((p, i) =>
                        p === "…" ? <span key={`d${i}`} className={s.pageDots}>…</span> : (
                          <button key={p} onClick={() => setPagina(p)} className={p === paginaActual ? s.pageActive : ""}>{p}</button>
                        )
                      )}
                      <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {data.propuestos.length > 0 && (
              <section className={s.card}>
                <div className={s.propHead}>
                  <div className={s.propTitleRow}>
                    <h2>Procedimientos propuestos</h2>
                    <span className={s.countBadge}>{data.propuestos.length}</span>
                  </div>
                  <button className={s.verTodas} onClick={proximamente}>Ver todas ›</button>
                </div>
                <p className={s.propSub}>Brechas de conocimiento detectadas desde otros procedimientos.</p>
                <div className={s.propGrid}>
                  {data.propuestos.slice(0, 4).map((p) => (
                    <div className={s.propCard} key={p.id}>
                      <div className={s.propIcon}><GitBranch size={18} /></div>
                      <div className={s.propBody}>
                        <b>{p.nombre}</b>
                        <div className={s.propMeta}>Detectado desde: <em>{p.origen}</em></div>
                        {p.condicion && <div className={s.propMeta}>Motivo: {p.condicion}</div>}
                        {p.fecha && <div className={s.propFecha}><Calendar size={12} />{p.fecha}</div>}
                      </div>
                      <button className={s.propBtn} onClick={proximamente}>Crear y asignar</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {modalAbierto && (
        <AsignarProcedimientoModal onClose={() => setModalAbierto(false)} onAsignado={alAsignar} />
      )}
    </div>
  );
}
