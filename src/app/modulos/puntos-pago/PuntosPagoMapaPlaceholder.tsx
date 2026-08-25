"use client";

/** Placeholder visual del mapa. Acepta lat/lng para sustituirse después por un mapa real. */
export function PuntosPagoMapaPlaceholder({
  latitud,
  longitud,
  nombre,
}: {
  latitud: number | null;
  longitud: number | null;
  nombre: string;
}) {
  return (
    <div
      className="pp-map"
      role="img"
      aria-label={latitud != null && longitud != null ? `Mapa de ${nombre}` : `Mapa pendiente de ${nombre}`}
      data-lat={latitud ?? undefined}
      data-lng={longitud ?? undefined}
    >
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="ppMapBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e7eef6" />
            <stop offset="100%" stopColor="#dce6f0" />
          </linearGradient>
        </defs>
        <rect width="400" height="220" fill="url(#ppMapBg)" />
        <g stroke="#c5d0dc" strokeWidth="6" fill="none">
          <path d="M0 70 H400" />
          <path d="M0 130 H400" />
          <path d="M0 180 H400" />
          <path d="M90 0 V220" />
          <path d="M180 0 V220" />
          <path d="M270 0 V220" />
          <path d="M340 0 V220" />
        </g>
        <g stroke="#b7c4d2" strokeWidth="3" fill="none">
          <path d="M0 40 H400" />
          <path d="M0 100 H400" />
          <path d="M0 155 H400" />
          <path d="M45 0 V220" />
          <path d="M135 0 V220" />
          <path d="M225 0 V220" />
          <path d="M310 0 V220" />
        </g>
        <g fill="#cfd8e3">
          <rect x="20" y="18" width="48" height="32" rx="3" />
          <rect x="102" y="48" width="56" height="40" rx="3" />
          <rect x="198" y="12" width="44" height="50" rx="3" />
          <rect x="286" y="78" width="62" height="36" rx="3" />
          <rect x="48" y="148" width="70" height="42" rx="3" />
          <rect x="210" y="142" width="52" height="38" rx="3" />
          <rect x="318" y="150" width="48" height="44" rx="3" />
        </g>
        <path d="M40 200 Q120 160 200 175 T360 150" stroke="#9fb4c9" strokeWidth="8" fill="none" />
      </svg>
      <div className="pp-mapPin">
        <svg width="40" height="48" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true">
          <path d="M12 0C6.5 0 2 4.4 2 9.8c0 7.2 10 18.2 10 18.2s10-11 10-18.2C22 4.4 17.5 0 12 0zm0 13.2a3.4 3.4 0 110-6.8 3.4 3.4 0 010 6.8z" />
        </svg>
      </div>
    </div>
  );
}
