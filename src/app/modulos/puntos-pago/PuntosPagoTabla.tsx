"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, MapPin, MoreVertical, Navigation, Share2 } from "lucide-react";
import type { PuntoPago } from "@/lib/puntos-pago-tipos";
import { urlComoLlegar } from "@/lib/puntos-pago-tipos";

export function PuntosPagoTabla({
  puntos,
  seleccionadoId,
  onSeleccionar,
  onCopiar,
  onCompartir,
}: {
  puntos: PuntoPago[];
  seleccionadoId: string | null;
  onSeleccionar: (punto: PuntoPago) => void;
  onCopiar: (texto: string) => void;
  onCompartir: (punto: PuntoPago) => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <>
      <div className="pp-tableWrap">
        <table>
          <thead>
            <tr>
              <th>Punto de pago</th>
              <th>Dirección</th>
              <th>Red</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => {
              const maps = urlComoLlegar(p);
              return (
                <tr
                  key={p.id}
                  className={`pp-row${seleccionadoId === p.id ? " pp-rowOn" : ""}`}
                  onClick={() => onSeleccionar(p)}
                >
                  <td>
                    <span className="pp-punto">
                      <i><MapPin size={14} /></i>
                      {p.nombre}
                    </span>
                  </td>
                  <td>
                    <span className="pp-dir">
                      <i><MapPin size={13} /></i>
                      {p.direccion}
                    </span>
                  </td>
                  <td>
                    <span className="pp-badge">{p.red}</span>
                  </td>
                  <td>
                    <div className="pp-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="pp-ver" onClick={() => onSeleccionar(p)}>
                        <Eye size={15} />
                        <span>Ver detalles</span>
                      </button>
                      <div className="pp-moreWrap" ref={menuId === p.id ? menuRef : undefined} style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`pp-more${menuId === p.id ? " pp-moreOn" : ""}`}
                          aria-label="Más acciones"
                          onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuId === p.id && (
                          <div className="pp-menu">
                            <button type="button" onClick={() => { onSeleccionar(p); setMenuId(null); }}>
                              <Eye size={15} /> Ver detalles
                            </button>
                            <button
                              type="button"
                              disabled={!maps}
                              onClick={() => {
                                if (maps) window.open(maps, "_blank", "noopener,noreferrer");
                                setMenuId(null);
                              }}
                            >
                              <Navigation size={15} /> Cómo llegar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onCopiar(`${p.direccion}, ${p.ciudad}, ${p.departamento}`);
                                setMenuId(null);
                              }}
                            >
                              <Copy size={15} /> Copiar dirección
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onCompartir(p);
                                setMenuId(null);
                              }}
                            >
                              <Share2 size={15} /> Compartir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pp-cards">
        {puntos.map((p) => (
          <article
            key={p.id}
            className={`pp-mCard${seleccionadoId === p.id ? " pp-rowOn" : ""}`}
            onClick={() => onSeleccionar(p)}
          >
            <div className="pp-mCardTop">
              <span className="pp-punto">
                <i><MapPin size={14} /></i>
                {p.nombre}
              </span>
              <span className="pp-badge">{p.red}</span>
            </div>
            <div className="pp-mMeta">
              <MapPin size={13} /> {p.direccion}
            </div>
            <div className="pp-actions">
              <button
                type="button"
                className="pp-ver"
                onClick={(e) => {
                  e.stopPropagation();
                  onSeleccionar(p);
                }}
              >
                <Eye size={15} />
                <span>Ver detalles</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
