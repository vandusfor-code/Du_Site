"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, Loader2, Lock, Send } from "lucide-react";
// (Link removido: "Volver" ahora guarda antes de navegar mediante router)
import type { DetalleProcedimiento } from "@/lib/documentacion-tipos";
import { ESTADO_META, estadoLabel, SECCIONES_DOC, calcularProgreso } from "@/lib/documentacion-tipos";
import {
  enviarARevisionAction,
  guardarTextoSeccionAction,
  guardarTextoOpcionalAction,
  marcarNoAplicaAction,
  agregarPasoAction,
  actualizarInstruccionPasoAction,
  eliminarPasoAction,
  reordenarPasosAction,
  subirCapturaPasoAction,
  eliminarCapturaPasoAction,
  marcarImagenNoAplicaAction,
  agregarValidacionAction,
  actualizarValidacionAction,
  eliminarValidacionAction,
  agregarErrorAction,
  actualizarErrorAction,
  eliminarErrorAction,
  buscarProcedimientosParaRelacionarAction,
  agregarRelacionExistenteAction,
  agregarRelacionPropuestaAction,
  eliminarRelacionAction,
} from "./actions";
import SeccionTexto from "./SeccionTexto";
import SeccionLista from "./SeccionLista";
import SeccionPasos from "./SeccionPasos";
import SeccionRelaciones from "./SeccionRelaciones";
import s from "./documentar.module.css";

type EstadoGuardado = "idle" | "guardando" | "guardado" | "error";

export default function DocumentarProcedimiento({
  procedimientoId,
  detalleInicial,
  fechaLimite,
  editable,
}: {
  procedimientoId: string;
  detalleInicial: DetalleProcedimiento;
  fechaLimite: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleProcedimiento>(detalleInicial);
  const [seccionActual, setSeccionActual] = useState(1);
  const [guardado, setGuardado] = useState<EstadoGuardado>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [avanzando, setAvanzando] = useState(false); // bloquea SOLO la navegación (evita doble clic)
  const [enviando, setEnviando] = useState(false);

  const progreso = calcularProgreso(detalle);
  const metaEstado = ESTADO_META[detalle.estado] ?? { label: estadoLabel(detalle.estado), tone: "neutral" };
  const completo = progreso.completadas === progreso.total;

  // Indicador para operaciones de fondo (pasos, listas, capturas). No bloquea la navegación.
  async function conIndicador<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setProcesando(true);
    setGuardado("guardando");
    setErrorMsg(null);
    try {
      const r = await fn();
      setGuardado("guardado");
      return r;
    } catch (e) {
      setGuardado("error");
      setErrorMsg(e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo.");
      return undefined;
    } finally {
      setProcesando(false);
    }
  }

  // Guarda SOLO la sección de texto actual (1,2,4,8). Es el único punto de guardado
  // de texto (sin autosave onBlur) para eliminar el doble clic y las carreras.
  async function guardarSeccionActual(): Promise<boolean> {
    if (!editable) return true;
    const necesita =
      seccionActual === 1 ||
      seccionActual === 2 ||
      (seccionActual === 4 && !detalle.resultadoNoAplica) ||
      (seccionActual === 8 && !detalle.observacionesNoAplica);
    if (!necesita) return true;
    setGuardado("guardando");
    setErrorMsg(null);
    try {
      if (seccionActual === 1) await guardarTextoSeccionAction(procedimientoId, "para_que_sirve", detalle.paraQueSirve);
      else if (seccionActual === 2) await guardarTextoSeccionAction(procedimientoId, "cuando_se_utiliza", detalle.cuandoSeUtiliza);
      else if (seccionActual === 4) await guardarTextoOpcionalAction(procedimientoId, "resultado_esperado", detalle.resultadoEsperado);
      else if (seccionActual === 8) await guardarTextoOpcionalAction(procedimientoId, "observaciones", detalle.observaciones);
      setGuardado("guardado");
      return true;
    } catch (e) {
      setGuardado("error");
      setErrorMsg(e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo.");
      return false;
    }
  }

  // ── Sección 3: pasos ──
  async function agregarPasoHandler() {
    // Optimista: el paso aparece de inmediato con un id temporal; al confirmar el
    // servidor se sustituye por el id real (o se revierte si falla).
    const tempId = `temp-${crypto.randomUUID()}`;
    setDetalle((d) => ({
      ...d,
      pasos: [...d.pasos, { id: tempId, orden: d.pasos.length + 1, instruccion: "", imagenPath: null, imagenNoAplica: false, imagenUrl: null }],
    }));
    const nuevo = await conIndicador(() => agregarPasoAction(procedimientoId));
    if (nuevo) {
      setDetalle((d) => ({ ...d, pasos: d.pasos.map((p) => (p.id === tempId ? { ...nuevo, instruccion: p.instruccion } : p)) }));
    } else {
      setDetalle((d) => ({ ...d, pasos: d.pasos.filter((p) => p.id !== tempId) }));
    }
  }
  function cambiarInstruccionLocal(id: string, v: string) {
    setDetalle((d) => ({ ...d, pasos: d.pasos.map((p) => (p.id === id ? { ...p, instruccion: v } : p)) }));
  }
  async function guardarInstruccion(id: string, v: string) {
    if (id.startsWith("temp-")) return; // paso aún no confirmado por el servidor
    await conIndicador(() => actualizarInstruccionPasoAction(procedimientoId, id, v));
  }
  async function eliminarPasoHandler(id: string) {
    await conIndicador(() => eliminarPasoAction(procedimientoId, id));
    setDetalle((d) => ({
      ...d,
      pasos: d.pasos.filter((p) => p.id !== id).map((p, i) => ({ ...p, orden: i + 1 })),
    }));
  }
  async function reordenarHandler(idsEnOrden: string[]) {
    setDetalle((d) => {
      const mapa = new Map(d.pasos.map((p) => [p.id, p]));
      const nuevos = idsEnOrden.map((id, i) => ({ ...mapa.get(id)!, orden: i + 1 }));
      return { ...d, pasos: nuevos };
    });
    await conIndicador(() => reordenarPasosAction(procedimientoId, idsEnOrden));
  }
  async function subirCapturaHandler(id: string, archivo: File) {
    const fd = new FormData();
    fd.append("pasoId", id);
    fd.append("archivo", archivo);
    const r = await conIndicador(() => subirCapturaPasoAction(procedimientoId, fd));
    if (r) {
      setDetalle((d) => ({
        ...d,
        pasos: d.pasos.map((p) =>
          p.id === id ? { ...p, imagenPath: r.imagenPath, imagenUrl: r.imagenUrl, imagenNoAplica: false } : p
        ),
      }));
    }
  }
  async function quitarCapturaHandler(id: string) {
    await conIndicador(() => eliminarCapturaPasoAction(procedimientoId, id));
    setDetalle((d) => ({ ...d, pasos: d.pasos.map((p) => (p.id === id ? { ...p, imagenPath: null, imagenUrl: null } : p)) }));
  }
  async function noAplicaCapturaHandler(id: string, v: boolean) {
    await conIndicador(() => marcarImagenNoAplicaAction(procedimientoId, id, v));
    setDetalle((d) => ({
      ...d,
      pasos: d.pasos.map((p) =>
        p.id === id ? { ...p, imagenNoAplica: v, imagenPath: v ? null : p.imagenPath, imagenUrl: v ? null : p.imagenUrl } : p
      ),
    }));
  }

  // ── Sección 4: resultado ──
  function cambiarResultadoLocal(v: string) {
    setDetalle((d) => ({ ...d, resultadoEsperado: v }));
  }
  async function noAplicaResultadoHandler(v: boolean) {
    setDetalle((d) => ({ ...d, resultadoNoAplica: v, resultadoEsperado: v ? "" : d.resultadoEsperado }));
    await conIndicador(() => marcarNoAplicaAction(procedimientoId, "resultado", v));
  }

  // ── Sección 5: validaciones ──
  async function agregarValidacionHandler() {
    const nuevo = await conIndicador(() => agregarValidacionAction(procedimientoId, ""));
    if (nuevo) setDetalle((d) => ({ ...d, validaciones: [...d.validaciones, nuevo], validacionesNoAplica: false }));
  }
  function cambiarValidacionLocal(id: string, v: string) {
    setDetalle((d) => ({ ...d, validaciones: d.validaciones.map((x) => (x.id === id ? { ...x, descripcion: v } : x)) }));
  }
  async function guardarValidacion(id: string, v: string) {
    await conIndicador(() => actualizarValidacionAction(procedimientoId, id, v));
  }
  async function eliminarValidacionHandler(id: string) {
    await conIndicador(() => eliminarValidacionAction(procedimientoId, id));
    setDetalle((d) => ({
      ...d,
      validaciones: d.validaciones.filter((x) => x.id !== id).map((x, i) => ({ ...x, orden: i + 1 })),
    }));
  }
  async function noAplicaValidacionesHandler(v: boolean) {
    setDetalle((d) => ({ ...d, validacionesNoAplica: v, validaciones: v ? [] : d.validaciones }));
    await conIndicador(() => marcarNoAplicaAction(procedimientoId, "validaciones", v));
  }

  // ── Sección 6: relaciones ──
  async function buscarRelacion(texto: string) {
    try {
      return await buscarProcedimientosParaRelacionarAction(procedimientoId, texto);
    } catch {
      return [];
    }
  }
  async function agregarRelacionExistenteHandler(condicion: string, destinoId: string) {
    const nuevo = await conIndicador(() => agregarRelacionExistenteAction(procedimientoId, condicion, destinoId));
    if (nuevo) setDetalle((d) => ({ ...d, relaciones: [...d.relaciones, nuevo], relacionesNoAplica: false }));
  }
  async function agregarRelacionPropuestaHandler(condicion: string, nombre: string) {
    const nuevo = await conIndicador(() => agregarRelacionPropuestaAction(procedimientoId, condicion, nombre));
    if (nuevo) setDetalle((d) => ({ ...d, relaciones: [...d.relaciones, nuevo], relacionesNoAplica: false }));
  }
  async function eliminarRelacionHandler(id: string) {
    await conIndicador(() => eliminarRelacionAction(procedimientoId, id));
    setDetalle((d) => ({ ...d, relaciones: d.relaciones.filter((r) => r.id !== id) }));
  }
  async function noAplicaRelacionesHandler(v: boolean) {
    setDetalle((d) => ({ ...d, relacionesNoAplica: v, relaciones: v ? [] : d.relaciones }));
    await conIndicador(() => marcarNoAplicaAction(procedimientoId, "relaciones", v));
  }

  // ── Sección 7: errores frecuentes ──
  async function agregarErrorHandler() {
    const nuevo = await conIndicador(() => agregarErrorAction(procedimientoId, ""));
    if (nuevo) setDetalle((d) => ({ ...d, errores: [...d.errores, nuevo], erroresNoAplica: false }));
  }
  function cambiarErrorLocal(id: string, v: string) {
    setDetalle((d) => ({ ...d, errores: d.errores.map((x) => (x.id === id ? { ...x, descripcion: v } : x)) }));
  }
  async function guardarError(id: string, v: string) {
    await conIndicador(() => actualizarErrorAction(procedimientoId, id, v));
  }
  async function eliminarErrorHandler(id: string) {
    await conIndicador(() => eliminarErrorAction(procedimientoId, id));
    setDetalle((d) => ({ ...d, errores: d.errores.filter((x) => x.id !== id).map((x, i) => ({ ...x, orden: i + 1 })) }));
  }
  async function noAplicaErroresHandler(v: boolean) {
    setDetalle((d) => ({ ...d, erroresNoAplica: v, errores: v ? [] : d.errores }));
    await conIndicador(() => marcarNoAplicaAction(procedimientoId, "errores", v));
  }

  // ── Sección 8: observaciones ──
  function cambiarObservacionesLocal(v: string) {
    setDetalle((d) => ({ ...d, observaciones: v }));
  }
  async function noAplicaObservacionesHandler(v: boolean) {
    setDetalle((d) => ({ ...d, observacionesNoAplica: v, observaciones: v ? "" : d.observaciones }));
    await conIndicador(() => marcarNoAplicaAction(procedimientoId, "observaciones", v));
  }

  // ── Navegación ── (bloqueada por `avanzando`, no por `procesando`: el primer clic siempre cuenta)
  async function irASeccion(n: number) {
    if (avanzando || n === seccionActual) {
      if (n !== seccionActual) setSeccionActual(n);
      return;
    }
    setAvanzando(true);
    try {
      const ok = await guardarSeccionActual();
      if (ok) setSeccionActual(n); // si el guardado falla, permanece en la sección
    } finally {
      setAvanzando(false);
    }
  }

  async function volver() {
    if (editable) await guardarSeccionActual();
    router.push("/modulos/documentacion");
  }

  async function enviarRevision() {
    if (enviando) return;
    setEnviando(true);
    setErrorMsg(null);
    const okGuardar = await guardarSeccionActual();
    if (!okGuardar) {
      setEnviando(false);
      return;
    }
    try {
      const r = await enviarARevisionAction(procedimientoId);
      if (r.ok) {
        router.push("/modulos/documentacion");
        router.refresh();
      } else {
        setGuardado("error");
        setErrorMsg(r.error);
        setEnviando(false);
      }
    } catch {
      setGuardado("error");
      setErrorMsg("No se pudo enviar a revisión. Intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <div className={s.topbar}>
          <button type="button" className={s.back} onClick={volver}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div className={s.guardado}>
            <span
              className={`${s.guardadoLinea} ${
                guardado === "guardado" ? s.guardadoOk : guardado === "guardando" ? s.guardadoBusy : guardado === "error" ? s.guardadoError : ""
              }`}
            >
              {guardado === "guardando" && (
                <>
                  <Loader2 size={13} className={s.spin} /> Guardando…
                </>
              )}
              {guardado === "guardado" && (
                <>
                  <Check size={13} /> Guardado
                </>
              )}
              {guardado === "error" && "No se pudo guardar"}
            </span>
            {errorMsg && guardado === "error" && <span className={s.guardadoSub}>{errorMsg}</span>}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.header}>
            <div className={s.headerLeft}>
              <div className={s.headerIcon}>
                <BookOpen size={22} />
              </div>
              <div>
                <div className={s.eyebrow}>Documentar procedimiento</div>
                <h1 className={s.titulo}>{detalle.titulo}</h1>
                <div className={s.meta}>
                  <div className={s.metaItem}>
                    <span>Aplicativo</span>
                    <b>{detalle.aplicativo}</b>
                  </div>
                  {fechaLimite && (
                    <div className={s.metaItem}>
                      <span>Fecha límite</span>
                      <span className={s.metaFecha}>
                        <Calendar size={13} /> {fechaLimite}
                      </span>
                    </div>
                  )}
                  <div className={s.metaItem}>
                    <span>Estado</span>
                    <span className={`${s.badge} ${s[metaEstado.tone] ?? s.neutral}`}>{metaEstado.label}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={s.progresoBox}>
              <div className={s.progresoTop}>{progreso.completadas} de {progreso.total} completadas</div>
              <div className={s.progresoPct}>{progreso.pct}% completado</div>
              <div className={s.progresoBar}>
                <div className={s.progresoBarFill} style={{ width: `${progreso.pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className={s.card} style={{ padding: 0 }}>
          <div className={s.stepper}>
            {SECCIONES_DOC.map((sec, i) => {
              const hecha = progreso.porSeccion[i];
              const actual = sec.n === seccionActual;
              return (
                <button
                  key={sec.n}
                  type="button"
                  className={`${s.step} ${hecha ? s.stepDone : ""} ${actual ? s.stepActual : ""}`}
                  onClick={() => irASeccion(sec.n)}
                  style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }}
                >
                  <div className={s.stepCircle}>{hecha ? <Check size={15} /> : sec.n}</div>
                  <div className={s.stepLabel}>{sec.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={s.card}>
          {!editable && (
            <div className={s.readonlyBanner}>
              <Lock size={15} />
              <span>Este procedimiento está {ESTADO_META[detalle.estado]?.label?.toLowerCase() ?? "en revisión"} y no puede editarse. Puedes consultarlo.</span>
            </div>
          )}
          {errorMsg && guardado === "error" && <div className={s.error}>{errorMsg}</div>}

          {seccionActual === 1 && (
            <SeccionTexto
              numero={1}
              pregunta="¿Para qué sirve este procedimiento?"
              subtitulo="Explica brevemente el propósito de este procedimiento."
              placeholder="Escribe para qué sirve…"
              valor={detalle.paraQueSirve}
              onCambiar={(v) => setDetalle((d) => ({ ...d, paraQueSirve: v }))}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 2 && (
            <SeccionTexto
              numero={2}
              pregunta="¿En qué casos se utiliza?"
              subtitulo="Describe las situaciones en las que se debe aplicar este procedimiento."
              placeholder="Escribe en qué casos se utiliza…"
              valor={detalle.cuandoSeUtiliza}
              onCambiar={(v) => setDetalle((d) => ({ ...d, cuandoSeUtiliza: v }))}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 3 && (
            <SeccionPasos
              pasos={detalle.pasos}
              onAgregar={agregarPasoHandler}
              onCambiarInstruccionLocal={cambiarInstruccionLocal}
              onGuardarInstruccion={guardarInstruccion}
              onEliminar={eliminarPasoHandler}
              onReordenar={reordenarHandler}
              onSubirCaptura={subirCapturaHandler}
              onQuitarCaptura={quitarCapturaHandler}
              onNoAplicaCaptura={noAplicaCapturaHandler}
              procesando={procesando}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 4 && (
            <SeccionTexto
              numero={4}
              pregunta="¿Qué resultado debes obtener al finalizar?"
              subtitulo="Describe el resultado esperado al completar este procedimiento."
              placeholder="Escribe el resultado esperado…"
              valor={detalle.resultadoEsperado}
              onCambiar={cambiarResultadoLocal}
              opcional={{ noAplica: detalle.resultadoNoAplica, onNoAplicaChange: noAplicaResultadoHandler }}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 5 && (
            <SeccionLista
              numero={5}
              pregunta="¿Qué debes validar o revisar durante este procedimiento?"
              subtitulo="Agrega cada validación o revisión necesaria."
              placeholderNuevo="Agregar validación"
              items={detalle.validaciones}
              noAplica={detalle.validacionesNoAplica}
              onNoAplicaChange={noAplicaValidacionesHandler}
              onAgregar={agregarValidacionHandler}
              onCambiarLocal={cambiarValidacionLocal}
              onGuardarItem={guardarValidacion}
              onEliminar={eliminarValidacionHandler}
              procesando={procesando}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 6 && (
            <SeccionRelaciones
              relaciones={detalle.relaciones}
              noAplica={detalle.relacionesNoAplica}
              onNoAplicaChange={noAplicaRelacionesHandler}
              onBuscar={buscarRelacion}
              onAgregarExistente={agregarRelacionExistenteHandler}
              onAgregarPropuesta={agregarRelacionPropuestaHandler}
              onEliminar={eliminarRelacionHandler}
              procesando={procesando}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 7 && (
            <SeccionLista
              numero={7}
              pregunta="¿Hay algún error frecuente que se deba evitar?"
              subtitulo="Agrega cada error frecuente que deba evitarse."
              placeholderNuevo="Agregar error"
              items={detalle.errores}
              noAplica={detalle.erroresNoAplica}
              onNoAplicaChange={noAplicaErroresHandler}
              onAgregar={agregarErrorHandler}
              onCambiarLocal={cambiarErrorLocal}
              onGuardarItem={guardarError}
              onEliminar={eliminarErrorHandler}
              procesando={procesando}
              soloLectura={!editable}
            />
          )}
          {seccionActual === 8 && (
            <SeccionTexto
              numero={8}
              pregunta="¿Hay alguna observación importante sobre este procedimiento?"
              subtitulo="Agrega cualquier observación adicional relevante."
              placeholder="Escribe la observación…"
              valor={detalle.observaciones}
              onCambiar={cambiarObservacionesLocal}
              opcional={{ noAplica: detalle.observacionesNoAplica, onNoAplicaChange: noAplicaObservacionesHandler }}
              soloLectura={!editable}
            />
          )}

          <div className={s.footer}>
            <button className={s.btnFantasma} onClick={() => irASeccion(Math.max(1, seccionActual - 1))} disabled={seccionActual === 1 || avanzando} type="button">
              <ChevronLeft size={15} /> Anterior
            </button>

            {seccionActual < 8 ? (
              <button className={s.btnPrimario} onClick={() => irASeccion(seccionActual + 1)} disabled={avanzando} type="button">
                {editable ? "Guardar y continuar" : "Siguiente"} <ChevronRight size={15} />
              </button>
            ) : editable ? (
              <button
                className={s.btnPrimario}
                onClick={enviarRevision}
                disabled={enviando || !completo}
                title={!completo ? "Completa las 8 secciones para enviar a revisión" : undefined}
                type="button"
              >
                {enviando ? <Loader2 size={15} className={s.spin} /> : <Send size={15} />}
                {enviando ? "Enviando…" : "Enviar a revisión"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
