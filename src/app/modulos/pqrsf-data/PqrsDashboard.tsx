"use client";

import "./pqrs.css";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { RegistroPqrsf } from "@/lib/pqrs";
import { useModuleSound } from "@/lib/use-module-sound";
import { SoundToggleButton } from "@/components/module-shell";

const LIMITE_FILAS = 300;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function PqrsDashboard({
  nombre,
  registros,
  error,
}: {
  nombre: string;
  registros: RegistroPqrsf[];
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [seleccionado, setSeleccionado] = useState<RegistroPqrsf | null>(null);
  const { soundOn, toggleSound, playClick } = useModuleSound();

  const filtrados = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return registros;
    return registros.filter((r) =>
      [r.radicado, r.tipo, r.dirigidoA, r.resumen, r.radicador, r.canal].some((v) => normalizar(v).includes(q))
    );
  }, [registros, query]);

  const visibles = filtrados.slice(0, LIMITE_FILAS);

  function abrirRegistro(r: RegistroPqrsf) {
    playClick();
    setSeleccionado(r);
  }

  return (
    <div className="pqrs-scope">
      <header className="pqrs-topbar">
        <div className="pqrs-brand">
          <div className="pqrs-brand-mark">P</div>
          <div>
            <b>PQRSF DATA</b>
            <span>Listado de radicados · {nombre}</span>
          </div>
        </div>
        <div className="pqrs-topbar-actions">
          <SoundToggleButton soundOn={soundOn} toggleSound={toggleSound} />
          <Link href="/" className="pqrs-btn-outline" onClick={playClick}>
            Volver al inicio
          </Link>
        </div>
      </header>

      <div className="pqrs-container">
        <div className="pqrs-search-row">
          <div className="pqrs-search-wrapper">
            <Search size={17} className="pqrs-search-icon" />
            <input
              type="text"
              className="pqrs-search-input"
              placeholder="Buscar por radicado, tipo, área, resumen, radicador o canal..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="pqrs-search-clear" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="pqrs-count">
            {filtrados.length} de {registros.length} radicados
          </div>
        </div>

        {error ? (
          <div className="pqrs-empty pqrs-empty-error">
            <p>No se pudo cargar el listado de PQRSF.</p>
            <span>{error}</span>
          </div>
        ) : registros.length === 0 ? (
          <div className="pqrs-empty">
            <p>Aún no hay radicados registrados.</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="pqrs-empty">
            <p>Sin resultados para “{query}”.</p>
          </div>
        ) : (
          <div className="pqrs-table-card">
            <div className="pqrs-table-scroll">
              <table className="pqrs-table">
                <thead>
                  <tr>
                    <th>Radicado</th>
                    <th>Tipo de Solicitud</th>
                    <th>Dirigido a</th>
                    <th>Resumen</th>
                    <th>Radicador</th>
                    <th>Canal</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.radicado} onClick={() => abrirRegistro(r)} tabIndex={0}>
                      <td className="pqrs-td-radicado">{r.radicado}</td>
                      <td>{r.tipo}</td>
                      <td>{r.dirigidoA}</td>
                      <td className="pqrs-td-resumen">{r.resumen}</td>
                      <td>{r.radicador}</td>
                      <td>
                        <span className="pqrs-canal-pill">{r.canal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtrados.length > LIMITE_FILAS && (
              <div className="pqrs-table-footer">
                Mostrando los primeros {LIMITE_FILAS} de {filtrados.length} resultados. Refina tu búsqueda para ver más.
              </div>
            )}
          </div>
        )}
      </div>

      {seleccionado && (
        <div className="pqrs-modal-overlay" onClick={() => setSeleccionado(null)}>
          <div className="pqrs-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="pqrs-modal-close" onClick={() => setSeleccionado(null)} aria-label="Cerrar">
              <X size={18} />
            </button>

            <span className="pqrs-modal-eyebrow">Radicado</span>
            <h2 className="pqrs-modal-title">{seleccionado.radicado}</h2>

            <div className="pqrs-detalle-grid">
              <div className="pqrs-detalle-item">
                <label>Tipo de Solicitud</label>
                <p>{seleccionado.tipo || "—"}</p>
              </div>
              <div className="pqrs-detalle-item">
                <label>Dirigido a</label>
                <p>{seleccionado.dirigidoA || "—"}</p>
              </div>
              <div className="pqrs-detalle-item">
                <label>Radicador</label>
                <p>{seleccionado.radicador || "—"}</p>
              </div>
              <div className="pqrs-detalle-item">
                <label>Canal</label>
                <p>{seleccionado.canal || "—"}</p>
              </div>
            </div>

            <div className="pqrs-detalle-full">
              <label>Resumen</label>
              <p>{seleccionado.resumen || "—"}</p>
            </div>
            <div className="pqrs-detalle-full">
              <label>Descripción</label>
              <p>{seleccionado.descripcion || "—"}</p>
            </div>
            <div className="pqrs-detalle-full">
              <label>Respuesta</label>
              <p>{seleccionado.respuesta || "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
