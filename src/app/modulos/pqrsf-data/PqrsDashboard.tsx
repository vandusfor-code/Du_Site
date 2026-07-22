"use client";

import "./pqrs.css";

import Link from "next/link";
import { useState } from "react";
import { buscarAction } from "./actions";
import type { ModoBusqueda, OpcionResultado } from "@/lib/pqrs";

const REGLAS_ORO = [
  "Garantizar claridad absoluta antes de radicar.",
  "Validar el área de destino según la naturaleza del trámite.",
  "Evitar duplicidad en el sistema PQRSF.",
  "Verificar exhaustivamente la veracidad de los datos.",
  "El registro debe realizarse estrictamente a nombre del trabajador.",
];

export default function PqrsDashboard({ nombre }: { nombre: string }) {
  const [mode, setMode] = useState<ModoBusqueda>("PQRSF");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<OpcionResultado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rulesShown, setRulesShown] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setOptions(null);

    const res = await buscarAction(query, mode);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else if (res.options && res.options.length > 0) {
      setOptions(res.options);
      setCurrentIdx(0);
      if (!rulesShown && mode === "PQRSF") {
        setModalOpen(true);
        setRulesShown(true);
      }
    } else {
      setError(`No se encontraron resultados relacionados en la base de datos de ${mode}.`);
    }
  }

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") search();
  }

  function cambiarModo(nuevo: ModoBusqueda) {
    setMode(nuevo);
    setOptions(null);
    setError(null);
  }

  const actual = options?.[currentIdx];

  return (
    <div className="pqrs-scope">
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
            padding: "0 10px",
          }}
        >
          <div className="header">
            <h1>
              PEOPLE ACADEMY <span style={{ color: "var(--lima)" }}>PRO</span>
            </h1>
            <div style={{ marginTop: 5 }}>
              <div className="user-chip">ID: {nombre}</div>
            </div>
          </div>
          <Link href="/" className="btn-outline">
            Volver al inicio
          </Link>
        </div>

        <div className="card" style={{ padding: 25 }}>
          <div className="search-tabs">
            <button
              className={`tab-btn ${mode === "PQRSF" ? "active" : ""}`}
              onClick={() => cambiarModo("PQRSF")}
            >
              PQRSF
            </button>
            <button
              className={`tab-btn ${mode === "GENERAL" ? "active" : ""}`}
              onClick={() => cambiarModo("GENERAL")}
            >
              Búsqueda General
            </button>
          </div>

          <label className="label-neon">
            {mode === "PQRSF" ? "Ingresar consulta del usuario" : "Consultar base de conocimiento general"}
          </label>
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder={
                mode === "PQRSF"
                  ? "Ej: No me llegó el pago de la cuota monetaria..."
                  : "Ej: Requisitos para afiliación independiente..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleEnter}
            />
            <button className="btn-primary search-btn" onClick={search} disabled={loading}>
              Analizar
            </button>
          </div>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 25 }}>
              <div className="loader-ring" />
              <p style={{ fontSize: 12, color: "var(--lima)", marginTop: 10, letterSpacing: 2 }}>
                PROCESANDO CON INTELIGENCIA ARTIFICIAL...
              </p>
            </div>
          )}
        </div>

        {error && <p style={{ color: "#ff4d4d", textAlign: "center" }}>{error}</p>}

        {actual && (
          <div className={`card result-container fade-up`} style={mode === "GENERAL" ? { borderLeftColor: "#00e5ff" } : undefined}>
            {mode === "GENERAL" ? (
              <>
                <div style={{ marginBottom: 25 }}>
                  <span className="label-neon" style={{ color: "#00e5ff" }}>
                    Respuesta / Qué decir
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "white", lineHeight: 1.4 }}>
                    {actual.accion}
                  </div>
                </div>

                <div className="result-grid">
                  <div>
                    <span className="label-neon">Tema de Consulta</span>
                    <div className="value-text" style={{ opacity: 0.7 }}>
                      {actual.resumen_caso}
                    </div>
                  </div>
                  <div>
                    <span className="label-neon">Referencia / Área</span>
                    <div className="value-text">{actual.dirigido}</div>
                  </div>
                </div>

                <div className="nav-controls">
                  <div
                    className="source-badge"
                    style={{ background: "rgba(0, 229, 255, 0.1)", color: "#00e5ff", borderColor: "rgba(0, 229, 255, 0.3)" }}
                  >
                    {actual.fuente}
                  </div>
                  <NavButtons
                    total={options!.length}
                    idx={currentIdx}
                    onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    onNext={() => setCurrentIdx((i) => Math.min(options!.length - 1, i + 1))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="resumen-box">
                  <span className="label-neon">Resumen del Caso</span>
                  {actual.resumen_caso}
                </div>

                <div style={{ marginBottom: 30 }}>
                  <h2 style={{ margin: 0, color: "white", fontSize: 26, fontWeight: 700 }}>{actual.tipo}</h2>
                  <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>
                    {actual.clasificacion}
                  </p>
                </div>

                <div className="result-grid">
                  <div>
                    <span className="label-neon">Dirigido a</span>
                    <div className="value-text" style={{ fontSize: 18, fontWeight: 600 }}>
                      {actual.dirigido}
                    </div>
                  </div>
                  <div>
                    <span className="label-neon">Acción Recomendada</span>
                    <div className="value-text">{actual.accion}</div>
                  </div>
                </div>

                <div style={{ marginTop: 30 }}>
                  <span className="label-neon">Recordatorio</span>
                  <div className="value-text" style={{ fontSize: 14, color: "rgba(255,255,255,0.9)" }}>
                    {actual.recordatorio}
                  </div>
                </div>

                <div className="nav-controls">
                  <div className="source-badge">{actual.fuente}</div>
                  <NavButtons
                    total={options!.length}
                    idx={currentIdx}
                    onPrev={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    onNext={() => setCurrentIdx((i) => Math.min(options!.length - 1, i + 1))}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="banner-smart">
          <span className="material-icons" style={{ color: "var(--lima)" }}>
            tips_and_updates
          </span>
          <span>
            Recomendación: Para certificados de aportes o afiliaciones, remitir al asesor de aportes de la oficina
            más cercana. En casos complejos, usar <strong>sercliente@cofrem.co</strong>
          </span>
        </div>

        <div className="accordion-ng">
          <div className="accordion-ng-header" onClick={() => setAccordionOpen((v) => !v)}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="material-icons" style={{ fontSize: 18, color: "var(--lima)" }}>
                gavel
              </span>
              REGLAS DE ORO DEL RADICADOR
            </span>
            <span className="material-icons">{accordionOpen ? "expand_less" : "expand_more"}</span>
          </div>
          <div className={`accordion-ng-content ${accordionOpen ? "open" : ""}`}>
            <ul className="rules-list">
              {REGLAS_ORO.map((regla) => (
                <li key={regla}>{regla}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 50, opacity: 0.3, fontSize: 11 }}>
          DESIGNED FOR EXCELLENCE BY DUVAN RAMOS
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-up">
            <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Cerrar">
              ×
            </button>
            <h2 style={{ color: "var(--lima)", marginBottom: 5 }}>¡HOLA, {nombre.toUpperCase()}!</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 25 }}>
              Antes de continuar, recuerda nuestras directrices:
            </p>
            <ul className="rules-list">
              {REGLAS_ORO.map((regla) => (
                <li key={regla}>{regla}</li>
              ))}
            </ul>
            <button className="btn-primary" style={{ marginTop: 30 }} onClick={() => setModalOpen(false)}>
              Entendido, continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButtons({
  total,
  idx,
  onPrev,
  onNext,
}: {
  total: number;
  idx: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
        {idx + 1} de {total}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-outline" onClick={onPrev} disabled={idx === 0}>
          <span className="material-icons" style={{ fontSize: 18 }}>
            chevron_left
          </span>
        </button>
        <button className="btn-outline" onClick={onNext} disabled={idx === total - 1}>
          <span className="material-icons" style={{ fontSize: 18 }}>
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}
