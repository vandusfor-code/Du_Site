// ============================================================
// Gestión de empleo — Validador PILA · tipos + configuración PURA.
// Sin dependencias de servidor (cliente-seguro). El motor de reglas
// (pila-motor.ts) es determinístico y se prueba contra estos tipos.
// ============================================================

export type TipoTrabajador = "dependiente" | "independiente";
export type EstadoResultado = "CUMPLE" | "NO_CUMPLE" | "REQUIERE_REVISION";
export type EstadoRegistro = "contabilizado" | "excluido" | "revisar";

// Parámetros OPERATIVOS de esta primera versión. NO son criterio normativo
// confirmado por COFREM: son los umbrales de trabajo acordados para el MVP y
// deben validarse contra el procedimiento oficial antes de producción.
export interface ConfigReglas {
  /** Versión del motor de reglas (trazabilidad: cada resultado guarda con qué reglas se calculó). */
  version: string;
  /** Días mínimos requeridos por tipo de trabajador. */
  diasRequeridos: Record<TipoTrabajador, number>;
  /** Años hacia atrás desde la fecha de solicitud que definen la ventana de evaluación. */
  ventanaAnios: number;
  /** Máximo de días reconocidos por periodo mensual (se consolidan varias empresas/registros). */
  maxDiasPorPeriodo: number;
}

export const CONFIG_REGLAS: ConfigReglas = {
  version: "pila-1.0.0",
  diasRequeridos: { dependiente: 360, independiente: 720 },
  ventanaAnios: 3,
  maxDiasPorPeriodo: 30,
};

// Las 9 novedades del reporte, en el orden del encabezado. INFORMATIVAS: no
// afectan el cálculo (no se descuentan días sin una regla aprobada por COFREM).
export const NOVEDADES = [
  "retiro",
  "variacionPermanente",
  "variacionTemporal",
  "ingreso",
  "licenciaNoRemunerada",
  "enfermedadGeneral",
  "licenciaMaternidad",
  "vacaciones",
  "accidenteLaboral",
] as const;
export type Novedad = (typeof NOVEDADES)[number];

export const ETIQUETA_NOVEDAD: Record<Novedad, string> = {
  retiro: "Retiro",
  variacionPermanente: "Variación permanente",
  variacionTemporal: "Variación temporal",
  ingreso: "Ingreso",
  licenciaNoRemunerada: "Licencia no remunerada",
  enfermedadGeneral: "Enfermedad general",
  licenciaMaternidad: "Licencia maternidad",
  vacaciones: "Vacaciones",
  accidenteLaboral: "Accidente laboral",
};

// Un registro de aporte tal como se extrae del PDF (una fila de la tabla).
export interface RegistroPila {
  /** Índice de fila en el documento (para trazabilidad y detección de duplicados). */
  fila: number;
  nit: string;
  periodo: string; // AAAAMM
  fechaPago: string; // dd/mm/yyyy tal como viene en el PDF
  aporte: number;
  salarioBasico: number | null;
  diasCot: number;
  ibc: number | null;
  planilla: string | null;
  novedades: Novedad[]; // las que vienen en "Si" (informativas)
  /** Línea cruda del PDF, para auditoría. */
  crudo: string;
}

export interface MetaTrabajador {
  documento: string | null;
  nombre: string | null;
  periodoInicial: string | null;
  periodoFinal: string | null;
  fechaGeneracion: string | null;
}

export type NivelInconsistencia = "info" | "advertencia" | "critica";
export interface Inconsistencia {
  nivel: NivelInconsistencia;
  periodo: string | null;
  mensaje: string;
}

// Consolidación de un periodo (AAAAMM): junta todos sus registros.
export interface ResumenPeriodo {
  periodo: string; // AAAAMM
  nits: string[];
  registros: number;
  diasReportados: number; // suma de Días Cot de registros con aporte > 0
  diasReconocidos: number; // tras aplicar el límite mensual
  aporteAcumulado: number;
  novedades: Novedad[];
  estado: EstadoRegistro;
  excedeLimite: boolean;
  fueraDeVentana: boolean;
  detalle: RegistroPila[]; // todos los registros originales del periodo (incluye aporte 0)
}

export interface ResultadoValidacion {
  estado: EstadoResultado;
  motivo: string;
  tipoTrabajador: TipoTrabajador;
  fechaSolicitud: string; // ISO YYYY-MM-DD
  ventana: { desde: string; hasta: string }; // ISO
  diasRequeridos: number;
  diasAcreditados: number;
  diasDiferencia: number; // acreditados - requeridos (negativo = faltantes)
  periodosConAporte: number;
  resumenPorPeriodo: ResumenPeriodo[];
  inconsistencias: Inconsistencia[];
  analisis: {
    registrosLeidos: number;
    registrosConAporte: number;
    registrosAporteCero: number;
    registrosFueraVentana: number;
    registrosSospechososDuplicado: number;
  };
  versionMotor: string;
}
