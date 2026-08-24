"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModuleTopbar } from "@/components/module-shell";
import { Drawer } from "@/components/drawer";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { useModuleSound } from "@/lib/use-module-sound";
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

type TabDetalle = "auditoria" | "ciclo" | "compromiso" | "historial";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TONO_TEXTO: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  neutral: "text-neutral",
};

function KpiTile({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${TONO_TEXTO[tone]}`}>{value}</p>
    </div>
  );
}

export default function CalidadDashboard({
  kpisIniciales,
  panelInicial,
  idResaltadoInicial,
  detalleInicial,
}: {
  kpisIniciales: KPIsPanelCalidad;
  panelInicial: ResultadoPanelCalidad;
  idResaltadoInicial: string | null;
  detalleInicial: DetalleAuditoriaCalidad | null;
}) {
  const router = useRouter();
  const { soundOn, toggleSound } = useModuleSound();

  const [kpis] = useState(kpisIniciales);
  const [panel, setPanel] = useState(panelInicial);
  const [filtros, setFiltros] = useState<FiltrosPanelCalidad>({});
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

  function aplicarFiltro(parcial: Partial<FiltrosPanelCalidad>) {
    const nuevos: FiltrosPanelCalidad = { ...filtros, ...parcial };
    setFiltros(nuevos);
    setPagina(0);
    recargar(nuevos, 0);
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
    // ModuleTopbar (module-shell.css) usa var(--primary)/var(--primary-deep),
    // que globals.css no define (usa --brand/--brand-deep). Se alía aquí,
    // solo para este módulo, sin tocar module-shell.css ni otros módulos
    // que ya definen su propio --primary (ej. metricas.css).
    <div
      className="min-h-screen bg-background"
      style={{ "--primary": "var(--brand)", "--primary-deep": "var(--brand-deep)" } as React.CSSProperties}
    >
      <ModuleTopbar moduleName="Calidad" soundOn={soundOn} toggleSound={toggleSound} />

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Panel de Calidad</h1>
          <p className="mt-1 text-sm text-muted">Seguimiento de auditorías, acuses y compromisos.</p>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile label="Notificadas" value={kpis.notificadasTotales} tone="info" />
          <KpiTile label="Pendientes de acuse" value={kpis.pendientesDeAcuse} tone="neutral" />
          <KpiTile label="Vencidas sin acuse" value={kpis.vencidasSinAcuse} tone="error" />
          <KpiTile label="Compromiso pendiente" value={kpis.compromisosPendientesDeRegistro} tone="neutral" />
          <KpiTile label="En seguimiento" value={kpis.enSeguimiento} tone="info" />
          <KpiTile label="Compromisos vencidos" value={kpis.compromisosVencidos} tone="error" />
          <KpiTile label="Cumplidos" value={kpis.cumplidos} tone="success" />
          <KpiTile label="Incumplidos" value={kpis.incumplidos} tone="error" />
          <KpiTile label="No elegibles" value={kpis.noElegibles} tone="neutral" />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <select
            className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
            value={filtros.estado ?? ""}
            onChange={(e) => aplicarFiltro({ estado: (e.target.value || undefined) as EstadoCiclo | undefined })}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Código de asesora"
            className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
            defaultValue={filtros.asesorCodigo ?? ""}
            onBlur={(e) => aplicarFiltro({ asesorCodigo: e.target.value.trim() || undefined })}
          />

          <select
            className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
            value={filtros.resultado ?? ""}
            onChange={(e) => aplicarFiltro({ resultado: (e.target.value || undefined) as "OK" | "PENC" | undefined })}
          >
            <option value="">Resultado (todos)</option>
            <option value="OK">OK</option>
            <option value="PENC">PENC</option>
          </select>

          <select
            className="rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-foreground"
            value={filtros.requiereCompromiso === undefined ? "" : String(filtros.requiereCompromiso)}
            onChange={(e) =>
              aplicarFiltro({ requiereCompromiso: e.target.value === "" ? undefined : e.target.value === "true" })
            }
          >
            <option value="">Requiere compromiso (todos)</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={!!filtros.vencidas}
              onChange={(e) => aplicarFiltro({ vencidas: e.target.checked || undefined })}
            />
            Solo vencidas
          </label>

          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Auditoría entre</span>
            <input
              type="date"
              className="rounded-md border border-border bg-surface-inset px-2 py-1.5 text-sm text-foreground"
              onChange={(e) =>
                aplicarFiltro({ fechaAuditoriaDesde: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
            <span>y</span>
            <input
              type="date"
              className="rounded-md border border-border bg-surface-inset px-2 py-1.5 text-sm text-foreground"
              onChange={(e) =>
                aplicarFiltro({ fechaAuditoriaHasta: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
          </div>
        </section>

        <section className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
          <table className="w-full min-w-[1300px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-3">Asesora</th>
                <th className="px-3 py-3">ID Gestión</th>
                <th className="px-3 py-3">Fecha auditoría</th>
                <th className="px-3 py-3">Resultado</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Notificación</th>
                <th className="px-3 py-3">Acuse</th>
                <th className="px-3 py-3">¿Compromiso?</th>
                <th className="px-3 py-3">Registro</th>
                <th className="px-3 py-3">Prometida</th>
                <th className="px-3 py-3">Días</th>
                <th className="px-3 py-3">Record.</th>
                <th className="px-3 py-3">Última notif.</th>
                <th className="px-3 py-3">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className={cargando ? "opacity-50" : ""}>
              {panel.filas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-muted">
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
                    <td className="px-3 py-3 font-medium text-foreground">{f.nombreAsesora}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{f.idGestion.slice(0, 8)}…</td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.fechaAuditoria)}</td>
                    <td className="px-3 py-3 text-foreground">{f.resultado}</td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={f.semaforo.tone} label={f.semaforo.etiqueta} />
                    </td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.fechaNotificacion)}</td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.fechaAcuse)}</td>
                    <td className="px-3 py-3 text-foreground">{f.requiereCompromiso ? "Sí" : "No"}</td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.fechaRegistroCompromiso)}</td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.fechaPrometida)}</td>
                    <td className="px-3 py-3 tabular-nums text-foreground">
                      {f.diasRestantes === null ? "—" : f.diasRestantes}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-foreground">{f.recordatoriosEnviados}</td>
                    <td className="px-3 py-3 text-muted">{formatearFecha(f.ultimaNotificacion)}</td>
                    <td className="px-3 py-3 text-foreground">{f.cumplimiento ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <div className="mt-4 flex items-center justify-between text-sm text-muted">
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
      <div className="mb-4 flex gap-1 rounded-md bg-surface-inset p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabActiva(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tabActiva === t.id ? "bg-surface text-foreground shadow-[var(--shadow-sm)]" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabActiva === "auditoria" && (
        <dl className="space-y-3 text-sm">
          <Campo label="Asesora" valor={detalle.nombreAsesora} />
          <Campo label="ID Gestión" valor={detalle.idGestion} mono />
          <Campo label="Fecha (Consolidado)" valor={detalle.fechaAuditoriaConsolidado || "—"} />
          <Campo label="Resultado" valor={detalle.resultadoConsolidado || "—"} />
          <Campo label="Nota" valor={detalle.nota || "—"} />
          <Campo label="Observación" valor={detalle.observacion || "—"} multilinea />
          <Campo label="Hallazgos" valor={detalle.hallazgos || "—"} multilinea />
          <Campo label="Puntos de mejora" valor={detalle.mejora || "—"} multilinea />
        </dl>
      )}

      {tabActiva === "ciclo" && (
        <dl className="space-y-3 text-sm">
          <Campo label="Estado" valor={detalle.estado} />
          {detalle.motivoNoElegible && <Campo label="Motivo NO_ELEGIBLE" valor={detalle.motivoNoElegible} />}
          <Campo label="Fecha de notificación" valor={formatearFecha(detalle.fechaNotificacion)} />
          <Campo label="Fecha de acuse" valor={formatearFecha(detalle.fechaAcuse)} />
          <Campo label="Requiere compromiso" valor={detalle.requiereCompromiso ? "Sí" : "No"} />
        </dl>
      )}

      {tabActiva === "compromiso" &&
        (detalle.compromiso ? (
          <dl className="space-y-3 text-sm">
            <Campo label="Texto del compromiso" valor={detalle.compromiso.texto} multilinea />
            <Campo label="Fecha de registro" valor={formatearFecha(detalle.compromiso.fechaRegistro)} />
            <Campo label="Fecha prometida (original)" valor={formatearFecha(detalle.compromiso.fechaPrometidaOriginal)} />
            <Campo label="Fecha prometida (vigente)" valor={formatearFecha(detalle.compromiso.fechaPrometida)} />
            <Campo label="Cumplimiento" valor={detalle.compromiso.cumplimiento} />
            <Campo label="Fecha de verificación" valor={formatearFecha(detalle.compromiso.fechaVerificacion)} />
            <Campo label="Observación de Calidad" valor={detalle.compromiso.observacionVerificacion || "—"} multilinea />
          </dl>
        ) : (
          <p className="text-sm text-muted">Esta auditoría todavía no tiene un compromiso registrado.</p>
        ))}

      {tabActiva === "historial" && (
        <ol className="space-y-3">
          {detalle.historial.length === 0 ? (
            <p className="text-sm text-muted">Sin eventos todavía.</p>
          ) : (
            detalle.historial.map((e, i) => (
              <li key={i} className="rounded-md border border-border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{e.tipoEvento}</span>
                  <span className="text-muted">{formatearFecha(e.creadoEn)}</span>
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
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}

function Campo({
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
