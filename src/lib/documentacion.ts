import "server-only";
import { getSupabase } from "@/lib/supabase";
import type { DashboardDocumentacion, ProcedimientoDoc, PropuestoDoc } from "@/lib/documentacion-tipos";

// ============================================================
// Documentación Operativa — capa de datos (solo lectura) sobre Supabase.
// Sheets no se toca. Solo consulta las tablas ya existentes; no crea ni
// modifica nada. Se usa exclusivamente desde servidor.
// ============================================================

const MESES3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fmtFecha(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MESES3[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function urgencia(fechaLimite: unknown, estado: string): "danger" | "warning" | "normal" {
  if (!fechaLimite || estado === "aprobado" || estado === "archivado") return "normal";
  const d = new Date(String(fechaLimite));
  if (isNaN(d.getTime())) return "normal";
  const dias = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (dias <= 1) return "danger";
  if (dias <= 5) return "warning";
  return "normal";
}

interface FilaAplicativo { id: string; nombre: string | null }
interface FilaProcedimiento { id: string; aplicativo_id: string | null; titulo: string | null; para_que_sirve: string | null; estado: string | null; version: string | number | null }
interface FilaAsignacion { procedimiento_id: string | null; asesora_id: string | null; fecha_limite: string | null; estado: string | null; fecha_asignacion: string | null }
interface FilaAsesora { id: string; nombre: string | null }
interface FilaRelacion { id: string; procedimiento_origen_id: string | null; condicion: string | null; procedimiento_propuesto: string | null; estado: string | null; created_at: string | null }

export async function obtenerDashboardDocumentacion(): Promise<DashboardDocumentacion> {
  const sb = getSupabase();

  const [apRes, procRes, asigRes, asesRes, relRes] = await Promise.all([
    sb.from("aplicativos").select("id, nombre"),
    sb.from("procedimientos").select("id, aplicativo_id, titulo, para_que_sirve, estado, version"),
    sb.from("asignaciones_documentacion").select("procedimiento_id, asesora_id, fecha_limite, estado, fecha_asignacion"),
    sb.from("asesoras").select("id, nombre"),
    sb.from("relaciones_procedimientos").select("id, procedimiento_origen_id, condicion, procedimiento_propuesto, estado, created_at").eq("estado", "propuesto"),
  ]);

  for (const r of [apRes, procRes, asigRes, asesRes, relRes]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const aplicativos = (apRes.data ?? []) as FilaAplicativo[];
  const procedimientosRaw = (procRes.data ?? []) as FilaProcedimiento[];
  const asignaciones = (asigRes.data ?? []) as FilaAsignacion[];
  const asesoras = (asesRes.data ?? []) as FilaAsesora[];
  const relaciones = (relRes.data ?? []) as FilaRelacion[];

  const apMap = new Map(aplicativos.map((a) => [a.id, a.nombre ?? "—"]));
  const asesMap = new Map(asesoras.map((a) => [a.id, a.nombre ?? "—"]));
  const procTituloMap = new Map(procedimientosRaw.map((p) => [p.id, p.titulo ?? "—"]));

  // Asignación relevante por procedimiento: la más reciente que no esté cancelada.
  const asigPorProc = new Map<string, FilaAsignacion>();
  for (const a of asignaciones) {
    if (!a.procedimiento_id || a.estado === "cancelada") continue;
    const prev = asigPorProc.get(a.procedimiento_id);
    if (!prev || (a.fecha_asignacion ?? "") > (prev.fecha_asignacion ?? "")) {
      asigPorProc.set(a.procedimiento_id, a);
    }
  }

  // ── KPIs ──
  const asignados = asignaciones.filter((a) => a.estado !== "cancelada").length;
  const enElaboracion = procedimientosRaw.filter((p) => p.estado === "en_elaboracion").length;
  const porRevisar = procedimientosRaw.filter((p) => p.estado === "en_revision").length;
  const publicados = procedimientosRaw.filter((p) => p.estado === "aprobado").length;

  // ── Listado ──
  const procedimientos: ProcedimientoDoc[] = procedimientosRaw.map((p) => {
    const asig = asigPorProc.get(p.id);
    const estado = p.estado ?? "pendiente";
    const responsable = asig?.asesora_id ? asesMap.get(asig.asesora_id) ?? null : null;
    const version = p.version !== null && p.version !== undefined && String(p.version).trim() !== "" ? String(p.version) : "—";
    return {
      id: p.id,
      titulo: p.titulo ?? "—",
      descripcion: p.para_que_sirve ?? "",
      aplicativo: p.aplicativo_id ? apMap.get(p.aplicativo_id) ?? "—" : "—",
      responsable,
      estado,
      fechaLimite: estado === "aprobado" ? "" : fmtFecha(asig?.fecha_limite),
      urgency: urgencia(asig?.fecha_limite, estado),
      version,
    };
  });

  // ── Procedimientos propuestos ──
  const propuestos: PropuestoDoc[] = relaciones.map((r) => ({
    id: r.id,
    nombre: r.procedimiento_propuesto ?? "—",
    condicion: r.condicion ?? "",
    origen: r.procedimiento_origen_id ? procTituloMap.get(r.procedimiento_origen_id) ?? "—" : "—",
    fecha: fmtFecha(r.created_at),
  }));

  // ── Opciones de filtro (según lo que hay en el listado) ──
  const aplicativosFiltro = Array.from(new Set(procedimientos.map((p) => p.aplicativo).filter((x) => x && x !== "—"))).sort((a, b) => a.localeCompare(b));
  const estadosFiltro = Array.from(new Set(procedimientos.map((p) => p.estado)));

  return {
    kpi: { asignados, enElaboracion, porRevisar, publicados },
    procedimientos,
    propuestos,
    aplicativos: aplicativosFiltro,
    estados: estadosFiltro,
  };
}
