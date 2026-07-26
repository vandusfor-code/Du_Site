"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Calendar, Check, X, Loader2, FileText, Lightbulb, AlertTriangle, CheckCircle2,
} from "lucide-react";
import type { RevisionAdminData } from "@/lib/documentacion-tipos";
import { ESTADO_META, estadoLabel, calcularProgreso } from "@/lib/documentacion-tipos";
import { aprobarProcedimientoAction, solicitarCorreccionAction } from "./actions";
import s from "./revision.module.css";

function Vacio() {
  return <span className={s.vacio}>La asesora aún no completó esta sección.</span>;
}
function NoAplica() {
  return <span className={s.noAplica}><Check size={13} /> No aplica</span>;
}

export default function RevisionProcedimiento({
  procedimientoId,
  datos,
}: {
  procedimientoId: string;
  datos: RevisionAdminData;
}) {
  const router = useRouter();
  const { detalle, responsable, version, fechaLimite, comentarioCorreccion } = datos;
  const progreso = calcularProgreso(detalle);
  const meta = ESTADO_META[detalle.estado] ?? { label: estadoLabel(detalle.estado), tone: "neutral" };

  const [modal, setModal] = useState<null | "aprobar" | "correccion">(null);
  const [comentario, setComentario] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const enRevision = detalle.estado === "en_revision";

  async function aprobar() {
    if (procesando) return;
    setProcesando(true);
    setErrorModal(null);
    try {
      const r = await aprobarProcedimientoAction(procedimientoId);
      if (r.ok) {
        router.push("/modulos/documentacion");
        router.refresh();
      } else {
        setErrorModal(r.error);
        setProcesando(false);
      }
    } catch {
      setErrorModal("No se pudo aprobar el procedimiento.");
      setProcesando(false);
    }
  }

  async function enviarCorreccion() {
    if (procesando) return;
    if (!comentario.trim()) {
      setErrorModal("Escribe qué debe corregir la asesora.");
      return;
    }
    setProcesando(true);
    setErrorModal(null);
    try {
      const r = await solicitarCorreccionAction(procedimientoId, comentario.trim());
      if (r.ok) {
        router.push("/modulos/documentacion");
        router.refresh();
      } else {
        setErrorModal(r.error);
        setProcesando(false);
      }
    } catch {
      setErrorModal("No se pudo solicitar la corrección.");
      setProcesando(false);
    }
  }

  function cerrarModal() {
    if (procesando) return;
    setModal(null);
    setErrorModal(null);
    setComentario("");
  }

  return (
    <div className={s.page}>
      <div className={s.shell}>
        <Link href="/modulos/documentacion" className={s.back}>
          <ArrowLeft size={14} /> Volver a Documentación Operativa
        </Link>

        {/* Header */}
        <div className={s.card}>
          <div className={s.header}>
            <div className={s.headerLeft}>
              <div className={s.headerIcon}><BookOpen size={22} /></div>
              <div>
                <div className={s.eyebrow}>Revisión de procedimiento</div>
                <h1 className={s.titulo}>{detalle.titulo}</h1>
                <div className={s.meta}>
                  <div className={s.metaItem}><span>Aplicativo</span><b>{detalle.aplicativo}</b></div>
                  <div className={s.metaItem}><span>Responsable</span><b>{responsable ?? "—"}</b></div>
                  {fechaLimite && (
                    <div className={s.metaItem}><span>Fecha límite</span><span className={s.metaFecha}><Calendar size={13} /> {fechaLimite}</span></div>
                  )}
                  <div className={s.metaItem}><span>Versión</span><b>{version}</b></div>
                  <div className={s.metaItem}><span>Estado</span><span className={`${s.badge} ${s[meta.tone] ?? s.neutral}`}>{meta.label}</span></div>
                </div>
              </div>
            </div>
            <div className={s.progresoBox}>
              <div className={s.progresoTop}>{progreso.completadas} de {progreso.total} completadas</div>
              <div className={s.progresoPct}>{progreso.pct}% completado</div>
              <div className={s.progresoBar}><div className={s.progresoBarFill} style={{ width: `${progreso.pct}%` }} /></div>
            </div>
          </div>
        </div>

        {/* Avisos según estado */}
        {detalle.estado === "correccion_requerida" && (
          <div className={`${s.aviso} ${s.avisoCorreccion}`}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><b>Corrección solicitada — en espera de la asesora.</b>{comentarioCorreccion ? ` "${comentarioCorreccion}"` : ""}</div>
          </div>
        )}
        {detalle.estado === "aprobado" && (
          <div className={`${s.aviso} ${s.avisoAprobado}`}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><b>Procedimiento aprobado.</b> Este procedimiento ya fue validado.</div>
          </div>
        )}

        {/* Secciones */}
        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>1</span> Propósito</h2>
            {detalle.paraQueSirve.trim() ? <div className={s.contenido}>{detalle.paraQueSirve}</div> : <Vacio />}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>2</span> Cuándo se utiliza</h2>
            {detalle.cuandoSeUtiliza.trim() ? <div className={s.contenido}>{detalle.cuandoSeUtiliza}</div> : <Vacio />}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>3</span> Paso a paso</h2>
            {detalle.pasos.length === 0 ? <Vacio /> : (
              detalle.pasos.map((p, i) => (
                <div className={s.paso} key={p.id}>
                  <div className={s.pasoHead}><div className={s.pasoNum}>{i + 1}</div></div>
                  <div className={s.pasoInstr}>{p.instruccion.trim() || <span className={s.vacio}>Sin instrucción.</span>}</div>
                  {p.imagenNoAplica ? (
                    <div style={{ marginTop: 10 }}><NoAplica /></div>
                  ) : p.imagenUrl ? (
                    <div className={s.pasoCaptura}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imagenUrl} alt={`Captura del paso ${i + 1}`} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>4</span> Resultado esperado</h2>
            {detalle.resultadoNoAplica ? <NoAplica /> : detalle.resultadoEsperado.trim() ? <div className={s.contenido}>{detalle.resultadoEsperado}</div> : <Vacio />}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>5</span> Validaciones</h2>
            {detalle.validacionesNoAplica ? <NoAplica /> : detalle.validaciones.length === 0 ? <Vacio /> : (
              <div className={s.lista}>
                {detalle.validaciones.map((v, i) => (
                  <div className={s.listaItem} key={v.id}><span className={s.listaNum}>{i + 1}</span><span className={s.listaTexto}>{v.descripcion}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>6</span> Procedimientos relacionados</h2>
            {detalle.relacionesNoAplica ? <NoAplica /> : detalle.relaciones.length === 0 ? <Vacio /> : (
              detalle.relaciones.map((r) => (
                <div className={s.relacion} key={r.id}>
                  <div><div className={s.relLabel}>Situación / condición</div><div className={s.relValor}>{r.condicion || "—"}</div></div>
                  <div>
                    <div className={s.relLabel}>Procedimiento relacionado</div>
                    <div className={s.relValor} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {r.estado === "propuesto" ? <Lightbulb size={14} /> : <FileText size={14} />}
                      {r.estado === "propuesto" ? r.propuesto : r.destinoTitulo}
                    </div>
                  </div>
                  <span className={r.estado === "propuesto" ? s.pillPropuesto : s.pillExistente}>
                    {r.estado === "propuesto" ? "Propuesto" : "Existente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>7</span> Errores frecuentes</h2>
            {detalle.erroresNoAplica ? <NoAplica /> : detalle.errores.length === 0 ? <Vacio /> : (
              <div className={s.lista}>
                {detalle.errores.map((e, i) => (
                  <div className={s.listaItem} key={e.id}><span className={s.listaNum}>{i + 1}</span><span className={s.listaTexto}>{e.descripcion}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.seccion}>
            <h2 className={s.seccionTitulo}><span className={s.seccionNum}>8</span> Observaciones</h2>
            {detalle.observacionesNoAplica ? <NoAplica /> : detalle.observaciones.trim() ? <div className={s.contenido}>{detalle.observaciones}</div> : <Vacio />}
          </div>
        </div>

        {/* Decisión (solo cuando está en revisión) */}
        {enRevision && (
          <div className={`${s.card} ${s.decision}`}>
            <div className={s.decisionHead}>
              <h2>Decisión de revisión</h2>
              <p>Revisa el procedimiento completo y decide si cumple los criterios o requiere ajustes.</p>
            </div>
            <div className={s.decisionBtns}>
              <button type="button" className={s.btnCorreccion} onClick={() => setModal("correccion")}>
                <AlertTriangle size={16} /> Solicitar corrección
              </button>
              <button type="button" className={s.btnAprobar} onClick={() => setModal("aprobar")}>
                <CheckCircle2 size={16} /> Aprobar procedimiento
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal aprobar */}
      {modal === "aprobar" && (
        <div className={s.overlay} onClick={cerrarModal}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <h3>Aprobar procedimiento</h3>
              <button className={s.closeBtn} onClick={cerrarModal} aria-label="Cerrar" disabled={procesando}><X size={16} /></button>
            </div>
            <div className={s.modalBody}>
              <p>¿Confirmas que este procedimiento fue revisado y cumple con los criterios para ser aprobado?</p>
              <div className={s.resumen}>
                <div><span>Procedimiento</span><b>{detalle.titulo}</b></div>
                <div><span>Asesora responsable</span><b>{responsable ?? "—"}</b></div>
                <div><span>Versión</span><b>{version}</b></div>
              </div>
              {errorModal && <div className={s.modalError}>{errorModal}</div>}
            </div>
            <div className={s.modalFoot}>
              <button className={s.btnGhost} onClick={cerrarModal} disabled={procesando}>Cancelar</button>
              <button className={`${s.btnConfirmar} ${s.btnConfirmarAprobar}`} onClick={aprobar} disabled={procesando}>
                {procesando ? <Loader2 size={15} className={s.spin} /> : <CheckCircle2 size={15} />}
                {procesando ? "Aprobando…" : "Aprobar procedimiento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal corrección */}
      {modal === "correccion" && (
        <div className={s.overlay} onClick={cerrarModal}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <h3>Solicitar corrección</h3>
              <button className={s.closeBtn} onClick={cerrarModal} aria-label="Cerrar" disabled={procesando}><X size={16} /></button>
            </div>
            <div className={s.modalBody}>
              <p>Indica claramente qué debe corregir la asesora. Verá este mensaje al abrir el procedimiento.</p>
              <textarea
                className={s.modalTextarea}
                placeholder="Ej. En el paso 3 falta detallar cómo se filtra por número de documento…"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                disabled={procesando}
                autoFocus
              />
              {errorModal && <div className={s.modalError}>{errorModal}</div>}
            </div>
            <div className={s.modalFoot}>
              <button className={s.btnGhost} onClick={cerrarModal} disabled={procesando}>Cancelar</button>
              <button className={`${s.btnConfirmar} ${s.btnConfirmarCorreccion}`} onClick={enviarCorreccion} disabled={procesando || !comentario.trim()}>
                {procesando ? <Loader2 size={15} className={s.spin} /> : <AlertTriangle size={15} />}
                {procesando ? "Enviando…" : "Enviar corrección"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
