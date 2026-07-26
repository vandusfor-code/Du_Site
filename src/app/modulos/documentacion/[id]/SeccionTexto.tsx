"use client";

import s from "./documentar.module.css";

export default function SeccionTexto({
  numero,
  pregunta,
  subtitulo,
  placeholder,
  valor,
  onCambiar,
  onGuardar,
  opcional,
}: {
  numero: number;
  pregunta: string;
  subtitulo: string;
  placeholder: string;
  valor: string;
  onCambiar: (v: string) => void;
  onGuardar: () => void;
  opcional?: { noAplica: boolean; onNoAplicaChange: (v: boolean) => void };
}) {
  const deshabilitado = !!opcional?.noAplica;

  return (
    <div>
      <div className={s.seccionHead}>
        <div>
          <h3 className={s.seccionTitulo}>
            {numero}. {pregunta}
          </h3>
          <p className={s.seccionSub}>{subtitulo}</p>
        </div>
      </div>

      {opcional && (
        <label className={s.noAplicaCheck} style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={opcional.noAplica}
            onChange={(e) => opcional.onNoAplicaChange(e.target.checked)}
          />
          No aplica
        </label>
      )}

      {!deshabilitado && (
        <textarea
          className={s.textarea}
          placeholder={placeholder}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          onBlur={onGuardar}
        />
      )}
    </div>
  );
}
