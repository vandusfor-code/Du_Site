"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, Lightbulb, Info } from "lucide-react";
import type { RelacionProcedimiento, ProcedimientoBuscable } from "@/lib/documentacion-tipos";
import s from "./documentar.module.css";

interface Draft {
  condicion: string;
  modo: "buscar" | "proponer";
  query: string;
  resultados: ProcedimientoBuscable[];
  destinoId: string | null;
  destinoTitulo: string | null;
  destinoAplicativo: string | null;
  nombrePropuesto: string;
  buscando: boolean;
}

const DRAFT_VACIO: Draft = {
  condicion: "",
  modo: "buscar",
  query: "",
  resultados: [],
  destinoId: null,
  destinoTitulo: null,
  destinoAplicativo: null,
  nombrePropuesto: "",
  buscando: false,
};

export default function SeccionRelaciones({
  relaciones,
  noAplica,
  onNoAplicaChange,
  onBuscar,
  onAgregarExistente,
  onAgregarPropuesta,
  onEliminar,
  procesando,
}: {
  relaciones: RelacionProcedimiento[];
  noAplica: boolean;
  onNoAplicaChange: (v: boolean) => void;
  onBuscar: (texto: string) => Promise<ProcedimientoBuscable[]>;
  onAgregarExistente: (condicion: string, destinoId: string) => void;
  onAgregarPropuesta: (condicion: string, nombre: string) => void;
  onEliminar: (id: string) => void;
  procesando: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  function confirmarSiCompleto(d: Draft) {
    const condicionLista = d.condicion.trim().length > 0;
    if (!condicionLista) return;
    if (d.modo === "buscar" && d.destinoId) {
      onAgregarExistente(d.condicion.trim(), d.destinoId);
      setDraft(null);
    } else if (d.modo === "proponer" && d.nombrePropuesto.trim().length > 0) {
      onAgregarPropuesta(d.condicion.trim(), d.nombrePropuesto.trim());
      setDraft(null);
    }
  }

  async function buscar(texto: string) {
    if (!draft) return;
    setDraft({ ...draft, query: texto, buscando: true });
    const resultados = await onBuscar(texto);
    setDraft((actual) => (actual ? { ...actual, resultados, buscando: false } : actual));
  }

  return (
    <div>
      <h3 className={s.seccionTitulo}>6. ¿Este procedimiento puede llevar a otro procedimiento?</h3>
      <p className={s.seccionSub}>Indica si durante este proceso puede presentarse una situación que requiera realizar otro procedimiento.</p>

      <div className={s.opcionesRadio}>
        <label className={`${s.radioCard} ${!noAplica ? s.radioCardActiva : ""}`}>
          <input type="radio" checked={!noAplica} onChange={() => onNoAplicaChange(false)} />
          Sí
        </label>
        <label className={`${s.radioCard} ${noAplica ? s.radioCardActiva : ""}`}>
          <input type="radio" checked={noAplica} onChange={() => onNoAplicaChange(true)} />
          No aplica
        </label>
      </div>

      {!noAplica && (
        <>
          <div className={s.seccionHead} style={{ marginBottom: 12 }}>
            <b style={{ fontSize: 13.5 }}>Relaciones identificadas</b>
            <button
              className={s.btnFantasma}
              type="button"
              disabled={procesando || !!draft}
              onClick={() => setDraft(DRAFT_VACIO)}
            >
              <Plus size={15} /> Agregar relación
            </button>
          </div>

          {relaciones.length === 0 && !draft && <div className={s.listaVacia}>Aún no has identificado relaciones.</div>}

          {relaciones.map((r, i) => (
            <div key={r.id} className={s.relacionCard}>
              <div className={s.pasoNumero}>{i + 1}</div>
              <div>
                <span className={s.campoLabel}>Situación / condición</span>
                <p style={{ fontSize: 13, margin: 0 }}>{r.condicion}</p>
              </div>
              <div>
                <span className={s.campoLabel}>Procedimiento relacionado</span>
                <div className={s.destinoElegido}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      className={`${s.destinoElegidoIcon} ${r.estado === "propuesto" ? s.destinoElegidoIconPropuesto : s.destinoElegidoIconExistente}`}
                    >
                      {r.estado === "propuesto" ? <Lightbulb size={15} /> : <FileText size={15} />}
                    </div>
                    <div className={s.destinoElegidoBody}>
                      <b>{r.estado === "propuesto" ? r.propuesto : r.destinoTitulo}</b>
                      <span>{r.estado === "propuesto" ? "Aún no existe en Du Academy" : `Aplicativo: ${r.destinoAplicativo}`}</span>
                    </div>
                  </div>
                  <span className={r.estado === "propuesto" ? s.pillPropuesto : s.pillExistente}>
                    {r.estado === "propuesto" ? "Propuesto" : "Existente"}
                  </span>
                </div>
              </div>
              <button className={s.btnIcono} onClick={() => onEliminar(r.id)} title="Eliminar" type="button">
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {draft && (
            <div className={s.relacionCard}>
              <div className={s.pasoNumero}>{relaciones.length + 1}</div>
              <div>
                <span className={s.campoLabel}>Situación / condición</span>
                <input
                  autoFocus
                  className={s.inputInstruccion}
                  placeholder="Ej. El beneficiario aparece inactivo."
                  value={draft.condicion}
                  onChange={(e) => setDraft({ ...draft, condicion: e.target.value })}
                  onBlur={() => confirmarSiCompleto(draft)}
                />
              </div>
              <div>
                <span className={s.campoLabel}>Procedimiento relacionado</span>
                {draft.modo === "buscar" ? (
                  <div className={s.destinoBox}>
                    {draft.destinoId ? (
                      <div className={s.destinoElegido}>
                        <b style={{ fontSize: 12.5 }}>{draft.destinoTitulo}</b>
                        <button
                          className={s.btnIcono}
                          type="button"
                          onClick={() => setDraft({ ...draft, destinoId: null, destinoTitulo: null })}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          className={s.destinoSearch}
                          placeholder="Buscar procedimiento existente…"
                          value={draft.query}
                          onChange={(e) => buscar(e.target.value)}
                        />
                        {draft.resultados.length > 0 && (
                          <div className={s.destinoResultados}>
                            {draft.resultados.map((res) => (
                              <div
                                key={res.id}
                                className={s.destinoResultado}
                                onClick={() => {
                                  const actualizado = { ...draft, destinoId: res.id, destinoTitulo: res.titulo, resultados: [] };
                                  setDraft(actualizado);
                                  confirmarSiCompleto(actualizado);
                                }}
                              >
                                <b>{res.titulo}</b>
                                <span>Aplicativo: {res.aplicativo}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className={s.btnFantasma}
                          style={{ marginTop: 8, height: 32, fontSize: 11.5 }}
                          onClick={() => setDraft({ ...draft, modo: "proponer" })}
                        >
                          <Lightbulb size={13} /> Proponer nuevo procedimiento
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={s.destinoBox}>
                    <input
                      className={s.inputInstruccion}
                      placeholder="Nombre del procedimiento propuesto"
                      value={draft.nombrePropuesto}
                      onChange={(e) => setDraft({ ...draft, nombrePropuesto: e.target.value })}
                      onBlur={() => confirmarSiCompleto(draft)}
                    />
                    <button
                      type="button"
                      className={s.btnFantasma}
                      style={{ marginTop: 8, height: 32, fontSize: 11.5 }}
                      onClick={() => setDraft({ ...draft, modo: "buscar", nombrePropuesto: "" })}
                    >
                      <FileText size={13} /> Buscar existente
                    </button>
                  </div>
                )}
              </div>
              <button className={s.btnIcono} onClick={() => setDraft(null)} title="Cancelar" type="button">
                <Trash2 size={15} />
              </button>
            </div>
          )}

          <div className={s.info}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Cuando un procedimiento no existe, lo estás proponiendo para que el equipo de Formación y Calidad lo revise y lo cree.</span>
          </div>
        </>
      )}
    </div>
  );
}
