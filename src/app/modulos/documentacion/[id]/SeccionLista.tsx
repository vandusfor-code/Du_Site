"use client";

import { Plus, Trash2 } from "lucide-react";
import s from "./documentar.module.css";

export interface ItemLista {
  id: string;
  orden: number;
  descripcion: string;
}

export default function SeccionLista({
  numero,
  pregunta,
  subtitulo,
  placeholderNuevo,
  items,
  noAplica,
  onNoAplicaChange,
  onAgregar,
  onCambiarLocal,
  onGuardarItem,
  onEliminar,
  procesando,
}: {
  numero: number;
  pregunta: string;
  subtitulo: string;
  placeholderNuevo: string;
  items: ItemLista[];
  noAplica: boolean;
  onNoAplicaChange: (v: boolean) => void;
  onAgregar: () => void;
  onCambiarLocal: (id: string, descripcion: string) => void;
  onGuardarItem: (id: string, descripcion: string) => void;
  onEliminar: (id: string) => void;
  procesando: boolean;
}) {
  return (
    <div>
      <div className={s.seccionHead}>
        <div>
          <h3 className={s.seccionTitulo}>
            {numero}. {pregunta}
          </h3>
          <p className={s.seccionSub}>{subtitulo}</p>
        </div>
        {!noAplica && (
          <button className={s.btnFantasma} onClick={onAgregar} disabled={procesando} type="button">
            <Plus size={15} /> {placeholderNuevo}
          </button>
        )}
      </div>

      <label className={s.noAplicaCheck} style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={noAplica} onChange={(e) => onNoAplicaChange(e.target.checked)} />
        No aplica
      </label>

      {!noAplica &&
        (items.length === 0 ? (
          <div className={s.listaVacia}>Aún no has agregado elementos.</div>
        ) : (
          items.map((it, i) => (
            <div key={it.id} className={s.pasoFila} style={{ gridTemplateColumns: "34px 1fr 34px" }}>
              <div className={s.pasoNumero}>{i + 1}</div>
              <div>
                <input
                  className={s.inputInstruccion}
                  value={it.descripcion}
                  onChange={(e) => onCambiarLocal(it.id, e.target.value)}
                  onBlur={() => onGuardarItem(it.id, it.descripcion)}
                  placeholder="Describe este punto…"
                />
              </div>
              <button className={s.btnIcono} onClick={() => onEliminar(it.id)} title="Eliminar" type="button">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ))}
    </div>
  );
}
