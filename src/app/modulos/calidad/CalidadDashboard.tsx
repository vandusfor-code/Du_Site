"use client";

import { useCallback, useState, useTransition } from "react";
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
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import CalidadSidebar from "./CalidadSidebar";
import { cargarPanelCalidadAction, cargarDetalleAuditoriaCalidadAction } from "./actions";
import type {
  FiltrosPanelCalidad,
  ResultadoPanelCalidad,
  KPIsPanelCalidad,
  DetalleAuditoriaCalidad,
  EstadoCiclo,
} from "@/lib/gestion-calidad";

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

const TONO_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  neutral: "bg-neutral",
};

type TabDetalle = "auditoria" | "ciclo" | "compromiso" | "historial";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  if (resultado === "OK") {
    return (
      <span className="inline-flex rounded-[7px] bg-success-bg px-2.5 py-1 text-[11px] font-bold text-success">
        OK
      </span>
    );
  }
  if (resultado === "PENC") {
    return (
      <span className="inline-flex rounded-[7px] bg-error-bg px-2.5 py-1 text-[11px] font-bold text-error">
        PENC
      </span>
    );
  }
  return <span className="text-foreground">{resultado || "—"}</span>;
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
  const TONE_ICON: Record<StatusTone, string> = {
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    error: "bg-error-bg text-error",
    info: "bg-info-bg text-info",
    neutral: "bg-neutral-bg text-neutral",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(24,30,55,0.045)]">
      <div className="flex items-center gap-3">
        <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${TONE_ICON[tone]}`}>
          <Icon size={17} />
        </div>
        <p className="text-[12px] font-semibold text-muted">{label}</p>
      </div>
      <p className="mt-3 text-[24px] font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{caption}</p>
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
    <div className="min-h-screen bg-background">
      <CalidadSidebar nombre={nombreUsuario} rol={rolUsuario} />

      <main className="ml-[228px] max-w-[1700px] px-[30px] py-[26px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Calidad</h1>
              <p className="mt-0.5 text-[13px] text-muted">
                Seguimiento de auditorías, acuses y compromisos.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-[39px] items-center gap-2 rounded-lg border border-border bg-surface px-4 text-[13px] font-semibold text-foreground hover:border-muted"
          >
            <Download size={15} />
            Exportar
          </button>
        </header>

        <section className="mb-6 grid grid-cols-5 gap-3">
          <KpiCard icon={Mail} label="Notificadas" value={kpis.notificadasTotales} tone="info" caption="Ciclos notificados a la fecha" />
          <KpiCard icon={Clock} label="Pendientes de acuse" value={kpis.pendientesDeAcuse} tone="neutral" caption="Esperando acuse de recibo" />
          <KpiCard icon={TriangleAlert} label="Vencidas sin acuse" value={kpis.vencidasSinAcuse} tone="error" caption="Sin acuse dentro del plazo" />
          <KpiCard icon={Clipboard} label="Compromiso pendiente" value={kpis.compromisosPendientesDeRegistro} tone="neutral" caption="Falta registrar el compromiso" />
          <KpiCard icon={RefreshCw} label="En seguimiento" value={kpis.enSeguimiento} tone="info" caption="Compromiso activo, en plazo" />
          <KpiCard icon={CalendarX} label="Compromisos vencidos" value={kpis.compromisosVencidos} tone="error" caption="Plazo de compromiso vencido" />
          <KpiCard icon={CircleCheck} label="Cumplidos" value={kpis.cumplidos} tone="success" caption="Compromisos verificados OK" />
          <KpiCard icon={XCircle} label="Incumplidos" value={kpis.incumplidos} tone="error" caption="Compromisos verificados NO OK" />
          <KpiCard icon={UserRoundX} label="No elegibles" value={kpis.noElegibles} tone="neutral" caption="Fuera del ciclo de auditoría" />
        </section>

        <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Estado">
              <select
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-[13px] text-foreground"
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
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-[13px] text-foreground"
                value={borrador.asesorCodigo ?? ""}
                onChange={(e) => setBorrador((f) => ({ ...f, asesorCodigo: e.target.value || undefined }))}
              />
            </Campo>
            <Campo label="Resultado">
              <select
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-[13px] text-foreground"
                value={borrador.resultado ?? ""}
                onChange={(e) => setBorrador((f) => ({ ...f, resultado: (e.target.value || undefined) as "OK" | "PENC" | undefined }))}
              >
                <option value="">Todos</option>
                <option value="OK">OK</option>
                <option value="PENC">PENC</option>
              </select>
            </Campo>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <Campo label="¿Requiere compromiso?">
              <select
                className="h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-[13px] text-foreground"
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
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={!!borrador.vencidas}
                  onChange={(e) => setBorrador((f) => ({ ...f, vencidas: e.target.checked || undefined }))}
                />
                Solo vencidas
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[2fr_1fr] items-end gap-3">
            <Campo label="Fecha de auditoría (rango)">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-[13px] text-foreground"
                  onChange={(e) =>
                    setBorrador((f) => ({
                      ...f,
                      fechaAuditoriaDesde: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    }))
                  }
                />
                <span className="text-[12px] text-muted">a</span>
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-[13px] text-foreground"
                  onChange={(e) =>
                    setBorrador((f) => ({
                      ...f,
                      fechaAuditoriaHasta: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    }))
                  }
                />
              </div>
            </Campo>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="h-9 rounded-lg border border-border bg-surface px-4 text-[13px] font-semibold text-foreground hover:border-muted"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={aplicarFiltros}
                className="h-9 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-deep"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[1500px] text-[12.5px]">
            <thead>
              <tr className="bg-surface-inset text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Asesora</th>
                <th className="px-3 py-3">ID Gestión</th>
                <th className="px-3 py-3">Fecha auditoría</th>
                <th className="px-3 py-3">Resultado</th>
                <th className="px-3 py-3">Notificación</th>
                <th className="px-3 py-3">Acuse</th>
                <th className="px-3 py-3">¿Compromiso?</th>
                <th className="px-3 py-3">Registro</th>
                <th className="px-3 py-3">Prometida</th>
                <th className="px-3 py-3">Días</th>
                <th className="px-3 py-3">Record.</th>
                <th className="px-3 py-3">Última notif.</th>
                <th className="px-3 py-3">Semáforo</th>
                <th className="px-3 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className={cargando ? "opacity-50" : ""}>
              {panel.filas.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-10 text-center text-muted">
                    Sin resultados para estos filtros.
                  </td>
                </tr>
              ) : (
                panel.filas.map((f) => (
                  <tr
                    key={f.cicloId}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-inset"
                    onClick={() => abrirDetalle(f.idGestion)}
                  >
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={TONO_ESTADO[f.estado]} label={f.estado} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{f.nombreAsesora}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{f.idGestion.slice(0, 8)}…</td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.fechaAuditoria)}</td>
                    <td className="px-3 py-2.5">
                      <ResultadoBadge resultado={f.resultado} />
                    </td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.fechaNotificacion)}</td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.fechaAcuse)}</td>
                    <td className="px-3 py-2.5 text-foreground">{f.requiereCompromiso ? "Sí" : "No"}</td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.fechaRegistroCompromiso)}</td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.fechaPrometida)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">
                      {f.diasRestantes === null ? "—" : f.diasRestantes}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{f.recordatoriosEnviados}</td>
                    <td className="px-3 py-2.5 text-muted">{formatearFecha(f.ultimaNotificacion)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        title={f.semaforo.etiqueta}
                        className={`inline-block size-2.5 rounded-full ${TONO_DOT[f.semaforo.tone]}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDetalle(f.idGestion);
                        }}
                        className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-brand hover:underline"
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

        <div className="mt-4 flex items-center justify-between text-[12px] text-muted">
          <span>
            {panel.totalFilas} auditorías · página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagina === 0 || cargando}
              onClick={() => cambiarPagina(pagina - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-foreground disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina + 1 >= totalPaginas || cargando}
              onClick={() => cambiarPagina(pagina + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-foreground disabled:opacity-40"
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
        {cargandoDetalle || !detalle ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <DetalleAuditoriaContenido detalle={detalle} tabActiva={tabActiva} setTabActiva={setTabActiva} />
        )}
      </Drawer>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</label>
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
      <div className="mb-4 flex gap-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabActiva(t.id)}
            className={`border-b-2 pb-2 text-[13px] font-semibold transition-colors ${
              tabActiva === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"
            }`}
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
          <p className="text-sm text-muted">Esta auditoría todavía no tiene un compromiso registrado.</p>
        ))}

      {tabActiva === "historial" && (
        <ol className="relative">
          {detalle.historial.length === 0 ? (
            <p className="text-sm text-muted">Sin eventos todavía.</p>
          ) : (
            detalle.historial.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-brand" />
                  {i < detalle.historial.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 pb-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{e.tipoEvento}</span>
                    <span className="whitespace-nowrap text-muted">{formatearFecha(e.creadoEn)}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    origen: {e.origen}
                    {e.actor ? ` · actor: ${e.actor}` : ""}
                  </p>
                  {!!e.detalle && (
                    <pre className="mt-2 overflow-x-auto rounded bg-surface-inset p-2 text-[11px] text-muted">
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
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 text-foreground ${mono ? "font-mono text-xs" : ""} ${multilinea ? "whitespace-pre-wrap" : ""}`}>
        {valor}
      </dd>
    </div>
  );
}
