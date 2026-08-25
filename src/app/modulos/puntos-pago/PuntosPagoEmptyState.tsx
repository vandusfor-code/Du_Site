"use client";

import { MapPin, Search } from "lucide-react";

export function PuntosPagoEmptyState({
  variante,
  onLimpiar,
}: {
  variante: "inicial" | "sin-resultados";
  onLimpiar?: () => void;
}) {
  if (variante === "sin-resultados") {
    return (
      <div className="pp-empty">
        <div className="pp-emptyIcon">
          <Search size={28} />
        </div>
        <h2>No encontramos puntos de pago</h2>
        <p>No hay puntos que coincidan con tu búsqueda. Intenta con otra ciudad, municipio o dirección.</p>
        {onLimpiar ? (
          <button type="button" className="pp-outline" onClick={onLimpiar}>
            Limpiar búsqueda
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pp-empty">
      <div className="pp-emptyIcon">
        <MapPin size={28} />
      </div>
      <h2>Busca un punto de pago</h2>
      <p>Escribe una ciudad, municipio, punto o dirección para comenzar.</p>
    </div>
  );
}
