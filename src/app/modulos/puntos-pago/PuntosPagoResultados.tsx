"use client";

import { MapPin } from "lucide-react";
import type { OrdenPuntosPago, PuntoPago } from "@/lib/puntos-pago-tipos";
import { FILAS_POR_PAGINA } from "@/lib/puntos-pago-tipos";
import { PuntosPagoEmptyState } from "./PuntosPagoEmptyState";
import { PuntosPagoPaginacion } from "./PuntosPagoPaginacion";
import { PuntosPagoTabla } from "./PuntosPagoTabla";

export function PuntosPagoResultados({
  consultaActiva,
  etiqueta,
  total,
  orden,
  onOrden,
  pagina,
  onPagina,
  paginaPuntos,
  seleccionadoId,
  onSeleccionar,
  onCopiar,
  onCompartir,
  onLimpiar,
}: {
  consultaActiva: boolean;
  etiqueta: string;
  total: number;
  orden: OrdenPuntosPago;
  onOrden: (orden: OrdenPuntosPago) => void;
  pagina: number;
  onPagina: (n: number) => void;
  paginaPuntos: PuntoPago[];
  seleccionadoId: string | null;
  onSeleccionar: (punto: PuntoPago) => void;
  onCopiar: (texto: string) => void;
  onCompartir: (punto: PuntoPago) => void;
  onLimpiar: () => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA));
  const desde = total === 0 ? 0 : (pagina - 1) * FILAS_POR_PAGINA + 1;
  const hasta = Math.min(pagina * FILAS_POR_PAGINA, total);

  if (!consultaActiva) {
    return (
      <div className="pp-card">
        <PuntosPagoEmptyState variante="inicial" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="pp-card">
        <PuntosPagoEmptyState variante="sin-resultados" onLimpiar={onLimpiar} />
      </div>
    );
  }

  return (
    <div>
      <div className="pp-summary">
        <div className="pp-summaryLeft">
          <div className="pp-sumIcon">
            <MapPin size={18} />
          </div>
          <div>
            <b>{etiqueta}</b>
            <span>
              {total} punto{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <label className="pp-sort">
          Ordenar por:
          <select value={orden} onChange={(e) => onOrden(e.target.value as OrdenPuntosPago)}>
            <option value="nombre-asc">Nombre (A - Z)</option>
            <option value="nombre-desc">Nombre (Z - A)</option>
          </select>
        </label>
      </div>

      <div className="pp-card">
        <PuntosPagoTabla
          puntos={paginaPuntos}
          seleccionadoId={seleccionadoId}
          onSeleccionar={onSeleccionar}
          onCopiar={onCopiar}
          onCompartir={onCompartir}
        />
        <PuntosPagoPaginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          desde={desde}
          hasta={hasta}
          total={total}
          onPagina={onPagina}
        />
      </div>
    </div>
  );
}
