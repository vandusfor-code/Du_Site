// Forma NORMALIZADA del resultado para la UI. La produce tanto el Validador
// (resultado recién calculado) como el Historial (filas de Supabase), para
// reutilizar el mismo componente de resultados. Cliente-seguro.

import type { EstadoResultado, Novedad } from "@/lib/empleo/pila-tipos";
import type { ResultadoProcesado } from "./actions";
import type { ValidacionCompleta } from "@/lib/empleo/empleo-store";

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
    id: p.id,
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

function num(v: unknown): number { return Number(v ?? 0); }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }

export function desdeDb(v: ValidacionCompleta): VistaResultado {
  const c = v.cabecera;
  const regsPorPeriodo = new Map<string, RegistroVista[]>();
  for (const r of v.registros) {
    const periodo = String(r.periodo ?? "");
    const rv: RegistroVista = {
      fila: num(r.fila), nit: String(r.nit ?? ""), periodo, fechaPago: String(r.fecha_pago ?? ""),
      aporte: num(r.aporte), diasCot: num(r.dias_cot), ibc: r.ibc == null ? null : num(r.ibc),
      planilla: r.planilla ? String(r.planilla) : null, novedades: arr<Novedad>(r.novedades),
      estado: String(r.estado_registro ?? ""),
    };
    if (!regsPorPeriodo.has(periodo)) regsPorPeriodo.set(periodo, []);
    regsPorPeriodo.get(periodo)!.push(rv);
  }
  const resumen: PeriodoVista[] = v.resumen.map((p) => ({
    periodo: String(p.periodo ?? ""), nits: arr<string>(p.nits), registros: num(p.registros),
    diasReportados: num(p.dias_reportados), diasReconocidos: num(p.dias_reconocidos),
    aporteAcumulado: num(p.aporte_acumulado), novedades: arr<Novedad>(p.novedades),
    estado: String(p.estado ?? ""), excedeLimite: Boolean(p.excede_limite), fueraDeVentana: Boolean(p.fuera_ventana),
    detalle: regsPorPeriodo.get(String(p.periodo ?? "")) ?? [],
  }));
  return {
    id: String(c.id),
    estado: String(c.estado) as EstadoResultado,
    motivo: String(c.motivo ?? ""),
    trabajadorNombre: String(c.trabajador_nombre ?? "—"),
    trabajadorDocumento: String(c.trabajador_documento ?? "—"),
    tipoTrabajador: String(c.tipo_trabajador ?? ""),
    fechaSolicitud: String(c.fecha_solicitud ?? "").slice(0, 10),
    ventana: { desde: String(c.ventana_desde ?? "").slice(0, 10), hasta: String(c.ventana_hasta ?? "").slice(0, 10) },
    diasRequeridos: num(c.dias_requeridos), diasAcreditados: num(c.dias_acreditados),
    diasDiferencia: num(c.dias_diferencia), periodosConAporte: num(c.periodos_con_aporte),
    analisis: {
      registrosLeidos: num((c.analisis as Record<string, unknown>)?.registrosLeidos),
      registrosConAporte: num((c.analisis as Record<string, unknown>)?.registrosConAporte),
      registrosAporteCero: num((c.analisis as Record<string, unknown>)?.registrosAporteCero),
      registrosFueraVentana: num((c.analisis as Record<string, unknown>)?.registrosFueraVentana),
      registrosSospechososDuplicado: num((c.analisis as Record<string, unknown>)?.registrosSospechososDuplicado),
    },
    inconsistencias: arr<{ nivel: string; periodo: string | null; mensaje: string }>(c.inconsistencias),
    resumenPorPeriodo: resumen,
    asesorNombre: String(c.asesor_nombre ?? ""),
    archivoNombre: String(c.archivo_nombre ?? ""),
    creadoEn: String(c.creado_en ?? ""),
    observacionAuto: String(c.observacion_auto ?? ""),
    observacionAsesor: String(c.observacion_asesor ?? ""),
    versionMotor: String(c.version_motor ?? ""),
    advertenciasLectura: [],
  };
}

export const MONEDA = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export function fmtPeriodo(p: string): string {
  if (!/^\d{6}$/.test(p)) return p;
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[parseInt(p.slice(4), 10) - 1] ?? "?"} ${p.slice(0, 4)}`;
}
