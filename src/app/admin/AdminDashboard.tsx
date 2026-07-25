"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Loader2, PlayCircle, RefreshCw, Sparkles, Upload } from "lucide-react";
import {
  ejecutarAuditoriasAction,
  generarResumenCortesAction,
  obtenerEstadoAuditoriasAction,
  cargarTranscripcionesAction,
} from "./actions";
import type { EstadoAuditorias, ResultadoProcesamiento } from "@/lib/auditorias-admin";

export default function AdminDashboard({
  nombre,
  estadoInicial,
  errorInicial,
}: {
  nombre: string;
  estadoInicial: EstadoAuditorias | null;
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

      <main className="mx-auto max-w-3xl px-6 py-10">
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
      </main>
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
