"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { paginasVisibles } from "@/lib/puntos-pago-tipos";

export function PuntosPagoPaginacion({
  pagina,
  totalPaginas,
  desde,
  hasta,
  total,
  onPagina,
}: {
  pagina: number;
  totalPaginas: number;
  desde: number;
  hasta: number;
  total: number;
  onPagina: (n: number) => void;
}) {
  const paginas = paginasVisibles(pagina, totalPaginas);

  return (
    <footer className="pp-foot">
      <div className="pp-pages">
        <button type="button" disabled={pagina === 1} onClick={() => onPagina(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        {paginas.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="pp-ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === pagina ? "pp-pageOn" : undefined}
              onClick={() => onPagina(p)}
            >
              {p}
            </button>
          )
        )}
        <button type="button" disabled={pagina === totalPaginas} onClick={() => onPagina(pagina + 1)} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </button>
      </div>
      <span>
        Mostrando {total === 0 ? 0 : desde} a {hasta} de {total} punto{total === 1 ? "" : "s"}
      </span>
    </footer>
  );
}
