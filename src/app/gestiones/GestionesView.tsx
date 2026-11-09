"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Trash2, Loader2, FileText, FolderOpen, Megaphone, AlertTriangle } from "lucide-react";
import type { RegistroRadicacion } from "@/lib/radicaciones";
import type { RegistroPQRSF } from "@/lib/lineaAmiga";
import type { RegistroComunicar } from "@/lib/pqrsf-comunicar";
import { eliminarGestionAction, type TipoGestion } from "./actions";

type Registro = RegistroRadicacion | RegistroPQRSF | RegistroComunicar;

const PAGE = 20;

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function Rad({ v }: { v: string }) {
  return <span style={{ fontWeight: 700, color: "#4f46e5" }}>{v || "—"}</span>;
}
function Nombre({ v }: { v: string }) {
  return <span style={{ fontWeight: 600, color: "#171331" }}>{v || "—"}</span>;
}
function Muted({ v }: { v: string }) {
  return (
    <span style={{ display: "block", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#66708a" }} title={v}>
      {v || "—"}
    </span>
  );
}
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, [string, string]> = {
    Exitosa: ["#edfcf3", "#0f8a4a"],
    Devuelta: ["#fff0f1", "#d93142"],
    "Sin gestión": ["#f1f0f7", "#66708a"],
  };
  const [bg, fg] = map[estado] ?? ["#f1f0f7", "#66708a"];
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{estado}</span>;
}
function ComunicadoBadge({ comunicado }: { comunicado: boolean }) {
  const [bg, fg, t] = comunicado ? ["#edfcf3", "#0f8a4a", "Comunicado"] : ["#fff4e0", "#b26a00", "Por comunicar"];
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{t}</span>;
}

interface Col {
  label: string;
  render: (r: Registro) => ReactNode;
}
interface Conf {
  titulo: string;
  Icon: typeof FileText;
  placeholder: string;
  buscar: (r: Registro) => string;
  nombre: (r: Registro) => string;
  cols: Col[];
}

const CONFIG: Record<TipoGestion, Conf> = {
  pqrsf: {
    titulo: "PQRSF registrados",
    Icon: FileText,
    placeholder: "Buscar por radicado, agente, caso…",
    buscar: (r) => { const x = r as RegistroPQRSF; return `${x.radicado} ${x.agente} ${x.caso} ${x.clasificacion}`; },
    nombre: (r) => (r as RegistroPQRSF).agente,
    cols: [
      { label: "Fecha", render: (r) => r.fecha },
      { label: "Agente", render: (r) => <Nombre v={(r as RegistroPQRSF).agente} /> },
      { label: "Radicado", render: (r) => <Rad v={r.radicado} /> },
      { label: "Clasificación", render: (r) => <Muted v={(r as RegistroPQRSF).clasificacion} /> },
      { label: "Dirige a", render: (r) => <Muted v={(r as RegistroPQRSF).dirige} /> },
    ],
  },
  radicaciones: {
    titulo: "Radicaciones registradas",
    Icon: FolderOpen,
    placeholder: "Buscar por radicado, asesora, estado…",
    buscar: (r) => { const x = r as RegistroRadicacion; return `${x.radicado} ${x.asesora} ${x.estado}`; },
    nombre: (r) => (r as RegistroRadicacion).asesora,
    cols: [
      { label: "Fecha", render: (r) => r.fecha },
      { label: "Asesora", render: (r) => <Nombre v={(r as RegistroRadicacion).asesora} /> },
      { label: "Radicado", render: (r) => <Rad v={r.radicado} /> },
      { label: "Estado", render: (r) => <EstadoBadge estado={(r as RegistroRadicacion).estado} /> },
      { label: "Observación", render: (r) => <Muted v={(r as RegistroRadicacion).observacion} /> },
    ],
  },
  "por-comunicar": {
    titulo: "PQRSF por comunicar",
    Icon: Megaphone,
    placeholder: "Buscar por radicado, nombre, empresa…",
    buscar: (r) => { const x = r as RegistroComunicar; return `${x.radicado} ${x.nombre} ${x.empresa} ${x.telefono}`; },
    nombre: (r) => (r as RegistroComunicar).nombre,
    cols: [
      { label: "Fecha", render: (r) => r.fecha || "—" },
      { label: "Nombre", render: (r) => <Nombre v={(r as RegistroComunicar).nombre} /> },
      { label: "Radicado", render: (r) => <Rad v={r.radicado} /> },
      { label: "Empresa", render: (r) => <Muted v={(r as RegistroComunicar).empresa} /> },
      { label: "Estado", render: (r) => <ComunicadoBadge comunicado={(r as RegistroComunicar).comunicado} /> },
    ],
  },
};

export default function GestionesView({
  tipo,
  registrosIniciales,
  errorInicial,
}: {
  tipo: TipoGestion;
  registrosIniciales: Registro[];
  errorInicial: string | null;
}) {
  const [registros, setRegistros] = useState<Registro[]>(registrosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aEliminar, setAEliminar] = useState<Registro | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [snap, setSnap] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);

  const conf = CONFIG[tipo];
  const Icon = conf.Icon;

  // Resumen comunicado/faltante (solo por-comunicar).
  const resumenComunicar = useMemo(() => {
    if (tipo !== "por-comunicar") return null;
    let com = 0;
    for (const r of registros) if ((r as RegistroComunicar).comunicado) com++;
    return { comunicados: com, faltantes: registros.length - com };
  }, [registros, tipo]);

  const filtrados = useMemo(() => {
    const q = norm(busqueda);
    if (!q) return registros;
    return registros.filter((r) => norm(conf.buscar(r)).includes(q));
  }, [registros, busqueda, conf]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE;
  const pageRows = filtrados.slice(inicio, inicio + PAGE);

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    setSnap(null);
    const rad = aEliminar.radicado;
    try {
      const r = await eliminarGestionAction(tipo, rad);
      if (r.ok) {
        setRegistros((prev) => prev.filter((x) => x.radicado !== rad));
        setSnap({ tipo: "ok", msg: `Registro ${rad} eliminado.` });
        setAEliminar(null);
      } else {
        setSnap({ tipo: "error", msg: r.error ?? "No se pudo eliminar" });
      }
    } catch {
      setSnap({ tipo: "error", msg: "No se pudo eliminar. Revisa la conexión." });
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", colorScheme: "light", padding: "28px 20px 60px" }}>
      <style>{`@keyframes gspin{to{transform:rotate(360deg)}} .spin{animation:gspin .8s linear infinite}`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <Link href="/" style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 11, background: "#fff", color: "#4f46e5", border: "1px solid #e9eaf1", flex: "none" }} aria-label="Volver al inicio">
            <ArrowLeft size={18} />
          </Link>
          <div style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "#ede9fe", color: "#6d28d9", flex: "none" }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#171331" }}>{conf.titulo}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#66708a" }}>
              {filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}
              {busqueda ? ` (de ${registros.length})` : ""}
              {resumenComunicar ? ` · ${resumenComunicar.comunicados} comunicados, ${resumenComunicar.faltantes} por comunicar` : " · del más reciente al más antiguo"}
            </p>
          </div>
        </div>

        {errorInicial && <div style={banner("#fff0f1", "#d93142", "#ffd4d2")}>{errorInicial}</div>}
        {snap && (
          <div style={snap.tipo === "ok" ? banner("#edfcf3", "#0f8a4a", "#bff0d3") : banner("#fff0f1", "#d93142", "#ffd4d2")}>{snap.msg}</div>
        )}

        {/* Búsqueda */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e9eaf1", borderRadius: 12, padding: "10px 14px", margin: "16px 0" }}>
          <Search size={16} color="#66708a" />
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder={conf.placeholder}
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent", color: "#171331" }}
          />
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", border: "1px solid #e9eaf1", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#f7f7fb", color: "#66708a", textAlign: "left" }}>
                  {conf.cols.map((c) => <th key={c.label} style={th}>{c.label}</th>)}
                  <th style={{ ...th, textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={conf.cols.length + 1} style={{ padding: "28px 14px", textAlign: "center", color: "#66708a" }}>
                      No hay registros para mostrar.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, i) => (
                    <tr key={r.radicado + i} style={{ borderTop: "1px solid #f0f0f5" }}>
                      {conf.cols.map((c) => <td key={c.label} style={td}>{c.render(r)}</td>)}
                      <td style={{ ...td, textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setAEliminar(r)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #ffd4d2", background: "#fff5f5", color: "#d93142", borderRadius: 9, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                        >
                          <Trash2 size={13} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #f0f0f5" }}>
              <span style={{ fontSize: 12.5, color: "#66708a" }}>Mostrando {inicio + 1}–{inicio + pageRows.length} de {filtrados.length}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button type="button" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual <= 1} style={pageBtn(paginaActual <= 1)}>‹</button>
                <span style={{ fontSize: 13, color: "#171331", padding: "6px 10px", fontWeight: 700 }}>{paginaActual} / {totalPaginas}</span>
                <button type="button" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas} style={pageBtn(paginaActual >= totalPaginas)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmación de eliminación */}
      {aEliminar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(23,19,49,.5)" }} onClick={() => !eliminando && setAEliminar(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: "24px 22px", boxShadow: "0 24px 60px rgba(23,19,49,.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "#fff0f1", color: "#d93142", flex: "none" }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#171331" }}>Eliminar registro</h3>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 14, color: "#4a4a63", lineHeight: 1.5 }}>
              Vas a eliminar el radicado <b style={{ color: "#171331" }}>{aEliminar.radicado}</b>
              {conf.nombre(aEliminar) ? ` de ${conf.nombre(aEliminar)}` : ""}.
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#d93142", fontWeight: 600 }}>
              Esta acción elimina la fila de la hoja y <b>no se puede deshacer</b>.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setAEliminar(null)} disabled={eliminando} style={{ border: "1px solid #e9eaf1", background: "#fff", color: "#4a4a63", borderRadius: 11, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmarEliminar} disabled={eliminando} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "#d93142", color: "#fff", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                {eliminando ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: CSSProperties = { padding: "11px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "11px 14px", color: "#2f2f3a", verticalAlign: "middle" };
function banner(bg: string, fg: string, border: string): CSSProperties {
  return { marginTop: 14, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, background: bg, color: fg, border: `1px solid ${border}` };
}
function pageBtn(disabled: boolean): CSSProperties {
  return { border: "1px solid #e9eaf1", background: "#fff", color: disabled ? "#c3c9d6" : "#4f46e5", borderRadius: 9, padding: "6px 12px", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer" };
}
