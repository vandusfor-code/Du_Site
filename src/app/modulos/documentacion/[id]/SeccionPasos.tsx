"use client";

import { useRef, useState } from "react";
import { Plus, GripVertical, Upload, X, MoreVertical } from "lucide-react";
import type { PasoProcedimiento } from "@/lib/documentacion-tipos";
import s from "./documentar.module.css";

export default function SeccionPasos({
  pasos,
  onAgregar,
  onCambiarInstruccionLocal,
  onGuardarInstruccion,
  onEliminar,
  onReordenar,
  onSubirCaptura,
  onQuitarCaptura,
  onNoAplicaCaptura,
  procesando,
  soloLectura,
}: {
  pasos: PasoProcedimiento[];
  onAgregar: () => void;
  onCambiarInstruccionLocal: (id: string, v: string) => void;
  onGuardarInstruccion: (id: string, v: string) => void;
  onEliminar: (id: string) => void;
  onReordenar: (idsEnOrden: string[]) => void;
  onSubirCaptura: (id: string, archivo: File) => void;
  onQuitarCaptura: (id: string) => void;
  onNoAplicaCaptura: (id: string, noAplica: boolean) => void;
  procesando: boolean;
  soloLectura?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasoActivoRef = useRef<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  function abrirSelector(pasoId: string) {
    pasoActivoRef.current = pasoId;
    fileInputRef.current?.click();
  }

  function alSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    const pasoId = pasoActivoRef.current;
    e.target.value = "";
    if (!archivo || !pasoId) return;
    if (archivo.size > 5 * 1024 * 1024) {
      alert("La imagen supera el tamaño máximo de 5 MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
      alert("Formato no permitido. Usa PNG, JPG o WebP.");
      return;
    }
    onSubirCaptura(pasoId, archivo);
  }

  function alSoltar(destinoId: string) {
    if (!arrastrando || arrastrando === destinoId) {
      setArrastrando(null);
      return;
    }
    const ids = pasos.map((p) => p.id);
    const origenIdx = ids.indexOf(arrastrando);
    const destinoIdx = ids.indexOf(destinoId);
    if (origenIdx === -1 || destinoIdx === -1) {
      setArrastrando(null);
      return;
    }
    const nuevo = [...ids];
    nuevo.splice(origenIdx, 1);
    nuevo.splice(destinoIdx, 0, arrastrando);
    setArrastrando(null);
    onReordenar(nuevo);
  }

  return (
    <div>
      <div className={s.seccionHead}>
        <div>
          <h3 className={s.seccionTitulo}>3. ¿Cómo se realiza?</h3>
          <p className={s.seccionSub}>Describe cada paso en el orden exacto en que debe ejecutarse.</p>
        </div>
        {!soloLectura && (
          <button className={s.btnFantasma} onClick={onAgregar} disabled={procesando} type="button">
            <Plus size={15} /> Agregar paso
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={alSeleccionarArchivo} />

      {pasos.length === 0 ? (
        <div className={s.listaVacia}>Aún no has agregado ningún paso.</div>
      ) : (
        pasos.map((p, i) => (
          <div
            key={p.id}
            className={`${s.pasoFila} ${arrastrando === p.id ? s.pasoFilaArrastrando : ""}`}
            draggable={!soloLectura}
            onDragStart={() => !soloLectura && setArrastrando(p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => !soloLectura && alSoltar(p.id)}
            onDragEnd={() => setArrastrando(null)}
          >
            <div className={s.arrastre} style={soloLectura ? { visibility: "hidden" } : undefined}>
              <GripVertical size={16} />
            </div>
            <div className={s.pasoNumero}>{i + 1}</div>
            <div>
              <span className={s.campoLabel}>Instrucción</span>
              <input
                className={s.inputInstruccion}
                value={p.instruccion}
                onChange={(e) => onCambiarInstruccionLocal(p.id, e.target.value)}
                onBlur={() => onGuardarInstruccion(p.id, p.instruccion)}
                placeholder="Describe qué debe hacer la asesora en este paso."
                readOnly={soloLectura}
              />
            </div>
            <div>
              <span className={s.campoLabel}>Captura del paso (opcional)</span>
              {p.imagenNoAplica ? (
                <div className={s.dropzone} style={{ opacity: 0.5, cursor: "default" }}>
                  <span>No aplica</span>
                </div>
              ) : p.imagenUrl ? (
                <div className={s.capturaPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imagenUrl} alt={`Captura del paso ${i + 1}`} />
                  {!soloLectura && (
                    <button className={s.capturaQuitar} onClick={() => onQuitarCaptura(p.id)} title="Quitar captura" type="button">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ) : soloLectura ? (
                <div className={s.dropzone} style={{ opacity: 0.5, cursor: "default" }}>
                  <span>Sin captura</span>
                </div>
              ) : (
                <div className={s.dropzone} onClick={() => abrirSelector(p.id)}>
                  <Upload size={16} />
                  <span>Subir captura</span>
                  <small>PNG, JPG o WebP</small>
                </div>
              )}
            </div>
            <label className={s.noAplicaCheck}>
              <input
                type="checkbox"
                checked={p.imagenNoAplica}
                onChange={(e) => onNoAplicaCaptura(p.id, e.target.checked)}
                disabled={soloLectura}
              />
              No aplica
            </label>
            {!soloLectura && (
              <button className={s.btnIcono} onClick={() => onEliminar(p.id)} title="Eliminar paso" type="button">
                <MoreVertical size={15} />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
