"use client";

import { useCallback, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Download,
  Mail,
  Clock,
  TriangleAlert,
  Clipboard,
  RefreshCw,
  CalendarX,
  CircleCheck,
  XCircle,
  UserRoundX,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Drawer } from "@/components/drawer";
import type { StatusTone } from "@/components/status-badge";
import CalidadSidebar from "./CalidadSidebar";
import { cargarPanelCalidadAction, cargarDetalleAuditoriaCalidadAction } from "./actions";
import type {
  FiltrosPanelCalidad,
  ResultadoPanelCalidad,
  KPIsPanelCalidad,
  DetalleAuditoriaCalidad,
  EstadoCiclo,
} from "@/lib/gestion-calidad";

/**
 * Paleta LOCAL de Calidad — a propósito NO reutiliza --brand/--brand-deep
 * de globals.css (esos tokens son un índigo oscuro pensado para el fondo
 * del login/home, no para un shell claro). Tampoco usa los tokens
 * flippable de modo oscuro (bg-surface, text-foreground, etc.) para que
 * este módulo se vea siempre claro, igual que Auditorías/Documental —que
 * tampoco tienen modo oscuro—, sin depender de las preferencias del
 * sistema. Son variables exclusivas de este archivo/módulo: no tocan
 * globals.css ni el aspecto de ningún otro módulo.
 */
const TEMA_CALIDAD = {
  "--cal-bg": "#f7f8fc",
  "--cal-surface": "#ffffff",
  "--cal-surface-inset": "#f5f6f9",
  "--cal-border": "#e5e7ef",
  "--cal-border-input": "#e0e3eb",
  "--cal-text": "#15162b",
  "--cal-text-strong": "#0f1022",
  "--cal-muted": "#68738c",
  "--cal-muted-2": "#97a0b4",
  "--cal-accent": "#7044ed",
  "--cal-accent-deep": "#5c34d1",
  "--cal-accent-soft": "#f1ecff",
  "--cal-shadow": "0 2px 8px rgba(24,30,55,0.045)",

  // El Drawer compartido (src/components/drawer.tsx) usa los tokens
  // globales --surface/--foreground/--muted-foreground/--border/
  // --shadow-hover, que cambian con prefers-color-scheme: dark. Se
  // sobrescriben aquí SOLO dentro del árbol de Calidad (este objeto se
  // aplica al contenedor raíz, del cual el Drawer es hijo) para que se
  // vea siempre blanco en este módulo, sin editar drawer.tsx ni afectar
  // el chat/notificaciones que también lo usan en modo oscuro.
  "--surface": "#ffffff",
  "--surface-inset": "#f5f6f9",
  "--foreground": "#0f0f14",
  "--muted-foreground": "#64748b",
  "--border": "rgba(15, 15, 20, 0.07)",
  "--shadow-hover": "0 2px 8px rgba(43, 35, 79, 0.08), 0 18px 44px rgba(43, 35, 79, 0.12)",
} as CSSProperties;

// Mismos valores pastel que success/warning/error/info/neutral en
// globals.css (modo claro), pero fijos — no cambian con el modo oscuro
// del sistema, para que Calidad se vea siempre clara.
const TONO_BG: Record<StatusTone, string> = {
  success: "#ecfdf5",
  warning: "#fffbeb",
  error: "#fff1f2",
  info: "#eff6ff",
  neutral: "#f1f5f9",
};
const TONO_FG: Record<StatusTone, string> = {
  success: "#059669",
  warning: "#d97706",
  error: "#e11d48",
  info: "#2563eb",
  neutral: "#475569",
};

const ESTADOS: EstadoCiclo[] = [
  "CREADA",
  "NOTIFICADA",
  "ACUSADA",
  "COMPROMISO_PENDIENTE",
  "EN_SEGUIMIENTO",
  "CERRADA",
  "NO_ELEGIBLE",
];

// Mapeo puramente visual (color de insignia) para el estado del ciclo — no
// altera el cálculo de semaforo/vencimientos, que sigue viniendo intacto
// desde gestion-calidad.ts.
const TONO_ESTADO: Record<EstadoCiclo, StatusTone> = {
  CREADA: "neutral",
  NOTIFICADA: "info",
  ACUSADA: "info",
  COMPROMISO_PENDIENTE: "warning",
  EN_SEGUIMIENTO: "warning",
  CERRADA: "success",
  NO_ELEGIBLE: "neutral",
};

type TabDetalle = "auditoria" | "ciclo" | "compromiso" | "historial";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Badge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: TONO_BG[tone], color: TONO_FG[tone] }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: TONO_FG[tone] }} />
      {label}
    </span>
  );
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  if (resultado === "OK") {
    return (
      <span
        className="inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-bold"
        style={{ background: TONO_BG.success, color: TONO_FG.success }}
      >
        OK
      </span>
    );
  }
  if (resultado === "PENC") {
    return (
      <span
        className="inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-bold"
        style={{ background: TONO_BG.error, color: TONO_FG.error }}
      >
        PENC
      </span>
    );
  }
  return <span style={{ color: "var(--cal-text)" }}>{resultado || "—"}</span>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  caption: string;
  tone: StatusTone;
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{ borderColor: "var(--cal-border)", background: "var(--cal-surface)", boxShadow: "var(--cal-shadow)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="grid size-8 shrink-0 place-items-center rounded-[10px]"
          style={{ background: TONO_BG[tone], color: TONO_FG[tone] }}
        >
          <Icon size={16} />
        </div>
        <p className="text-[12px] font-semibold" style={{ color: "var(--cal-muted)" }}>
          {label}
        </p>
      </div>
      <p className="mt-2 text-[22px] font-bold tabular-nums" style={{ color: "var(--cal-text-strong)" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--cal-muted-2)" }}>
        {caption}
      </p>
    </div>
  );
}

export default function CalidadDashboard({
  kpisIniciales,
  panelInicial,
  idResaltadoInicial,
  detalleInicial,
  nombreUsuario,
  rolUsuario,
}: {
  kpisIniciales: KPIsPanelCalidad;
  panelInicial: ResultadoPanelCalidad;
  idResaltadoInicial: string | null;
  detalleInicial: DetalleAuditoriaCalidad | null;
  nombreUsuario: string;
  rolUsuario?: string;
}) {
  const router = useRouter();

  const [kpis] = useState(kpisIniciales);
  const [panel, setPanel] = useState(panelInicial);
  const [filtros, setFiltros] = useState<FiltrosPanelCalidad>({});
  const [borrador, setBorrador] = useState<FiltrosPanelCalidad>({});
  const [pagina, setPagina] = useState(0);
  const [cargando, startTransition] = useTransition();

  const [drawerAbierto, setDrawerAbierto] = useState(!!idResaltadoInicial);
  const [detalle, setDetalle] = useState<DetalleAuditoriaCalidad | null>(detalleInicial);
  const [tabActiva, setTabActiva] = useState<TabDetalle>("auditoria");
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const recargar = useCallback((nuevosFiltros: FiltrosPanelCalidad, nuevaPagina: number) => {
    startTransition(async () => {
      const r = await cargarPanelCalidadAction(nuevosFiltros, nuevaPagina);
      setPanel(r);
    });
  }, []);

  function aplicarFiltros() {
    setFiltros(borrador);
    setPagina(0);
    recargar(borrador, 0);
  }

  function limpiarFiltros() {
    setBorrador({});
    setFiltros({});
    setPagina(0);
    recargar({}, 0);
  }

  function cambiarPagina(nueva: number) {
    setPagina(nueva);
    recargar(filtros, nueva);
  }

  async function abrirDetalle(idGestion: string) {
    setDrawerAbierto(true);
    setTabActiva("auditoria");
    router.replace(`/modulos/calidad?id=${encodeURIComponent(idGestion)}`, { scroll: false });
    if (detalle?.idGestion === idGestion) return;
    setCargandoDetalle(true);
    try {
      const d = await cargarDetalleAuditoriaCalidadAction(idGestion);
      setDetalle(d);
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    setDrawerAbierto(false);
    router.replace("/modulos/calidad", { scroll: false });
  }

  const totalPaginas = Math.max(1, Math.ceil(panel.totalFilas / panel.tamanoPagina));

  return (
    <div className="min-h-screen" style={{ ...TEMA_CALIDAD, background: "var(--cal-bg)" }}>
      <CalidadSidebar nombre={nombreUsuario} rol={rolUsuario} />

      <main className="ml-[228px] max-w-[1700px] px-[30px] pt-5 pb-7">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 place-items-center rounded-xl"
              style={{ background: "var(--cal-accent-soft)", color: "var(--cal-accent)" }}
            >
              <ClipboardCheck size={19} />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: "var(--cal-text-strong)" }}>
                Calidad
              </h1>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--cal-muted)" }}>
                Seguimiento de auditorías, acuses y compromisos.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-[36px] items-center gap-2 rounded-lg border px-4 text-[13px] font-semibold"
            style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
          >
            <Download size={15} />
            Exportar
          </button>
        </header>

        <section className="mb-4 grid grid-cols-5 gap-2.5">
          <KpiCard icon={Mail} label="Notificadas" value={kpis.notificadasTotales} tone="info" caption="Ciclos notificados a la fecha" />
          <KpiCard icon={Clock} label="Pendientes de acuse" value={kpis.pendientesDeAcuse} tone="warning" caption="Esperando acuse de recibo" />
          <KpiCard icon={TriangleAlert} label="Vencidas sin acuse" value={kpis.vencidasSinAcuse} tone="error" caption="Sin acuse dentro del plazo" />
          <KpiCard icon={Clipboard} label="Compromiso pendiente" value={kpis.compromisosPendientesDeRegistro} tone="warning" caption="Falta registrar el compromiso" />
          <KpiCard icon={RefreshCw} label="En seguimiento" value={kpis.enSeguimiento} tone="info" caption="Compromiso activo, en plazo" />
          <KpiCard icon={CalendarX} label="Compromisos vencidos" value={kpis.compromisosVencidos} tone="error" caption="Plazo de compromiso vencido" />
          <KpiCard icon={CircleCheck} label="Cumplidos" value={kpis.cumplidos} tone="success" caption="Compromisos verificados OK" />
          <KpiCard icon={XCircle} label="Incumplidos" value={kpis.incumplidos} tone="error" caption="Compromisos verificados NO OK" />
          <KpiCard icon={UserRoundX} label="No elegibles" value={kpis.noElegibles} tone="neutral" caption="Fuera del ciclo de auditoría" />
        </section>

        <section className="mb-4 rounded-2xl border p-3.5" style={{ borderColor: "var(--cal-border)", background: "var(--cal-surface)" }}>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Estado">
              <select
                className="h-9 w-full rounded-lg border px-3 text-[13px]"
                style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                value={borrador.estado ?? ""}
                onChange={(e) => setBorrador((f) => ({ ...f, estado: (e.target.value || undefined) as EstadoCiclo | undefined }))}
              >
                <option value="">Todos los estados</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Código asesor">
              <input
                type="text"
                placeholder="Ej. A1234"
                className="h-9 w-full rounded-lg border px-3 text-[13px]"
                style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                value={borrador.asesorCodigo ?? ""}
                onChange={(e) => setBorrador((f) => ({ ...f, asesorCodigo: e.target.value || undefined }))}
              />
            </Campo>
            <Campo label="Resultado">
              <select
                className="h-9 w-full rounded-lg border px-3 text-[13px]"
                style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                value={borrador.resultado ?? ""}
                onChange={(e) => setBorrador((f) => ({ ...f, resultado: (e.target.value || undefined) as "OK" | "PENC" | undefined }))}
              >
                <option value="">Todos</option>
                <option value="OK">OK</option>
                <option value="PENC">PENC</option>
              </select>
            </Campo>
          </div>

          <div className="mt-2.5 flex flex-wrap items-end gap-3">
            <div className="w-[190px]">
              <Campo label="¿Requiere compromiso?">
                <select
                  className="h-9 w-full rounded-lg border px-3 text-[13px]"
                  style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                  value={borrador.requiereCompromiso === undefined ? "" : String(borrador.requiereCompromiso)}
                  onChange={(e) =>
                    setBorrador((f) => ({
                      ...f,
                      requiereCompromiso: e.target.value === "" ? undefined : e.target.value === "true",
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </Campo>
            </div>

            <label className="flex h-9 items-center gap-2 text-[13px]" style={{ color: "var(--cal-text)" }}>
              <input
                type="checkbox"
                checked={!!borrador.vencidas}
                onChange={(e) => setBorrador((f) => ({ ...f, vencidas: e.target.checked || undefined }))}
              />
              Solo vencidas
            </label>

            <div className="w-[160px]">
              <Campo label="Fecha auditoría desde">
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border px-2.5 text-[13px]"
                  style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                  onChange={(e) =>
                    setBorrador((f) => ({
                      ...f,
                      fechaAuditoriaDesde: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    }))
                  }
                />
              </Campo>
            </div>
            <div className="w-[160px]">
              <Campo label="Fecha auditoría hasta">
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border px-2.5 text-[13px]"
                  style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
                  onChange={(e) =>
                    setBorrador((f) => ({
                      ...f,
                      fechaAuditoriaHasta: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    }))
                  }
                />
              </Campo>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="h-9 rounded-lg border px-4 text-[13px] font-semibold"
                style={{ borderColor: "var(--cal-border-input)", background: "var(--cal-surface)", color: "var(--cal-text)" }}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={aplicarFiltros}
                className="h-9 rounded-lg px-4 text-[13px] font-semibold text-white"
                style={{ background: "var(--cal-accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cal-accent-deep)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--cal-accent)")}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--cal-border)", background: "var(--cal-surface)" }}>
          <table className="w-full min-w-[1500px] text-[12.5px]">
            <thead>
              <tr
                className="text-left text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "var(--cal-surface-inset)", color: "var(--cal-muted)" }}
              >
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Asesora</th>
                <th className="px-3 py-2">ID Gestión</th>
                <th className="px-3 py-2">Fecha auditoría</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Notificación</th>
                <th className="px-3 py-2">Acuse</th>
                <th className="px-3 py-2">¿Compromiso?</th>
                <th className="px-3 py-2">Registro</th>
                <th className="px-3 py-2">Prometida</th>
                <th className="px-3 py-2">Días</th>
                <th className="px-3 py-2">Record.</th>
                <th className="px-3 py-2">Última notif.</th>
                <th className="px-3 py-2">Semáforo</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody className={cargando ? "opacity-50" : ""}>
              {panel.filas.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center" style={{ color: "var(--cal-muted)" }}>
                    Sin resultados para estos filtros.
                  </td>
                </tr>
              ) : (
                panel.filas.map((f) => (
                  <tr
                    key={f.cicloId}
                    className="cursor-pointer border-b last:border-0"
                    style={{ borderColor: "var(--cal-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cal-surface-inset)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => abrirDetalle(f.idGestion)}
                  >
                    <td className="px-3 py-2">
                      <Badge tone={TONO_ESTADO[f.estado]} label={f.estado} />
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: "var(--cal-text-strong)" }}>
                      {f.nombreAsesora}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]" style={{ color: "var(--cal-muted)" }}>
                      {f.idGestion.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.fechaAuditoria)}
                    </td>
                    <td className="px-3 py-2">
                      <ResultadoBadge resultado={f.resultado} />
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.fechaNotificacion)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.fechaAcuse)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-text)" }}>
                      {f.requiereCompromiso ? "Sí" : "No"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.fechaRegistroCompromiso)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.fechaPrometida)}
                    </td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--cal-text)" }}>
                      {f.diasRestantes === null ? "—" : f.diasRestantes}
                    </td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--cal-text)" }}>
                      {f.recordatoriosEnviados}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(f.ultimaNotificacion)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        title={f.semaforo.etiqueta}
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: TONO_FG[f.semaforo.tone] }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDetalle(f.idGestion);
                        }}
                        className="inline-flex items-center gap-0.5 text-[12px] font-semibold hover:underline"
                        style={{ color: "var(--cal-accent)" }}
                      >
                        Ver <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="mt-3 flex items-center justify-between text-[12px]" style={{ color: "var(--cal-muted)" }}>
          <span>
            {panel.totalFilas} auditorías · página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagina === 0 || cargando}
              onClick={() => cambiarPagina(pagina - 1)}
              className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              style={{ borderColor: "var(--cal-border-input)", color: "var(--cal-text)" }}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina + 1 >= totalPaginas || cargando}
              onClick={() => cambiarPagina(pagina + 1)}
              className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              style={{ borderColor: "var(--cal-border-input)", color: "var(--cal-text)" }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </main>

      <Drawer
        open={drawerAbierto}
        onClose={cerrarDetalle}
        title={detalle ? `${detalle.nombreAsesora} · ${detalle.idGestion.slice(0, 8)}…` : "Auditoría"}
        width={520}
      >
        <div style={TEMA_CALIDAD}>
          {cargandoDetalle || !detalle ? (
            <p className="text-sm" style={{ color: "var(--cal-muted)" }}>
              Cargando…
            </p>
          ) : (
            <DetalleAuditoriaContenido detalle={detalle} tabActiva={tabActiva} setTabActiva={setTabActiva} />
          )}
        </div>
      </Drawer>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--cal-muted-2)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DetalleAuditoriaContenido({
  detalle,
  tabActiva,
  setTabActiva,
}: {
  detalle: DetalleAuditoriaCalidad;
  tabActiva: TabDetalle;
  setTabActiva: (t: TabDetalle) => void;
}) {
  const TABS: { id: TabDetalle; label: string }[] = [
    { id: "auditoria", label: "Auditoría" },
    { id: "ciclo", label: "Ciclo" },
    { id: "compromiso", label: "Compromiso" },
    { id: "historial", label: "Historial" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-4 border-b" style={{ borderColor: "var(--cal-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabActiva(t.id)}
            className="border-b-2 pb-2 text-[13px] font-semibold transition-colors"
            style={{
              borderColor: tabActiva === t.id ? "var(--cal-accent)" : "transparent",
              color: tabActiva === t.id ? "var(--cal-accent)" : "var(--cal-muted)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabActiva === "auditoria" && (
        <dl className="space-y-3 text-sm">
          <Dato label="Asesora" valor={detalle.nombreAsesora} />
          <Dato label="ID Gestión" valor={detalle.idGestion} mono />
          <Dato label="Fecha (Consolidado)" valor={detalle.fechaAuditoriaConsolidado || "—"} />
          <Dato label="Resultado" valor={detalle.resultadoConsolidado || "—"} />
          <Dato label="Nota" valor={detalle.nota || "—"} />
          <Dato label="Observación" valor={detalle.observacion || "—"} multilinea />
          <Dato label="Hallazgos" valor={detalle.hallazgos || "—"} multilinea />
          <Dato label="Puntos de mejora" valor={detalle.mejora || "—"} multilinea />
        </dl>
      )}

      {tabActiva === "ciclo" && (
        <dl className="space-y-3 text-sm">
          <Dato label="Estado" valor={detalle.estado} />
          {detalle.motivoNoElegible && <Dato label="Motivo NO_ELEGIBLE" valor={detalle.motivoNoElegible} />}
          <Dato label="Fecha de notificación" valor={formatearFecha(detalle.fechaNotificacion)} />
          <Dato label="Fecha de acuse" valor={formatearFecha(detalle.fechaAcuse)} />
          <Dato label="Requiere compromiso" valor={detalle.requiereCompromiso ? "Sí" : "No"} />
        </dl>
      )}

      {tabActiva === "compromiso" &&
        (detalle.compromiso ? (
          <dl className="space-y-3 text-sm">
            <Dato label="Texto del compromiso" valor={detalle.compromiso.texto} multilinea />
            <Dato label="Fecha de registro" valor={formatearFecha(detalle.compromiso.fechaRegistro)} />
            <Dato label="Fecha prometida (original)" valor={formatearFecha(detalle.compromiso.fechaPrometidaOriginal)} />
            <Dato label="Fecha prometida (vigente)" valor={formatearFecha(detalle.compromiso.fechaPrometida)} />
            <Dato label="Cumplimiento" valor={detalle.compromiso.cumplimiento} />
            <Dato label="Fecha de verificación" valor={formatearFecha(detalle.compromiso.fechaVerificacion)} />
            <Dato label="Observación de Calidad" valor={detalle.compromiso.observacionVerificacion || "—"} multilinea />
          </dl>
        ) : (
          <p className="text-sm" style={{ color: "var(--cal-muted)" }}>
            Esta auditoría todavía no tiene un compromiso registrado.
          </p>
        ))}

      {tabActiva === "historial" && (
        <ol className="relative">
          {detalle.historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--cal-muted)" }}>
              Sin eventos todavía.
            </p>
          ) : (
            detalle.historial.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: "var(--cal-accent)" }} />
                  {i < detalle.historial.length - 1 && (
                    <span className="w-px flex-1" style={{ background: "var(--cal-border)" }} />
                  )}
                </div>
                <div className="flex-1 pb-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: "var(--cal-text-strong)" }}>
                      {e.tipoEvento}
                    </span>
                    <span className="whitespace-nowrap" style={{ color: "var(--cal-muted)" }}>
                      {formatearFecha(e.creadoEn)}
                    </span>
                  </div>
                  <p className="mt-1" style={{ color: "var(--cal-muted)" }}>
                    origen: {e.origen}
                    {e.actor ? ` · actor: ${e.actor}` : ""}
                  </p>
                  {!!e.detalle && (
                    <pre
                      className="mt-2 overflow-x-auto rounded p-2 text-[11px]"
                      style={{ background: "var(--cal-surface-inset)", color: "var(--cal-muted)" }}
                    >
                      {JSON.stringify(e.detalle, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}

function Dato({
  label,
  valor,
  mono,
  multilinea,
}: {
  label: string;
  valor: string;
  mono?: boolean;
  multilinea?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--cal-muted)" }}>
        {label}
      </dt>
      <dd
        className={`mt-0.5 ${mono ? "font-mono text-xs" : ""} ${multilinea ? "whitespace-pre-wrap" : ""}`}
        style={{ color: "var(--cal-text-strong)" }}
      >
        {valor}
      </dd>
    </div>
  );
}
