"use client";

import { ArrowLeft, Clock3, LayoutGrid, MapPin, Navigation } from "lucide-react";
import type { PuntoPago } from "@/lib/puntos-pago-tipos";
import { urlComoLlegar } from "@/lib/puntos-pago-tipos";
import { PuntosPagoMapaPlaceholder } from "./PuntosPagoMapaPlaceholder";

export function PuntosPagoDetalle({
  punto,
  onCerrar,
}: {
  punto: PuntoPago | null;
  onCerrar: () => void;
}) {
  if (!punto) {
    return (
      <aside className="pp-card pp-detail pp-detailEmpty">
        <div className="pp-emptyIcon">
          <MapPin size={26} />
        </div>
        <h2>Selecciona un punto</h2>
        <p>Pulsa Ver detalles en cualquier fila para consultar la información.</p>
      </aside>
    );
  }

  const maps = urlComoLlegar(punto);
  const horario = punto.horario?.trim() || "Horario no disponible";

  return (
    <aside className="pp-card pp-detail">
      <button type="button" className="pp-back" onClick={onCerrar}>
        <ArrowLeft size={15} /> Volver a resultados
      </button>

      <div className="pp-detailHead">
        <div className="pp-detailIcon">
          <MapPin size={20} />
        </div>
        <div>
          <h2>{punto.nombre}</h2>
          <span className="pp-badge">{punto.red}</span>
        </div>
      </div>

      <PuntosPagoMapaPlaceholder latitud={punto.latitud} longitud={punto.longitud} nombre={punto.nombre} />

      <div className="pp-info">
        <div className="pp-infoRow">
          <i><MapPin size={15} /></i>
          <div>
            <small>Dirección</small>
            <b>
              {punto.direccion}
              {"\n"}
              {punto.ciudad}, {punto.departamento}
            </b>
          </div>
        </div>
        <div className="pp-infoRow">
          <i><LayoutGrid size={15} /></i>
          <div>
            <small>Red</small>
            <b>{punto.red}</b>
          </div>
        </div>
        <div className="pp-infoRow">
          <i><Clock3 size={15} /></i>
          <div>
            <small>Horario</small>
            <b>{horario}</b>
          </div>
        </div>
      </div>

      {maps ? (
        <a className="pp-llegar" href={maps} target="_blank" rel="noopener noreferrer">
          <Navigation size={16} /> Cómo llegar
        </a>
      ) : (
        <button type="button" className="pp-llegar pp-disabled" disabled>
          <Navigation size={16} /> Cómo llegar
        </button>
      )}
    </aside>
  );
}
