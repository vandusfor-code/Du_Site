// Forma NORMALIZADA del resultado para la UI (cliente-segura). La produce el
// Validador a partir del resultado recién calculado. No se persiste nada.

import type { EstadoResultado, Novedad } from "@/lib/empleo/pila-tipos";
import type { ResultadoProcesado } from "./actions";

export interface RegistroVista {
  fila: number;
  nit: string;
  periodo: string;
  fechaPago: string;
  aporte: number;
  diasCot: number;
  ibc: number | null;
  planilla: string | null;
  novedades: Novedad[];
  estado: string;
}

export interface PeriodoVista {
  periodo: string;
  nits: string[];
  registros: number;
  diasReportados: number;
  diasReconocidos: number;
  aporteAcumulado: number;
  novedades: Novedad[];
  estado: string;
  excedeLimite: boolean;
  fueraDeVentana: boolean;
  detalle: RegistroVista[];
}

export interface VistaResultado {
  id: string | null;
  estado: EstadoResultado;
  motivo: string;
  trabajadorNombre: string;
  trabajadorDocumento: string;
  tipoTrabajador: string;
  fechaSolicitud: string;
  ventana: { desde: string; hasta: string };
  diasRequeridos: number;
  diasAcreditados: number;
  diasDiferencia: number;
  periodosConAporte: number;
  analisis: { registrosLeidos: number; registrosConAporte: number; registrosAporteCero: number; registrosFueraVentana: number; registrosSospechososDuplicado: number };
  inconsistencias: { nivel: string; periodo: string | null; mensaje: string }[];
  resumenPorPeriodo: PeriodoVista[];
  asesorNombre: string;
  archivoNombre: string;
  creadoEn: string | null;
  observacionAuto: string;
  observacionAsesor: string;
  versionMotor: string;
  advertenciasLectura: string[];
}

export function desdeResultado(p: ResultadoProcesado): VistaResultado {
  const r = p.resultado;
  return {
    id: null,
    estado: r.estado,
    motivo: r.motivo,
    trabajadorNombre: p.meta.nombre ?? "—",
    trabajadorDocumento: p.meta.documento ?? "—",
    tipoTrabajador: r.tipoTrabajador,
    fechaSolicitud: r.fechaSolicitud,
    ventana: r.ventana,
    diasRequeridos: r.diasRequeridos,
    diasAcreditados: r.diasAcreditados,
    diasDiferencia: r.diasDiferencia,
    periodosConAporte: r.periodosConAporte,
    analisis: r.analisis,
    inconsistencias: r.inconsistencias,
    resumenPorPeriodo: r.resumenPorPeriodo.map((pp) => ({
      periodo: pp.periodo, nits: pp.nits, registros: pp.registros,
      diasReportados: pp.diasReportados, diasReconocidos: pp.diasReconocidos,
      aporteAcumulado: pp.aporteAcumulado, novedades: pp.novedades, estado: pp.estado,
      excedeLimite: pp.excedeLimite, fueraDeVentana: pp.fueraDeVentana,
      detalle: pp.detalle.map((d) => ({
        fila: d.fila, nit: d.nit, periodo: d.periodo, fechaPago: d.fechaPago, aporte: d.aporte,
        diasCot: d.diasCot, ibc: d.ibc, planilla: d.planilla, novedades: d.novedades,
        estado: d.aporte <= 0 ? "excluido" : (pp.estado === "excluido" ? "excluido" : "contabilizado"),
      })),
    })),
    asesorNombre: p.asesorNombre,
    archivoNombre: p.archivoNombre,
    creadoEn: null,
    observacionAuto: p.observacionAuto,
    observacionAsesor: "",
    versionMotor: r.versionMotor,
    advertenciasLectura: p.advertenciasLectura,
  };
}

export const MONEDA = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export function fmtPeriodo(p: string): string {
  if (!/^\d{6}$/.test(p)) return p;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[parseInt(p.slice(4), 10) - 1] ?? "?"} ${p.slice(0, 4)}`;
}
