// Tipos y constantes puros de Desempeño — SIN dependencias de servidor
// (no importa googleapis/sheets). Seguro para usar en componentes cliente.

export const AREAS_ORDEN = [
  "Línea amiga / Chat",
  "G. Empleo",
  "Encuestas",
  "Radicación",
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
}
