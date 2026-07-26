"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Loader2, PlayCircle, RefreshCw, Sparkles, Upload, X, History } from "lucide-react";
import {
  ejecutarAuditoriasAction,
  generarResumenCortesAction,
  obtenerEstadoAuditoriasAction,
  cargarTranscripcionesAction,
  obtenerHistorialAuditoriasAction,
} from "./actions";
import type {
  EstadoAuditorias,
  ResultadoProcesamiento,
  HistorialAuditorias,
  AuditoriaHistorial,
} from "@/lib/auditorias-admin";

export default function AdminDashboard({
  nombre,
  estadoInicial,
  historialInicial,
  errorInicial,
}: {
  nombre: string;
  estadoInicial: EstadoAuditorias | null;
  historialInicial: HistorialAuditorias | null;
  errorInicial: string | null;
}) {
  const [estado, setEstado] = useState(estadoInicial);
  const [error, setError] = useState(errorInicial);
  const [procesando, setProcesando] = useState(false);
  const [generandoResumenes, setGenerandoResumenes] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcesamiento | null>(null);
  const [mensajeResumenes, setMensajeResumenes] = useState<string | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [subiendoCsv, setSubiendoCsv] = useState(false);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const [mensajeCsv, setMensajeCsv] = useState<string | null>(null);

  const [historial, setHistorial] = useState(historialInicial);
  const [filtroAsesor, setFiltroAsesor] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [detalle, setDetalle] = useState<AuditoriaHistorial | null>(null);

  async function aplicarFiltrosHistorial(asesor: string, mes: string) {
    setCargandoHistorial(true);
    try {
      const nuevo = await obtenerHistorialAuditoriasAction({ asesor, mes });
      setHistorial(nuevo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el historial");
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function refrescarEstado() {
    setRefrescando(true);
    setError(null);
    try {
      const nuevoEstado = await obtenerEstadoAuditoriasAction();
      setEstado(nuevoEstado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al refrescar el estado");
    } finally {
      setRefrescando(false);
    }
  }

  async function ejecutarAuditorias() {
    setProcesando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await ejecutarAuditoriasAction();
      setResultado(res);
      await refrescarEstado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar las auditorías");
    } finally {
      setProcesando(false);
    }
  }

  async function subirCsv() {
    const archivo = inputArchivoRef.current?.files?.[0];
    if (!archivo) {
      setErrorCsv("Selecciona un archivo CSV primero.");
      return;
    }
    setSubiendoCsv(true);
    setErrorCsv(null);
    setMensajeCsv(null);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const res = await cargarTranscripcionesAction(formData);
      setMensajeCsv(`Se cargaron ${res.cantidad} transcripción${res.cantidad === 1 ? "" : "es"} a Transcripciones1.`);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      setArchivoNombre(null);
      await refrescarEstado();
    } catch (e) {
      setErrorCsv(e instanceof Error ? e.message : "Error al cargar el archivo");
    } finally {
      setSubiendoCsv(false);
    }
  }

  async function generarResumenes() {
    setGenerandoResumenes(true);
    setError(null);
    setMensajeResumenes(null);
    try {
      const generados = await generarResumenCortesAction();
      setMensajeResumenes(
        generados > 0
          ? `Se generaron resúmenes para ${generados} asesor${generados === 1 ? "" : "es"} en Cortes_Envio.`
          : "No hay auditorías del día para resumir todavía."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar los resúmenes");
    } finally {
      setGenerandoResumenes(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-20 items-center justify-between border-b border-border bg-surface px-8">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Panel Admin</h1>
          <p className="text-[13px] text-muted">Sesión: {nombre}</p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <ArrowLeft size={15} />
          Volver al inicio
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="mb-6 rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
              <Upload size={20} />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-foreground">Cargar transcripciones (CSV)</h2>
              <p className="text-[13px] text-muted">
                Columnas esperadas: AGENTE, CONTACT_ID, TRANSCRIPCION (separador &quot;;&quot;). Se agregan a Transcripciones1.
              </p>
            </div>
          </div>

          {errorCsv && (
            <div className="mt-4 rounded-lg border border-[color:var(--error)]/25 bg-error-bg px-4 py-3 text-[13px] font-medium text-error">
              {errorCsv}
            </div>
          )}
          {mensajeCsv && (
            <div className="mt-4 rounded-lg border border-[color:var(--success)]/25 bg-success-bg px-4 py-3 text-[13px] font-medium text-success">
              {mensajeCsv}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 text-[13px] font-medium text-muted transition-colors hover:border-brand hover:text-foreground">
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name ?? null)}
              />
              {archivoNombre ?? "Seleccionar archivo .csv…"}
            </label>
            <button
              type="button"
              onClick={subirCsv}
              disabled={subiendoCsv}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-[14px] font-bold text-brand-foreground shadow-brand transition-all hover:bg-brand-mid disabled:cursor-not-allowed disabled:opacity-70"
            >
              {subiendoCsv ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {subiendoCsv ? "Cargando…" : "Cargar CSV"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-foreground">Auditorías con IA</h2>
              <p className="text-[13px] text-muted">
                Procesa las transcripciones de hoy (Transcripciones1 → Consolidado) y genera los resúmenes de cierre en Cortes_Envio.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-surface-inset px-5 py-4">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Pendientes de hoy</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">
                {estado ? estado.pendientesHoy : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={refrescarEstado}
              disabled={refrescando}
              className="flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-brand disabled:opacity-50"
            >
              <RefreshCw size={14} className={refrescando ? "animate-spin" : ""} />
              Refrescar
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-[color:var(--error)]/25 bg-error-bg px-4 py-3 text-[13px] font-medium text-error">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={ejecutarAuditorias}
              disabled={procesando}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-[14px] font-bold text-brand-foreground shadow-brand transition-all hover:bg-brand-mid disabled:cursor-not-allowed disabled:opacity-70"
            >
              {procesando ? <Loader2 size={17} className="animate-spin" /> : <PlayCircle size={17} />}
              {procesando ? "Procesando (puede tardar varios minutos)…" : "Ejecutar auditorías pendientes"}
            </button>

            <button
              type="button"
              onClick={generarResumenes}
              disabled={generandoResumenes}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border-strong px-5 text-[14px] font-semibold text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generandoResumenes ? <Loader2 size={16} className="animate-spin" /> : null}
              Generar resúmenes de cortes
            </button>
          </div>

          {resultado && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Procesadas" value={resultado.procesadas} />
              <Stat label="Errores" value={resultado.errores} tone={resultado.errores > 0 ? "error" : undefined} />
              <Stat label="Resúmenes" value={resultado.resumenesCortes} />
              <Stat
                label="Corte"
                value={resultado.detuvoPorTope ? "Tope 50" : resultado.detuvoPorTiempo ? "Tiempo" : "Completo"}
              />
            </div>
          )}

          {mensajeResumenes && (
            <p className="mt-4 text-[13px] font-medium text-muted">{mensajeResumenes}</p>
          )}
        </section>

        {/* ── Historial de auditorías (Consolidado) ── */}
        <section className="mt-6 rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
              <History size={20} />
            </span>
            <div>
              <h2 className="text-[17px] font-bold text-foreground">Historial de auditorías</h2>
              <p className="text-[13px] text-muted">
                Consolidado completo. Haz clic en una fila para ver el detalle con todos los criterios.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <select
              value={filtroAsesor}
              onChange={(e) => {
                setFiltroAsesor(e.target.value);
                aplicarFiltrosHistorial(e.target.value, filtroMes);
              }}
              className="h-11 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-[14px] font-medium text-foreground outline-none transition-colors focus:border-brand"
            >
              <option value="">Todos los asesores</option>
              {historial?.asesores.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={filtroMes}
              onChange={(e) => {
                setFiltroMes(e.target.value);
                aplicarFiltrosHistorial(filtroAsesor, e.target.value);
              }}
              className="h-11 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-[14px] font-medium text-foreground outline-none transition-colors focus:border-brand"
            >
              <option value="">Todos los meses</option>
              {historial?.meses.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {(filtroAsesor || filtroMes) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroAsesor("");
                  setFiltroMes("");
                  aplicarFiltrosHistorial("", "");
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-brand"
              >
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-[12px] text-muted">
            <span>
              {historial ? (
                <>
                  {historial.total} auditoría{historial.total === 1 ? "" : "s"}
                  {historial.limitado && ` · mostrando las ${historial.auditorias.length} más recientes`}
                </>
              ) : (
                "—"
              )}
            </span>
            {cargandoHistorial && <Loader2 size={14} className="animate-spin" />}
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-inset text-[11px] font-bold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Asesor</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">ID Gestión</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {historial && historial.auditorias.length > 0 ? (
                  historial.auditorias.map((a, i) => (
                    <tr
                      key={`${a.idGestion}-${i}`}
                      onClick={() => setDetalle(a)}
                      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-inset"
                    >
                      <td className="px-4 py-3 text-muted">{a.fecha}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{a.asesor}</td>
                      <td className="px-4 py-3 text-muted">{a.canal}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">{a.idGestion.slice(0, 12)}…</td>
                      <td className="px-4 py-3 font-bold text-foreground">{a.nota}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            a.tipoNota.toUpperCase() === "PENC"
                              ? "bg-error-bg text-error"
                              : "bg-success-bg text-success"
                          }`}
                        >
                          {a.tipoNota}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      {cargandoHistorial ? "Cargando…" : "No hay auditorías para estos filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {detalle && <DetalleModal a={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function DetalleModal({ a, onClose }: { a: AuditoriaHistorial; onClose: () => void }) {
  const criterios: { label: string; valor: string }[] = [
    { label: "Saludo", valor: a.saludo },
    { label: "Empatía", valor: a.empatia },
    { label: "Sonrisa", valor: a.sonrisa },
    { label: "Claridad", valor: a.claridad },
    { label: "Encuesta", valor: a.encuesta },
    { label: "Información", valor: a.informacion },
    { label: "Proceso", valor: a.proceso },
    { label: "Cierre", valor: a.cierre },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Auditoría</p>
            <h3 className="mt-1 text-lg font-extrabold text-foreground">{a.asesor}</h3>
            <p className="mt-0.5 font-mono text-[12px] text-muted">{a.idGestion}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-extrabold text-foreground">{a.nota}</p>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  a.tipoNota.toUpperCase() === "PENC" ? "bg-error-bg text-error" : "bg-success-bg text-success"
                }`}
              >
                {a.tipoNota}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-9 place-items-center rounded-lg border border-border-strong text-muted transition-colors hover:border-brand hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetaItem label="Fecha" value={a.fecha} />
            <MetaItem label="Canal" value={a.canal} />
            <MetaItem label="Tipo consulta" value={a.tipoConsulta} />
            <MetaItem label="Correo" value={a.correo} />
            <MetaItem label="Tuteo" value={a.puntajeTuteo} />
            <MetaItem label="Tono" value={a.tonoGeneral} />
            <MetaItem label="Evaluador" value={a.evaluador} />
            <MetaItem label="Tipo gestión" value={a.tipoGestion} />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Criterios</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {criterios.map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-surface-inset px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{c.label}</p>
                  <p
                    className={`mt-0.5 text-[13px] font-semibold ${
                      c.valor.toLowerCase().includes("no cumple")
                        ? "text-error"
                        : c.valor.toLowerCase().includes("no aplica")
                          ? "text-muted"
                          : "text-success"
                    }`}
                  >
                    {c.valor || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <TextoBloque titulo="Observación" texto={a.observacion} />
          <TextoBloque titulo="Hallazgos" texto={a.hallazgos} />
          <TextoBloque titulo="Puntos de mejora" texto={a.mejora} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 break-words text-[13px] font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function TextoBloque({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{titulo}</p>
      <p className="whitespace-pre-line rounded-lg border border-border bg-surface-inset p-4 text-[13px] leading-relaxed text-foreground">
        {texto || "—"}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "error" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-inset px-4 py-3 text-center">
      <p className={`text-xl font-extrabold ${tone === "error" ? "text-error" : "text-foreground"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
