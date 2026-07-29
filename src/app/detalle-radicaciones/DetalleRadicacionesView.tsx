"use client";

import "./detalle-radicaciones.css";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Download, Filter, Info, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, FolderOpen, Loader2 } from "lucide-react";
import type { DetalleRadicaciones, DetalleAsesora } from "@/lib/radicaciones";
import { filtrarDetalleAction } from "./actions";

type Periodo = "hoy" | "ayer" | "7d" | "rango";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtCorta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[3]}/${+m[2]}` : iso;
}

type ColOrden = "nombre" | "total" | "exitosas" | "devueltas" | "sinGestion" | "eficiencia" | "ultimaActividad";
type Dir = "asc" | "desc";

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const FILAS_OPCIONES = [10, 20, 50];

function hoyLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${MESES_ABR[d.getMonth()]} ${d.getFullYear()}`;
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: "green" | "red" }) {
  return (
    <div className="dr-metric">
      <b>{value}</b>
      <span className={tone ? `dr-${tone}` : ""}>{label}</span>
    </div>
  );
}

function Th({ label, col, orden, dir, onSort, tone, align }: { label: string; col: ColOrden; orden: ColOrden | null; dir: Dir; onSort: (c: ColOrden) => void; tone?: "green" | "red"; align?: "left" }) {
  const activo = orden === col;
  return (
    <th className={align === "left" ? "" : "dr-num"}>
      <button type="button" className={`dr-th ${tone ? `dr-${tone}` : ""}`} onClick={() => onSort(col)}>
        {label}
        {activo ? (dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronUp size={12} className="dr-thIdle" />}
      </button>
    </th>
  );
}

export default function DetalleRadicacionesView({ datosIniciales, errorInicial }: { datosIniciales: DetalleRadicaciones | null; errorInicial: string | null }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [devuelto, setDevuelto] = useState("todos");
  const [orden, setOrden] = useState<ColOrden | null>("total");
  const [dir, setDir] = useState<Dir>("desc");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState(10);

  const [fecha] = useState(hoyLabel);

  // Filtro por rango de fechas (Hoy / Ayer / Últimos 7 días / rango personalizado).
  const [datos, setDatos] = useState(datosIniciales);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function aplicar(p: Periodo, desde?: string, hasta?: string) {
    setCargando(true);
    setMenuAbierto(false);
    try {
      const res = await filtrarDetalleAction(desde, hasta);
      setDatos(res);
      setPeriodo(p);
      setPagina(1);
    } finally {
      setCargando(false);
    }
  }

  function seleccionar(p: Exclude<Periodo, "rango">) {
    const hoy = new Date();
    if (p === "hoy") aplicar("hoy", ymd(hoy), ymd(hoy));
    else if (p === "ayer") {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      aplicar("ayer", ymd(ayer), ymd(ayer));
    } else {
      const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - 6);
      aplicar("7d", ymd(inicio), ymd(hoy));
    }
  }

  const periodoLabel = periodo === "hoy" ? "Hoy" : periodo === "ayer" ? "Ayer" : periodo === "rango" ? `${fmtCorta(rangoDesde)} – ${fmtCorta(rangoHasta)}` : "Últimos 7 días";

  const resumen = datos?.resumen ?? { totalRadicadas: 0, pendientes: 0, exitosas: 0, devueltas: 0, sinGestion: 0 };
  const dias = datos?.dias ?? [];
  const asesoras = useMemo(() => datos?.asesoras ?? [], [datos]);
  const maxBar = Math.max(...dias.map((d) => d.valor), 1);

  function sort(c: ColOrden) {
    if (orden === c) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrden(c);
      setDir(c === "nombre" ? "asc" : "desc");
    }
  }

  const filtradas = useMemo(() => {
    const texto = q.trim().toLowerCase();
    let rows = asesoras.filter((a) => {
      const coincide = a.nombre.toLowerCase().includes(texto);
      const estadoOk = estado === "todos" || (estado === "completas" ? a.sinGestion === 0 : a.sinGestion > 0);
      const devueltoOk = devuelto === "todos" || (devuelto === "si" ? a.devueltas > 0 : a.devueltas === 0);
      return coincide && estadoOk && devueltoOk;
    });
    if (orden) {
      const val = (a: DetalleAsesora) => (orden === "nombre" || orden === "ultimaActividad" ? a[orden] : (a[orden] as number));
      rows = [...rows].sort((x, y) => {
        const vx = val(x), vy = val(y);
        const cmp = typeof vx === "number" && typeof vy === "number" ? vx - vy : String(vx).localeCompare(String(vy), "es");
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [asesoras, q, estado, devuelto, orden, dir]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / filas));
  const pagActual = Math.min(pagina, totalPaginas);
  const inicio = (pagActual - 1) * filas;
  const visibles = filtradas.slice(inicio, inicio + filas);

  function exportarCsv() {
    const encabezados = ["Asesora", "Total radicadas", "Exitosas", "Devueltas", "Sin gestión", "Eficiencia (%)", "Última actividad"];
    const filasCsv = filtradas.map((a) => [a.nombre, a.total, a.exitosas, a.devueltas, a.sinGestion, a.eficiencia, a.ultimaActividad]);
    const csv = [encabezados, ...filasCsv]
      .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "detalle-radicaciones.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="dr-page">
      <div className="dr-top">
        <Link href="/" className="dr-back"><ArrowLeft size={17} /> Volver</Link>
        <span className="dr-fecha"><CalendarDays size={15} /> {fecha}</span>
      </div>

      <header className="dr-head">
        <div>
          <h1>Detalle de radicaciones por asesoras</h1>
          <p>Consulta el desempeño individual de radicación en los últimos días.</p>
        </div>
        <div className="dr-actions">
          <div className="dr-periodo" ref={menuRef}>
            <button type="button" className="dr-outline" onClick={() => setMenuAbierto((v) => !v)} aria-expanded={menuAbierto}>
              {cargando ? <Loader2 size={16} className="dr-spin" /> : <CalendarDays size={16} />} {periodoLabel} <ChevronDown size={15} />
            </button>
            {menuAbierto && (
              <div className="dr-menu">
                <button type="button" className={periodo === "hoy" ? "dr-menuOn" : ""} onClick={() => seleccionar("hoy")}>Hoy</button>
                <button type="button" className={periodo === "ayer" ? "dr-menuOn" : ""} onClick={() => seleccionar("ayer")}>Ayer</button>
                <button type="button" className={periodo === "7d" ? "dr-menuOn" : ""} onClick={() => seleccionar("7d")}>Últimos 7 días</button>
                <div className="dr-menuSep" />
                <div className="dr-rango">
                  <span>Rango personalizado</span>
                  <label>Desde<input type="date" value={rangoDesde} max={rangoHasta || undefined} onChange={(e) => setRangoDesde(e.target.value)} /></label>
                  <label>Hasta<input type="date" value={rangoHasta} min={rangoDesde || undefined} onChange={(e) => setRangoHasta(e.target.value)} /></label>
                  <button type="button" className="dr-aplicar" disabled={!rangoDesde || !rangoHasta} onClick={() => aplicar("rango", rangoDesde, rangoHasta)}>Aplicar</button>
                </div>
              </div>
            )}
          </div>
          <button type="button" className="dr-outline" onClick={exportarCsv}><Download size={16} /> Exportar</button>
        </div>
      </header>

      {errorInicial && (
        <div className="dr-error"><AlertTriangle size={16} /> {errorInicial}</div>
      )}

      <section className="dr-summary">
        <div className="dr-summaryLeft">
          <h3><span className="dr-sumIcon"><FolderOpen size={18} /></span> Resumen general · {periodoLabel}</h3>
          <div className="dr-metrics">
            <Metric value={resumen.totalRadicadas} label="Total radicadas" />
            <Metric value={resumen.pendientes} label="Pendientes" />
            <Metric value={resumen.exitosas} label="Exitosas" tone="green" />
            <Metric value={resumen.devueltas} label="Devueltas" tone="red" />
            <Metric value={resumen.sinGestion} label="Sin gestión" />
          </div>
        </div>
        <div className="dr-divider" />
        <div className="dr-chart">
          {dias.map((d, i) => (
            <div className="dr-barCol" key={i}>
              <b>{d.valor}</b>
              <div className="dr-barSpace">
                <span className={d.esHoy ? "dr-barHoy" : "dr-bar"} style={{ height: `${Math.max((d.valor / maxBar) * 96, d.valor ? 8 : 2)}px` }} />
              </div>
              <small className={d.esHoy ? "dr-barLabelHoy" : ""}>{d.fecha}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="dr-tableCard">
        <h2>Desempeño por asesora</h2>
        <div className="dr-toolbar">
          <label className="dr-search">
            <Search size={17} />
            <input placeholder="Buscar asesora..." value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
          </label>
          <label className="dr-selWrap">
            <span>Estado</span>
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
              <option value="todos">Todos</option>
              <option value="completas">Sin pendientes</option>
              <option value="con_sin_gestion">Con sin gestión</option>
            </select>
          </label>
          <label className="dr-selWrap">
            <span>¿Devuelto?</span>
            <select value={devuelto} onChange={(e) => { setDevuelto(e.target.value); setPagina(1); }}>
              <option value="todos">Todos</option>
              <option value="si">Con devueltas</option>
              <option value="no">Sin devueltas</option>
            </select>
          </label>
          <button type="button" className="dr-filtros" onClick={() => { setQ(""); setEstado("todos"); setDevuelto("todos"); setPagina(1); }}>
            <Filter size={16} /> Filtros
          </button>
        </div>

        <div className="dr-tableWrap">
          <table>
            <thead>
              <tr>
                <Th label="ASESORA" col="nombre" orden={orden} dir={dir} onSort={sort} align="left" />
                <Th label="TOTAL RADICADAS" col="total" orden={orden} dir={dir} onSort={sort} />
                <Th label="EXITOSAS" col="exitosas" orden={orden} dir={dir} onSort={sort} tone="green" />
                <Th label="DEVUELTAS" col="devueltas" orden={orden} dir={dir} onSort={sort} tone="red" />
                <Th label="SIN GESTIÓN" col="sinGestion" orden={orden} dir={dir} onSort={sort} />
                <Th label="EFICIENCIA" col="eficiencia" orden={orden} dir={dir} onSort={sort} />
                <Th label="ÚLTIMA ACTIVIDAD" col="ultimaActividad" orden={orden} dir={dir} onSort={sort} />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td className="dr-empty" colSpan={7}>{asesoras.length === 0 ? "Aún no hay radicaciones en los últimos días." : "No se encontraron asesoras con estos filtros."}</td></tr>
              ) : (
                visibles.map((a) => (
                  <tr key={a.nombre}>
                    <td>
                      <div className="dr-person">
                        <i>{a.inicial}</i>
                        <b>{a.nombre}</b>
                        {a.esUsuario && <small>Tú</small>}
                      </div>
                    </td>
                    <td className="dr-num">{a.total}</td>
                    <td className="dr-num dr-green">{a.exitosas}</td>
                    <td className="dr-num dr-red">{a.devueltas}</td>
                    <td className="dr-num">{a.sinGestion}</td>
                    <td className="dr-num">
                      <div className="dr-eff">
                        <span><i style={{ width: `${a.eficiencia}%` }} /></span>
                        <b>{a.eficiencia}%</b>
                      </div>
                    </td>
                    <td className="dr-ultima">{a.ultimaActividad}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="dr-footer">
          <span>Mostrando {filtradas.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + filas, filtradas.length)} de {filtradas.length} asesoras</span>
          <div className="dr-pages">
            <button type="button" disabled={pagActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></button>
            <b>{pagActual}</b>
            <button type="button" disabled={pagActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}><ChevronRight size={15} /></button>
          </div>
          <label className="dr-rows">
            Filas por página:
            <select value={filas} onChange={(e) => { setFilas(Number(e.target.value)); setPagina(1); }}>
              {FILAS_OPCIONES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </footer>
      </section>

      <aside className="dr-info">
        <Info size={18} />
        <div>
          <b>Información</b>
          <p>Las métricas se actualizan cada 15 minutos. Los datos corresponden a los últimos días (GMT -5).</p>
        </div>
      </aside>
    </main>
  );
}
