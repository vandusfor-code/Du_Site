"use client";

import { useEffect, useState } from "react";
import { X, LayoutGrid, FileText, User, Calendar, Send } from "lucide-react";
import type { AplicativoOpcion, AsesoraOpcion } from "@/lib/documentacion-tipos";
import {
  obtenerAplicativosActivosAction,
  obtenerAsesorasAction,
  crearProcedimientoYAsignacionAction,
} from "./actions";
import s from "./documentacion.module.css";

interface Errores {
  aplicativo?: string;
  titulo?: string;
  asesora?: string;
}

export default function AsignarProcedimientoModal({
  onClose,
  onAsignado,
}: {
  onClose: () => void;
  onAsignado: () => void;
}) {
  const [aplicativos, setAplicativos] = useState<AplicativoOpcion[]>([]);
  const [asesoras, setAsesoras] = useState<AsesoraOpcion[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [aplicativoId, setAplicativoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [asesoraId, setAsesoraId] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");

  const [errores, setErrores] = useState<Errores>({});
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerAplicativosActivosAction(), obtenerAsesorasAction()])
      .then(([aps, ases]) => {
        if (!vigente) return;
        setAplicativos(aps);
        setAsesoras(ases);
      })
      .catch(() => {
        if (vigente) setErrorCarga("No se pudieron cargar los datos del formulario. Intenta de nuevo.");
      })
      .finally(() => {
        if (vigente) setCargandoOpciones(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  function validar(): boolean {
    const nuevos: Errores = {};
    if (!aplicativoId) nuevos.aplicativo = "Selecciona un aplicativo.";
    if (!titulo.trim()) nuevos.titulo = "El nombre del procedimiento es obligatorio.";
    if (!asesoraId) nuevos.asesora = "Selecciona una asesora responsable.";
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function confirmar() {
    setErrorEnvio(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const r = await crearProcedimientoYAsignacionAction({
        aplicativoId,
        titulo: titulo.trim(),
        asesoraId,
        fechaLimite: fechaLimite || null,
      });
      if (r.ok) {
        onAsignado();
      } else {
        setErrorEnvio(r.error);
      }
    } catch {
      setErrorEnvio("No se pudo asignar el procedimiento. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={s.overlay} onClick={enviando ? undefined : onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <h3>Asignar procedimiento</h3>
            <p className={s.modalSub}>Completa la información para asignar un nuevo procedimiento a una asesora.</p>
          </div>
          <button className={s.closeBtn} onClick={onClose} aria-label="Cerrar" disabled={enviando}>
            <X size={16} />
          </button>
        </div>

        <div className={s.modalBody}>
          {errorCarga && <div className={`${s.banner} ${s.bannerError}`}>{errorCarga}</div>}
          {errorEnvio && <div className={`${s.banner} ${s.bannerError}`}>{errorEnvio}</div>}

          <div className={s.field}>
            <label>Aplicativo</label>
            <div className={s.fieldControl}>
              <LayoutGrid size={16} />
              <select
                value={aplicativoId}
                onChange={(e) => setAplicativoId(e.target.value)}
                disabled={cargandoOpciones || enviando}
              >
                <option value="">Seleccionar aplicativo</option>
                {aplicativos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            {errores.aplicativo && <span className={s.fieldError}>{errores.aplicativo}</span>}
          </div>

          <div className={s.field}>
            <label>Nombre del procedimiento</label>
            <div className={s.fieldControl}>
              <FileText size={16} />
              <input
                type="text"
                placeholder="Escribe el nombre del procedimiento"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={enviando}
              />
            </div>
            {errores.titulo && <span className={s.fieldError}>{errores.titulo}</span>}
          </div>

          <div className={s.field}>
            <label>Asesora responsable</label>
            <div className={s.fieldControl}>
              <User size={16} />
              <select
                value={asesoraId}
                onChange={(e) => setAsesoraId(e.target.value)}
                disabled={cargandoOpciones || enviando}
              >
                <option value="">Seleccionar asesora responsable</option>
                {asesoras.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            {errores.asesora && <span className={s.fieldError}>{errores.asesora}</span>}
          </div>

          <div className={s.field}>
            <label>Fecha límite (opcional)</label>
            <div className={s.fieldControl}>
              <Calendar size={16} />
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                disabled={enviando}
              />
            </div>
          </div>
        </div>

        <div className={s.modalFoot}>
          <button className={s.btnGhost} onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className={s.primary} onClick={confirmar} disabled={enviando || cargandoOpciones}>
            <Send size={15} /> {enviando ? "Asignando…" : "Asignar procedimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
