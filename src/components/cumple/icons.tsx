// Iconos de línea (SVG propios, trazo uniforme).
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>, w = 1.7): SVGProps<SVGSVGElement> => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: w,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...p,
});

export const Codigo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.9)}>
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </svg>
);
export const Chevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2.2)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const ChevronAbajo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2)}>
    <path d="M6 7l6 6 6-6M6 13l6 6 6-6" />
  </svg>
);
export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2.4)}>
    <path d="M5 12.5l4.5 4.5L19 7.500" />
  </svg>
);
export const Equis = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2.2)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Cohete = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M14.500 4.500c3.200-.9 5 .2 5 .2s1.100 1.800.2 5c-1 3.300-4 6-7 7.300l-5-5c1.300-3 4-6 6.800-7.500z" />
    <circle cx="14.500" cy="9.500" r="1.600" />
    <path d="M7.500 12.500L4 13l2.500 2.500M11.500 16.500L11 20l-2.500-2.500M5 19c-.6 1.100-1 2.500-1 2.500s1.400-.4 2.500-1" />
  </svg>
);
export const Musica = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.8)}>
    <path d="M9 18V5.500l11-2V16" />
    <circle cx="6.500" cy="18" r="2.500" />
    <circle cx="17.500" cy="16" r="2.500" />
  </svg>
);
export const Silencio = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.8)}>
    <path d="M9 18V5.500l6-1.100M9 18a2.500 2.500 0 1 1-2.500-2.500" />
    <path d="M4 4l16 16" />
  </svg>
);
export const Calendario = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.500" y="5" width="17" height="15.500" rx="3" />
    <path d="M3.500 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.500h.01M12 17.500h.01" />
  </svg>
);
export const Reloj = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.500 2" />
  </svg>
);
export const Pin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21s-7-6.200-7-11.500a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
    <circle cx="12" cy="9.500" r="2.600" />
  </svg>
);
export const Mapa = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.500 6.500l5.500-2 6 2 5.500-2v13l-5.500 2-6-2-5.500 2zM9 4.500v13M15 6.500v13" />
  </svg>
);
export const FlechaArriba = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2)}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);
export const Sobre = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.500" />
    <path d="M3.500 7.500L12 13l8.500-5.500" />
  </svg>
);
export const Trago = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M10 3h4v3.500c0 1 1.500 1.800 1.500 3.500V20a1.500 1.500 0 0 1-1.500 1.500h-4A1.500 1.500 0 0 1 8.500 20v-10c0-1.700 1.500-2.500 1.500-3.500z" />
    <path d="M8.500 13.500h7" />
  </svg>
);
export const Comida = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M3.500 12.500h17a8.500 8.500 0 0 1-17 0z" />
    <path d="M8 9c.8-1.200 2-1.800 3-1.800M12.500 9.500c1-1.500 2.300-2 3.500-1.800M9 12c0-1.500.8-2.500 2-3" />
  </svg>
);
export const Regalo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <rect x="3.500" y="8.500" width="17" height="4" rx="1" />
    <path d="M5 12.500V20h14v-7.500M12 8.500V20M12 8.500c-2.500 0-4.500-.8-4.500-2.500S9 3.500 10.500 4.500 12 8.500 12 8.500zM12 8.500c2.500 0 4.500-.8 4.500-2.500s-1.500-2.500-3-1.500S12 8.500 12 8.500z" />
  </svg>
);
export const Foto = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M4 8h3l1.500-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.500" />
  </svg>
);
export const Ropa = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M9 4l-5.500 3 2 4 2-1V20h9v-9.500l2 1 2-4L15 4c-.5 1.500-1.600 2.200-3 2.200S9.500 5.500 9 4z" />
  </svg>
);
export const Estrella = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.6)}>
    <path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.800l-5.200 2.800 1-5.800L3.500 9.700l5.900-.8z" />
  </svg>
);
export const Terminal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 2)}>
    <path d="M4 6l6 6-6 6M12 18h8" />
  </svg>
);
export const Cerveza = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.7)}>
    <path d="M6 9h9v9.500A1.500 1.500 0 0 1 13.500 20h-6A1.500 1.500 0 0 1 6 18.500zM15 11h2.500a1.500 1.500 0 0 1 1.500 1.500v3a1.500 1.500 0 0 1-1.500 1.500H15" />
    <path d="M6 9c-.5-1.800.5-3 2-3 .5-1.500 3-1.500 3.500 0 1.500-.5 3 .5 3.500 3" />
  </svg>
);
export const Campana = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.7)}>
    <path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z" />
    <path d="M10 21h4" />
  </svg>
);
export const Movil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 1.7)}>
    <rect x="7" y="2.500" width="10" height="19" rx="2.500" />
    <path d="M11 18.500h2" />
  </svg>
);

export const ICONOS_LLEVAR = { trago: Trago, comida: Comida, regalo: Regalo, musica: Musica, foto: Foto, ropa: Ropa, otro: Estrella } as const;
