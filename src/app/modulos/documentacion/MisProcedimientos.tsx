"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen, ArrowLeft, Search, Calendar, FileText, Pencil, Eye, CheckCircle2,
  AlertTriangle, Clock, ChevronLeft, ChevronRight, MoreVertical, User,
} from "lucide-react";
import type { MisProcedimientosData, MiProcedimientoFila } from "@/lib/documentacion-tipos";
import { ESTADO_ASESORA_LABEL, accionPorEstado } from "@/lib/documentacion-tipos";
import s from "./documentacion.module.css";

const PAGE_SIZE = 5;

const TONO: Record<string, { badge: string; bar: string; Icon: typeof Clock }> = {
  pendiente: { badge: s.neutral, bar: s.slateBar, Icon: Clock },
  en_elaboracion: { badge: s.amber, bar: s.amberBar, Icon: Pencil },
  en_revision: { badge: s.violetBadge, bar: s.violetBar, Icon: Eye },
  correccion_requerida: { badge: s.redStrong, bar: s.redBar, Icon: AlertTriangle },
  aprobado: { badge: s.green, bar: s.greenBar, Icon: CheckCircle2 },
  archivado: { badge: s.neutral, bar: s.slateBar, Icon: Clock },
};

function accionClase(estado: string): string {
  if (estado === "correccion_requerida") return s.accionDanger;
  if (estado === "pendiente" || estado === "en_elaboracion") return s.accionPrimary;
  return s.accionGhost;
}

function iniciales(t: string): string {
  const p = t.trim().split(/\s+/);
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

type Orden = "recientes" | "limite" | "progreso";

export default function MisProcedimientos({
  datosIniciales,
  errorInicial,
}: {
  datosIniciales: MisProcedimientosData | null;
  errorInicial: string | null;
}) {
  const data = datosIniciales;
  const [busqueda, setBusqueda] = useState("");
  const [fApp, setFApp] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    if (!data) return [] as MiProcedimientoFila[];
    const q = busqueda.trim().toLowerCase();
    const arr = data.procedimientos.filter((p) => {
      if (q && !p.titulo.toLowerCase().includes(q) && !p.descripcion.toLowerCase().includes(q)) return false;
      if (fApp && p.aplicativo !== fApp) return false;
      if (fEstado && p.estado !== fEstado) return false;
      return true;
    });
    const ordenado = [...arr];
    if (orden === "recientes") {
      ordenado.sort((a, b) => (b.fechaAsignacionTs ?? 0) - (a.fechaAsignacionTs ?? 0));
    } else if (orden === "limite") {
      ordenado.sort((a, b) => (a.fechaLimiteTs ?? Infinity) - (b.fechaLimiteTs ?? Infinity));
    } else {
      ordenado.sort((a, b) => b.progresoPct - a.progresoPct);
    }
    return ordenado;
  }, [data, busqueda, fApp, fEstado, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const visibles = filtrados.slice(inicio, inicio + PAGE_SIZE);

  function reset(setter: (v: string) => void, v: string) {
    setter(v);
    setPagina(1);
  }

  const kpis = data
    ? [
        { label: "Pendientes", value: data.kpi.pendientes, Icon: FileText, bg: s.slateBg, bar: s.slateBar },
        { label: "En elaboración", value: data.kpi.enElaboracion, Icon: Pencil, bg: s.amberBg, bar: s.amberBar },
        { label: "Por revisar", value: data.kpi.porRevisar, Icon: Eye, bg: s.violetBg, bar: s.violetBar },
        { label: "Corrección requerida", value: data.kpi.correccionRequerida, Icon: AlertTriangle, bg: s.redBg, bar: s.redBar },
        { label: "Aprobados", value: data.kpi.aprobados, Icon: CheckCircle2, bg: s.greenBg, bar: s.greenBar },
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
            <p>Documenta, consulta y da seguimiento a tus procedimientos asignados.</p>
            <span className={s.misPill}><User size={13} /> Mis procedimientos</span>
          </div>
        </header>

        {errorInicial && <div className={s.banner}>{errorInicial}</div>}

        {data && (
          <>
            <div className={`${s.kpis} ${s.kpis5}`}>
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
              <div className={s.cardHead}><h2>Mis procedimientos</h2></div>

              {sinProcedimientos ? (
                <div className={s.empty}>
                  <div className={s.emptyIcon}><BookOpen size={26} /></div>
                  <p>Aún no tienes procedimientos asignados.</p>
                </div>
              ) : (
                <>
                  <div className={s.searchRow4}>
                    <div className={s.search}>
                      <Search size={16} />
                      <input placeholder="Buscar procedimiento..." value={busqueda} onChange={(e) => reset(setBusqueda, e.target.value)} />
                    </div>
                    <select className={s.select} value={fApp} onChange={(e) => reset(setFApp, e.target.value)}>
                      <option value="">Todos los aplicativos</option>
                      {data.aplicativos.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className={s.select} value={fEstado} onChange={(e) => reset(setFEstado, e.target.value)}>
                      <option value="">Todos los estados</option>
                      {data.estados.map((e) => <option key={e} value={e}>{ESTADO_ASESORA_LABEL[e] ?? e}</option>)}
                    </select>
                    <select className={s.select} value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
                      <option value="recientes">Más recientes</option>
                      <option value="limite">Fecha límite</option>
                      <option value="progreso">Progreso</option>
                    </select>
                  </div>

                  <div className={s.tableWrap}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th>Procedimiento</th><th>Aplicativo</th><th>Estado</th><th>Progreso</th><th>Fecha límite</th><th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.length > 0 ? visibles.map((p) => {
                          const tono = TONO[p.estado] ?? TONO.pendiente;
                          const BadgeIcon = tono.Icon;
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className={s.procRow}>
                                  <span className={s.procAvatar}>{iniciales(p.titulo)}</span>
                                  <div>
                                    <div className={s.procName}>{p.titulo}</div>
                                    {p.descripcion && <div className={s.procDesc}>{p.descripcion}</div>}
                                  </div>
                                </div>
                              </td>
                              <td>{p.aplicativo}</td>
                              <td>
                                <span className={`${s.badge} ${tono.badge}`}><BadgeIcon size={13} />{ESTADO_ASESORA_LABEL[p.estado] ?? p.estado}</span>
                              </td>
                              <td>
                                <div className={s.prog}>
                                  <div className={s.progText}>
                                    <span>{p.progresoCompletadas} de 8 completadas</span>
                                    <b>{p.progresoPct}%</b>
                                  </div>
                                  <div className={s.progBar}><div className={`${s.progBarFill} ${tono.bar}`} style={{ width: `${p.progresoPct}%` }} /></div>
                                </div>
                              </td>
                              <td>
                                {p.fechaLimite ? (
                                  <span className={s.fecha}><Calendar size={13} />{p.fechaLimite}</span>
                                ) : (
                                  <span className={s.dash}>—</span>
                                )}
                              </td>
                              <td>
                                <div className={s.acciones}>
                                  <Link href={`/modulos/documentacion/${p.id}`} className={`${s.accionBtn} ${accionClase(p.estado)}`}>
                                    {accionPorEstado(p.estado)}
                                  </Link>
                                  <Link href={`/modulos/documentacion/${p.id}`} className={s.iconBtn} title="Abrir"><MoreVertical size={15} /></Link>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan={6} className={s.empty}><p>No hay procedimientos para estos filtros.</p></td></tr>
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
          </>
        )}
      </div>
    </div>
  );
}
