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
