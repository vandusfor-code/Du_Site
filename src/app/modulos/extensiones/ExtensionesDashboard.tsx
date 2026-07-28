"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Download,
  Plus,
  Phone,
  Users,
  UserRound,
  Clock3,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { agruparPorExtension, calcularKpis } from "@/lib/extensiones-tipos";
import type { ExtensionesData, ExtensionGrupo } from "@/lib/extensiones-tipos";
import s from "./extensiones.module.css";

type ColumnaOrden = "extension" | "nombre" | "cargo" | "area";
type Direccion = "asc" | "desc";

const FILAS_POR_PAGINA_OPCIONES = [10, 20, 50];

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: typeof Phone;
  label: string;
  value: number | null;
  trend?: string;
}) {
  return (
    <article className={s.stat}>
      <div className={s.icon}>
        <Icon />
      </div>
      <div>
        <span>{label}</span>
        <div className={s.statLine}>
          <strong>{value === null ? "—" : value}</strong>
          {value !== null && trend ? (
            <small>
              <b>{trend}</b>
              <em>vs mes anterior</em>
            </small>
          ) : value === null ? (
            <small>
              <em className={s.pendiente}>Pendiente de conectar</em>
            </small>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EstadoBadge({ estado }: { estado?: "activa" | "inactiva" }) {
  if (!estado) return <span className={`${s.badge} ${s.sinDato}`}>Sin dato</span>;
  if (estado === "activa") return <span className={`${s.badge} ${s.activa}`}><i />Activa</span>;
  return <span className={`${s.badge} ${s.inactiva}`}><i />Inactiva</span>;
}

function UsoBadge({ uso }: { uso?: "en_uso" | "disponible" }) {
  if (!uso) return <span className={`${s.badge} ${s.sinDato}`}>Sin dato</span>;
  if (uso === "en_uso") return <span className={`${s.badge} ${s.usada}`}>En uso</span>;
  return <span className={`${s.badge} ${s.disponible}`}>Disponible</span>;
}

function SortHeader({
  label,
  columna,
  ordenColumna,
  ordenDireccion,
  onSort,
}: {
  label: string;
  columna: ColumnaOrden;
  ordenColumna: ColumnaOrden | null;
  ordenDireccion: Direccion;
  onSort: (c: ColumnaOrden) => void;
}) {
  const activa = ordenColumna === columna;
  return (
    <th>
      <button type="button" className={s.thSort} onClick={() => onSort(columna)}>
        {label}
        <ArrowUpDown size={12} className={activa ? (ordenDireccion === "desc" ? s.sortDesc : s.sortAsc) : undefined} />
      </button>
    </th>
  );
}

export default function ExtensionesDashboard({
  datosIniciales,
  errorInicial,
}: {
  datosIniciales: ExtensionesData | null;
  errorInicial: string | null;
}) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("Todas");
  const [estado, setEstado] = useState("Todos");
  const [uso, setUso] = useState("Todos");
  const [pagina, setPagina] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);
  const [ordenColumna, setOrdenColumna] = useState<ColumnaOrden | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<Direccion>("asc");

  const grupos = useMemo(() => agruparPorExtension(datosIniciales?.registros ?? []), [datosIniciales]);
  const kpis = useMemo(() => calcularKpis(grupos), [grupos]);
  const areas = useMemo(() => ["Todas", ...Array.from(new Set(grupos.map((g) => g.area).filter(Boolean)))], [grupos]);

  function ordenar(c: ColumnaOrden) {
    if (ordenColumna === c) {
      setOrdenDireccion((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrdenColumna(c);
      setOrdenDireccion("asc");
    }
  }

  const filasVisibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    let rows = grupos.filter((g) => {
      const nombres = g.personas.map((p) => `${p.nombre} ${p.cargo}`).join(" ");
      const coincide = `${g.extension} ${g.area} ${nombres}`.toLowerCase().includes(texto);
      const areaOk = area === "Todas" || g.area === area;
      const estadoOk = estado === "Todos" || g.estado === (estado === "activa" ? "activa" : "inactiva");
      const usoOk = uso === "Todos" || g.uso === (uso === "en_uso" ? "en_uso" : "disponible");
      return coincide && areaOk && estadoOk && usoOk;
    });

    if (ordenColumna) {
      const campo = (g: ExtensionGrupo): string => {
        if (ordenColumna === "extension") return g.extension;
        if (ordenColumna === "area") return g.area;
        if (ordenColumna === "nombre") return g.personas[0]?.nombre ?? "";
        return g.personas[0]?.cargo ?? "";
      };
      rows = [...rows].sort((a, b) => {
        const cmp = campo(a).localeCompare(campo(b), "es");
        return ordenDireccion === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [grupos, q, area, estado, uso, ordenColumna, ordenDireccion]);

  const totalPaginas = Math.max(1, Math.ceil(filasVisibles.length / filasPorPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * filasPorPagina;
  const filasPagina = filasVisibles.slice(inicio, inicio + filasPorPagina);

  const paginasVisibles = useMemo(() => {
    const ventana = 5;
    let desde = Math.max(1, paginaActual - Math.floor(ventana / 2));
    const hasta = Math.min(totalPaginas, desde + ventana - 1);
    desde = Math.max(1, hasta - ventana + 1);
    const arr: number[] = [];
    for (let i = desde; i <= hasta; i++) arr.push(i);
    return arr;
  }, [paginaActual, totalPaginas]);

  return (
    <main className={s.page}>
      <div className={s.shell}>
        <Link href="/" className={s.back}>
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <header className={s.head}>
          <div>
            <h1>Extensiones</h1>
            <p>Gestiona y consulta las extensiones telefónicas disponibles en la organización.</p>
          </div>
          <button className={s.outline} type="button">
            <Download size={17} /> Exportar Excel
          </button>
        </header>

        {errorInicial && (
          <div className={s.errorBanner}>
            <AlertTriangle size={16} /> {errorInicial}
          </div>
        )}

        {datosIniciales && !datosIniciales.conectado && (
          <div className={s.avisoDemo}>
            Mostrando datos de ejemplo — todavía no se ha conectado la fuente real de Extensiones.
          </div>
        )}

        <section className={s.stats}>
          <StatCard icon={Phone} label="Extensiones activas" value={kpis.activas ?? kpis.total} />
          <StatCard icon={Users} label="En uso" value={kpis.enUso} />
          <StatCard icon={UserRound} label="Disponibles" value={kpis.disponibles} />
          <StatCard icon={Clock3} label="Sin uso (inactivas)" value={kpis.inactivas} />
        </section>

        <section className={s.panel}>
          <div className={s.toolbar}>
            <label className={s.search}>
              <Search size={18} />
              <input
                placeholder="Buscar por extensión, cargo, nombre o área..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPagina(1);
                }}
              />
            </label>
            <label>
              Área
              <select value={area} onChange={(e) => { setArea(e.target.value); setPagina(1); }}>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
                <option value="Todos">Todos</option>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
              </select>
            </label>
            <label>
              Uso
              <select value={uso} onChange={(e) => { setUso(e.target.value); setPagina(1); }}>
                <option value="Todos">Todos</option>
                <option value="en_uso">En uso</option>
                <option value="disponible">Disponible</option>
              </select>
            </label>
            <button className={s.primary} type="button">
              <Plus size={17} /> Nueva extensión
            </button>
          </div>

          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <SortHeader label="EXTENSIÓN" columna="extension" ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onSort={ordenar} />
                  <SortHeader label="NOMBRE" columna="nombre" ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onSort={ordenar} />
                  <SortHeader label="CARGO" columna="cargo" ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onSort={ordenar} />
                  <SortHeader label="ÁREA" columna="area" ordenColumna={ordenColumna} ordenDireccion={ordenDireccion} onSort={ordenar} />
                  <th>HORARIO DE ATENCIÓN</th>
                  <th>ESTADO</th>
                  <th>USO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={s.vacio}>
                      No se encontraron extensiones con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filasPagina.map((g) => (
                    <tr key={g.extension}>
                      <td><strong>{g.extension}</strong></td>
                      <td>{g.personas.map((p, i) => <div key={i}>{p.nombre || "—"}</div>)}</td>
                      <td>{g.personas.map((p, i) => <div key={i}>{p.cargo || "—"}</div>)}</td>
                      <td>{g.area}</td>
                      <td>{g.horario.length ? g.horario.map((h, i) => <div key={i}>{h}</div>) : "—"}</td>
                      <td><EstadoBadge estado={g.estado} /></td>
                      <td><UsoBadge uso={g.uso} /></td>
                      <td>
                        <button className={s.more} type="button" aria-label="Más acciones">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer>
            <span>
              Mostrando {filasVisibles.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + filasPorPagina, filasVisibles.length)} de {filasVisibles.length} extensiones
            </span>
            <div className={s.pages}>
              <button type="button" disabled={paginaActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} />
              </button>
              {paginasVisibles.map((p) => (
                <button key={p} type="button" className={p === paginaActual ? s.current : undefined} onClick={() => setPagina(p)}>
                  {p}
                </button>
              ))}
              <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
            <label>
              Filas por página:
              <select
                value={filasPorPagina}
                onChange={(e) => {
                  setFilasPorPagina(Number(e.target.value));
                  setPagina(1);
                }}
              >
                {FILAS_POR_PAGINA_OPCIONES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </footer>
        </section>
      </div>
    </main>
  );
}
