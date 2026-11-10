// Tipos y constantes puros de Desempeño — SIN dependencias de servidor
// (no importa googleapis/sheets). Seguro para usar en componentes cliente.

export const AREAS_ORDEN = [
  "Línea amiga / Chat",
  "G. Empleo",
  "Encuestas",
  "Radicación",
  "G. Empleo / Radicación", // Joselyn: está en las dos, categoría propia
  "G. Empleo Cofrem",
] as const;
export type Area = (typeof AREAS_ORDEN)[number];

export type CampoDesempeno =
  | "usuario" | "funcionario" | "area" | "fecha" | "satisfaccion" | "calidadLlamada"
  | "pec" | "penc" | "productividad" | "adherencia" | "bono"
  | "pqrsfCreados" | "pqrsfDevueltos" | "auditorias"
  | "precision" | "errorRespuesta"
  | "radicadosPct" | "snc" | "sncRecibidos" | "cantidadRadicados" | "correccion" | "sncSolucionados";

export const LABELS: Record<CampoDesempeno, string> = {
  usuario: "Usuario", funcionario: "Funcionario", area: "Área", fecha: "Fecha",
  satisfaccion: "Satisfacción", calidadLlamada: "Calidad de la llamada",
  pec: "PEC", penc: "PENC", productividad: "Productividad", adherencia: "Adherencia", bono: "Bono Ganado",
  pqrsfCreados: "PQRSF Creados", pqrsfDevueltos: "PQRSF Devueltos", auditorias: "Cantidad Auditorías",
  precision: "Precisión Ortográfica", errorRespuesta: "Error de Respuesta",
  radicadosPct: "Radicados", snc: "SNC", sncRecibidos: "SNC Recibidos",
  cantidadRadicados: "Cantidad Radicados", correccion: "Por corrección", sncSolucionados: "SNC Solucionados",
};

export interface FuncionarioDesempeno {
  usuario: string;
  funcionario: string;
  area: Area;
  fecha: string;
  valores: Partial<Record<CampoDesempeno, string>>;
}

// Campos que Du Site calcula solo (PEC/PENC de auditorías; conteos de Radicación).
// Solo el Admin los puede sobreescribir; el Coordinador no.
export const CAMPOS_AUTOMATICOS: CampoDesempeno[] = [
  "pec", "penc", "radicadosPct", "snc", "sncRecibidos", "cantidadRadicados", "sncSolucionados", "correccion", "auditorias",
];
export function esCampoAutomatico(c: CampoDesempeno): boolean {
  return CAMPOS_AUTOMATICOS.includes(c);
}

// Campos capturables en el panel por área (en orden). El "bono" nunca se edita
// (lo calcula la fórmula de la hoja); identidad (usuario/funcionario/area) tampoco.
export const CAMPOS_EDITABLES_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["satisfaccion", "pec", "penc", "productividad", "adherencia", "pqrsfCreados", "pqrsfDevueltos", "auditorias"],
  "G. Empleo": ["satisfaccion", "pec", "penc", "productividad", "adherencia"],
  "Encuestas": ["calidadLlamada", "pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta"],
  "Radicación": ["productividad", "radicadosPct", "snc", "precision", "adherencia", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados"],
  // Joselyn (G. Empleo + Radicación): calidad de llamada + radicación.
  "G. Empleo / Radicación": ["satisfaccion", "pec", "penc", "radicadosPct", "snc", "adherencia", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados"],
  "G. Empleo Cofrem": ["pec", "penc", "auditorias"],
};

// Métricas que llevan "%": para el input mostramos/guardamos con %.
export const CAMPOS_PORCENTAJE: CampoDesempeno[] = [
  "satisfaccion", "calidadLlamada", "pec", "penc", "productividad", "adherencia", "precision", "radicadosPct", "snc",
];

export interface DesempenoFiltros {
  area?: string;
  busqueda?: string;
  /** "" = mes en curso (TO vivo); "YYYY-MM" = un mes cerrado del histórico. */
  mes?: string;
}

export interface FilaTabla {
  usuario: string;
  funcionario: string;
  area: Area;
  valores: Partial<Record<CampoDesempeno, string>>;
}

export interface ResultadoCierre {
  mes: string;
  mesLabel: string;
  guardados: number;
  actualizados: number;
}

export interface DashboardDesempeno {
  kpi: {
    funcionariosActivos: number;
    pecPromedio: number | null;
    pencPromedio: number | null;
    bonosGenerados: number;
    bonosGeneradosLabel: string;
    tendencia: {
      funcionarios: number | null;
      pec: number | null;
      penc: number | null;
      bonos: number | null;
    };
    sparklines: {
      funcionarios: number[];
      pec: number[];
      penc: number[];
      bonos: number[];
    };
    hayHistorico: boolean;
  };
  indicadores: { nombre: string; pct: number }[];
  ranking: { funcionario: string; pec: string; penc: string; bono: string }[];
  bonificacion: {
    total: number;
    totalLabel: string;
    porArea: { area: string; monto: number; montoLabel: string; pct: number }[];
  };
  tabla: {
    columnas: CampoDesempeno[];
    filas: FilaTabla[];
  };
  areasDisponibles: string[];
  labels: Record<string, string>;
  bloquesDesconocidos: number;
  /** true si se está viendo un mes cerrado del histórico. */
  esHistorico: boolean;
  /** Etiqueta del período mostrado ("Mes en curso" o "Julio 2026"). */
  mesActualLabel: string;
  /** Opciones del selector de mes. */
  mesesDisponibles: { value: string; label: string }[];
  /** Mes activo del libro (celda MES_ACTIVO de la hoja), p.ej. "Septiembre". */
  mesActivoNombre: string;
  /** Mes al que pasaría al cerrar, p.ej. "Octubre". */
  mesActivoSiguiente: string;
}
