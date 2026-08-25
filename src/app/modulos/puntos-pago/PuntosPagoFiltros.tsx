"use client";

import type { FiltrosPuntosPago } from "@/lib/puntos-pago-tipos";
import { Search, X } from "lucide-react";

export function PuntosPagoFiltros({
  filtros,
  departamentos,
  ciudades,
  redes,
  onChange,
}: {
  filtros: FiltrosPuntosPago;
  departamentos: string[];
  ciudades: string[];
  redes: string[];
  onChange: (next: Partial<FiltrosPuntosPago>) => void;
}) {
  return (
    <section className="pp-filters" aria-label="Buscador y filtros">
      <label className="pp-search">
        <Search size={18} />
        <input
          value={filtros.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Buscar por ciudad, municipio, punto o dirección..."
          aria-label="Buscar por ciudad, municipio, punto o dirección"
        />
        {filtros.q ? (
          <button
            type="button"
            className="pp-searchClear"
            onClick={() => onChange({ q: "" })}
            aria-label="Limpiar búsqueda"
          >
            <X size={12} />
          </button>
        ) : null}
      </label>

      <label className="pp-field">
        Departamento
        <select
          value={filtros.departamento}
          onChange={(e) => onChange({ departamento: e.target.value, ciudad: "Todos" })}
        >
          <option value="Todos">Todos</option>
          {departamentos.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      <label className="pp-field">
        Ciudad / Municipio
        <select
          value={filtros.ciudad}
          onChange={(e) => onChange({ ciudad: e.target.value })}
        >
          <option value="Todos">Todos</option>
          {ciudades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="pp-field">
        Red
        <select
          value={filtros.red}
          onChange={(e) => onChange({ red: e.target.value })}
        >
          <option value="Todas">Todas</option>
          {redes.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
