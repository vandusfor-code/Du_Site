"use client";

import "./radicaciones.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Send, Plus, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Users, ChevronLeft, X } from "lucide-react";
import {
  obtenerAsesoresAction,
  buscarGeneralAction,
  obtenerSNCTodasAction,
  registrarSNCAsignadaAction,
} from "./actions";
import type { Asesor, BusquedaGeneralResultado, SNCEquipo } from "@/lib/radicaciones";
import { esEstadoActivo, type SNCItem } from "@/lib/radicaciones-snc-tipos";
import { estadoClase } from "./RadicacionesDashboard";

type FiltroEstado = "todos" | "pendientes" | "vencidas" | "solucionadas" | "canceladas" | "nocorresponde";

function slaLabel(s: SNCItem): string {
  if (s.sla === "vencida") return `Vencida · ${s.diasHabiles} días háb.`;
  if (s.sla === "vence_hoy") return "Vence hoy";
  return `Quedan ${s.diasRestantes} día${s.diasRestantes === 1 ? "" : "s"} háb.`;
}

export default function RadicacionesAdmin({ nombre }: { nombre: string }) {
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [equipo, setEquipo] = useState<SNCEquipo>({ items: [], totalPendientes: 0, totalVencidas: 0, totalSolucionadas: 0, totalCanceladas: 0, totalNoCorresponde: 0 });

  // Registro
  const [radicado, setRadicado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState<BusquedaGeneralResultado | null | undefined>(undefined);
  const [buscando, setBuscando] = useState(false);
  const [asesoraManual, setAsesoraManual] = useState("");
  const [registrando, setRegistrando] = useState(false);

  // Filtros del panel
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [filtroAsesora, setFiltroAsesora] = useState("todas");
  const [filtroQuery, setFiltroQuery] = useState("");

  const mostrarToast = useCallback((text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshEquipo = useCallback(() => {
    obtenerSNCTodasAction().then(setEquipo).catch(() => {});
  }, []);

  useEffect(() => {
    obtenerAsesoresAction().then(setAsesores).catch(() => {});
    refreshEquipo();
  }, [refreshEquipo]);

  async function buscar() {
    if (!radicado.trim()) return mostrarToast("Escribe un radicado", true);
    setBuscando(true);
    setBusqueda(undefined);
    try {
      const res = await buscarGeneralAction(radicado);
      setBusqueda(res);
      if (res) setAsesoraManual("");
    } catch {
      mostrarToast("No se pudo buscar", true);
    } finally {
      setBuscando(false);
    }
  }

  // Asesora destino: la dueña del radicado si se encontró, o la elegida a mano.
  const asesoraDestino = busqueda?.funcionaria?.trim() || asesoraManual.trim();

  async function registrar() {
    if (!radicado.trim()) return mostrarToast("El radicado es obligatorio", true);
    if (!asesoraDestino) return mostrarToast("Busca el radicado o elige la asesora responsable", true);
    if (!motivo.trim()) return mostrarToast("Describe el motivo de la SNC", true);
    setRegistrando(true);
    try {
      const res = await registrarSNCAsignadaAction(asesoraDestino, radicado, motivo);
      if (res.success) {
        mostrarToast(`SNC asignada a ${asesoraDestino}`);
        setRadicado("");
        setMotivo("");
        setBusqueda(undefined);
        setAsesoraManual("");
        refreshEquipo();
      } else {
        mostrarToast(res.error ?? "No se pudo registrar", true);
      }
    } catch {
      mostrarToast("No se pudo registrar. Intenta de nuevo.", true);
    } finally {
      setRegistrando(false);
    }
  }

  const itemsFiltrados = useMemo(() => {
    const q = filtroQuery.trim().toLowerCase();
    return equipo.items.filter((s) => {
      if (filtroAsesora !== "todas" && s.asesora !== filtroAsesora) return false;
      if (filtroEstado === "pendientes" && !esEstadoActivo(s.estado)) return false;
      if (filtroEstado === "vencidas" && !(esEstadoActivo(s.estado) && s.sla === "vencida")) return false;
      if (filtroEstado === "solucionadas" && s.estado !== "Solucionada") return false;
      if (filtroEstado === "canceladas" && s.estado !== "Cancelada") return false;
      if (filtroEstado === "nocorresponde" && s.estado !== "No corresponde") return false;
      if (q && !`${s.radicado} ${s.motivo} ${s.asesora}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [equipo.items, filtroEstado, filtroAsesora, filtroQuery]);

  return (
    <div className="radic-scope radic-admin">
      <div className={`toast ${toast ? "active" : ""} ${toast?.error ? "error" : ""}`}>{toast?.text}</div>

      <header className="admin-topbar">
        <div>
          <h1><ShieldAlert size={22} /> Gestión de Salidas No Conformes</h1>
          <p>Panel de {nombre} · asigna y supervisa las SNC del equipo</p>
        </div>
        <Link href="/" className="admin-back"><ChevronLeft size={16} /> Inicio</Link>
      </header>

      <div className="admin-container">
        {/* Resumen */}
        <div className="admin-kpis">
          <div className="admin-kpi">
            <span className="admin-kpi-ic"><Clock size={18} /></span>
            <div><b>{equipo.totalPendientes}</b><span>Pendientes</span></div>
          </div>
          <div className={`admin-kpi ${equipo.totalVencidas > 0 ? "danger" : ""}`}>
            <span className="admin-kpi-ic"><AlertTriangle size={18} /></span>
            <div><b>{equipo.totalVencidas}</b><span>Vencidas</span></div>
          </div>
          <div className="admin-kpi">
            <span className="admin-kpi-ic"><CheckCircle2 size={18} /></span>
            <div><b>{equipo.totalSolucionadas}</b><span>Solucionadas</span></div>
          </div>
          <div className="admin-kpi">
            <span className="admin-kpi-ic"><X size={18} /></span>
            <div><b>{equipo.totalNoCorresponde}</b><span>No corresponde</span></div>
          </div>
        </div>

        {/* Registrar / asignar SNC */}
        <div className="section-card">
          <div className="section-header"><h3><Plus size={18} /> Registrar SNC y asignarla</h3></div>
          <div className="admin-register">
            <div className="input-group">
              <label>Código de radicado</label>
              <div className="admin-search-row">
                <input
                  className="input-field"
                  placeholder="PQ-XXXXXXX"
                  value={radicado}
                  onChange={(e) => { setRadicado(e.target.value); setBusqueda(undefined); }}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                />
                <button className="btn-primary admin-search-btn" onClick={buscar} disabled={buscando}>
                  <Search size={16} /> {buscando ? "Buscando..." : "Buscar dueño"}
                </button>
              </div>
            </div>

            {busqueda !== undefined && (
              busqueda ? (
                <div className="admin-owner ok">
                  <Users size={16} />
                  <span>Responsable: <b>{busqueda.funcionaria}</b> · radicado del {busqueda.fecha}</span>
                </div>
              ) : (
                <div className="admin-owner warn">
                  <AlertTriangle size={16} />
                  <span>Ese radicado no está en la base. Elige la asesora responsable manualmente:</span>
                </div>
              )
            )}

            {(busqueda === null) && (
              <div className="input-group">
                <label>Asesora responsable</label>
                <select className="input-field" value={asesoraManual} onChange={(e) => setAsesoraManual(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="input-group">
              <label>Motivo de la salida no conforme</label>
              <textarea
                className="input-field"
                style={{ minHeight: 70, resize: "none" }}
                placeholder="Describe el motivo de la SNC..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <button className="btn-primary admin-register-btn" onClick={registrar} disabled={registrando}>
              <Send size={16} />
              <span>{registrando ? "Registrando..." : asesoraDestino ? `Registrar SNC para ${asesoraDestino}` : "Registrar SNC"}</span>
            </button>
          </div>
        </div>

        {/* Panel del equipo */}
        <div className="section-card">
          <div className="section-header"><h3><Users size={18} /> SNC del equipo</h3><span className="snc-count">{itemsFiltrados.length}</span></div>

          <div className="hist-toolbar">
            <label className="hist-search">
              <Search size={16} />
              <input placeholder="Buscar radicado, motivo o asesora..." value={filtroQuery} onChange={(e) => setFiltroQuery(e.target.value)} />
            </label>
            <select className="hist-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}>
              <option value="todos">Estado · Todos</option>
              <option value="pendientes">Pendientes (activas)</option>
              <option value="vencidas">Vencidas</option>
              <option value="solucionadas">Solucionadas</option>
              <option value="canceladas">Canceladas</option>
              <option value="nocorresponde">No corresponde</option>
            </select>
            <select className="hist-select" value={filtroAsesora} onChange={(e) => setFiltroAsesora(e.target.value)}>
              <option value="todas">Asesora · Todas</option>
              {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>

          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>ASESORA</th>
                  <th>RADICADO</th>
                  <th>MOTIVO</th>
                  <th>ESTADO</th>
                  <th>REGISTRADA</th>
                  <th>CERRADA</th>
                  <th>ASIGNADA POR</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.length === 0 ? (
                  <tr><td className="empty" colSpan={7}>No hay SNC con estos filtros.</td></tr>
                ) : (
                  itemsFiltrados.map((s) => (
                    <tr key={s.fila}>
                      <td><b>{s.asesora}</b></td>
                      <td>{s.radicado}</td>
                      <td>{s.motivo}</td>
                      <td>
                        <span className={`estado-pill ${estadoClase(s.estado)}`}>{s.estado}</span>
                        {esEstadoActivo(s.estado) && (
                          <span className={`snc-badge sla-${s.sla}`} style={{ marginLeft: 6 }}>
                            {s.sla === "vencida" && <AlertTriangle size={12} />}{slaLabel(s)}
                          </span>
                        )}
                      </td>
                      <td>{s.fechaRegistro}</td>
                      <td>{s.fechaEstado || "—"}</td>
                      <td>{s.registradoPor || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
