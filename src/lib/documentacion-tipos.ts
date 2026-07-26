// Tipos y metadatos puros de Documentación Operativa — SIN dependencias de
// servidor (no importa supabase). Seguro para componentes cliente.

// Mapeo de estado técnico (Supabase) → etiqueta legible + tono visual.
export const ESTADO_META: Record<string, { label: string; tone: string }> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  en_elaboracion: { label: "En elaboración", tone: "amber" },
  en_revision: { label: "En revisión", tone: "red" },
  correccion_requerida: { label: "Corrección requerida", tone: "redStrong" },
  aprobado: { label: "Publicado", tone: "green" },
  archivado: { label: "Archivado", tone: "neutral" },
};

export function estadoLabel(estado: string): string {
  return ESTADO_META[estado]?.label ?? estado;
}

export interface ProcedimientoDoc {
  id: string;
  titulo: string;
  descripcion: string;
  aplicativo: string;
  responsable: string | null;
  estado: string;
  fechaLimite: string; // "" si no hay
  urgency: "danger" | "warning" | "normal";
  version: string; // "—" si no hay
}

export interface PropuestoDoc {
  id: string;
  nombre: string;
  condicion: string;
  origen: string;
  fecha: string;
}

export interface DashboardDocumentacion {
  kpi: {
    asignados: number;
    enElaboracion: number;
    porRevisar: number;
    publicados: number;
  };
  procedimientos: ProcedimientoDoc[];
  propuestos: PropuestoDoc[];
  aplicativos: string[];
  estados: string[];
}

export interface AplicativoOpcion {
  id: string;
  nombre: string;
}

export interface AsesoraOpcion {
  id: string;
  nombre: string;
}

export interface NuevaAsignacionInput {
  aplicativoId: string;
  titulo: string;
  asesoraId: string;
  fechaLimite: string | null; // "YYYY-MM-DD" o null
}

export type ResultadoAsignacion =
  | { ok: true }
  | { ok: false; error: string };

// ============================================================
// Editor de documentación (experiencia de la asesora) — tipos puros.
// ============================================================

export function formatearFecha(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  const MESES3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MESES3[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export interface PasoProcedimiento {
  id: string;
  orden: number;
  instruccion: string;
  imagenPath: string | null;
  imagenNoAplica: boolean;
  imagenUrl: string | null;
}

export interface ValidacionProcedimiento {
  id: string;
  orden: number;
  descripcion: string;
}

export interface ErrorProcedimiento {
  id: string;
  orden: number;
  descripcion: string;
}

export interface RelacionProcedimiento {
  id: string;
  condicion: string;
  destinoId: string | null;
  destinoTitulo: string | null;
  destinoAplicativo: string | null;
  propuesto: string | null;
  estado: "vinculado" | "propuesto" | "descartado";
}

export interface ProcedimientoBuscable {
  id: string;
  titulo: string;
  aplicativo: string;
}

export interface DetalleProcedimiento {
  id: string;
  titulo: string;
  aplicativo: string;
  estado: string;
  paraQueSirve: string;
  cuandoSeUtiliza: string;
  pasos: PasoProcedimiento[];
  resultadoEsperado: string;
  resultadoNoAplica: boolean;
  validaciones: ValidacionProcedimiento[];
  validacionesNoAplica: boolean;
  relaciones: RelacionProcedimiento[];
  relacionesNoAplica: boolean;
  errores: ErrorProcedimiento[];
  erroresNoAplica: boolean;
  observaciones: string;
  observacionesNoAplica: boolean;
}

export const SECCIONES_DOC: { n: number; label: string }[] = [
  { n: 1, label: "Propósito" },
  { n: 2, label: "Cuándo se utiliza" },
  { n: 3, label: "Paso a paso" },
  { n: 4, label: "Resultado" },
  { n: 5, label: "Validaciones" },
  { n: 6, label: "Procedimientos relacionados" },
  { n: 7, label: "Errores frecuentes" },
  { n: 8, label: "Observaciones" },
];

export interface ProgresoDoc {
  completadas: number;
  total: number;
  pct: number;
  porSeccion: boolean[]; // índice 0 = sección 1 ... índice 7 = sección 8
}

export function calcularProgreso(d: DetalleProcedimiento): ProgresoDoc {
  const porSeccion = [
    d.paraQueSirve.trim().length > 0,
    d.cuandoSeUtiliza.trim().length > 0,
    d.pasos.some((p) => p.instruccion.trim().length > 0),
    d.resultadoNoAplica || d.resultadoEsperado.trim().length > 0,
    d.validacionesNoAplica || d.validaciones.some((v) => v.descripcion.trim().length > 0),
    d.relacionesNoAplica ||
      d.relaciones.some((r) => r.condicion.trim().length > 0 && (!!r.destinoId || !!(r.propuesto && r.propuesto.trim()))),
    d.erroresNoAplica || d.errores.some((e) => e.descripcion.trim().length > 0),
    d.observacionesNoAplica || d.observaciones.trim().length > 0,
  ];
  const completadas = porSeccion.filter(Boolean).length;
  return { completadas, total: 8, pct: Math.round((completadas / 8) * 100), porSeccion };
}

export interface PendienteDocumentacion {
  asignacionId: string;
  procedimientoId: string;
  titulo: string;
  aplicativo: string;
  fechaLimite: string; // "" si no hay
  fechaLimiteTs?: number; // epoch ms para ordenar por urgencia (no para mostrar)
  estado: string;
  accion: "Comenzar" | "Continuar" | "Corregir";
}

// Etiqueta de estado tal como la ve la ASESORA (mockup): "Por revisar"/"Aprobado"
// en vez de "En revisión"/"Publicado". No cambia los estados reales de la BD.
export const ESTADO_ASESORA_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_elaboracion: "En elaboración",
  en_revision: "Por revisar",
  correccion_requerida: "Corrección requerida",
  aprobado: "Aprobado",
  archivado: "Archivado",
};

// Acción según el estado real del procedimiento. Todas navegan al editor [id].
export function accionPorEstado(estado: string): string {
  switch (estado) {
    case "pendiente":
      return "Comenzar";
    case "en_elaboracion":
      return "Continuar";
    case "correccion_requerida":
      return "Corregir";
    case "en_revision":
      return "Ver";
    case "aprobado":
      return "Ver procedimiento";
    default:
      return "Ver";
  }
}

export interface MiProcedimientoFila {
  id: string;
  titulo: string;
  descripcion: string; // para_que_sirve o "" (nunca texto ficticio)
  aplicativo: string;
  estado: string; // estado real de la BD
  progresoCompletadas: number;
  progresoPct: number;
  fechaLimite: string; // formateada o ""
  fechaLimiteTs?: number;
  fechaAsignacionTs?: number; // para orden "Más recientes"
}

export interface MisProcedimientosData {
  kpi: {
    pendientes: number;
    enElaboracion: number;
    porRevisar: number;
    correccionRequerida: number;
    aprobados: number;
  };
  procedimientos: MiProcedimientoFila[];
  aplicativos: string[];
  estados: string[];
}
