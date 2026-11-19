import "server-only";
import { getSupabase } from "@/lib/supabase";
import { sumarDiasHabiles } from "@/lib/dias-habiles-colombia";

// ============================================================
// Seguimiento CONSOLIDADO por asesora/día (tabla resumen_diario). Una fila por
// asesora por día: # auditorías, calidad promedio, estado (notificada / firmada),
// compromiso y días sin firmar. Los ciclos por auditoría siguen existiendo por
// debajo (acuse masivo + escalamiento), pero aquí NO se muestran una a una.
// ============================================================

// "Vencida" = mismo criterio que el ESCALAMIENTO a Mónica: 2 días HÁBILES sin
// acuse desde la notificación (ver escalamiento-calidad/gestion-calidad).
const DIAS_HABILES_PARA_VENCER = 2;

export type EstadoSeguimiento = "PENDIENTE_NOTIF" | "NOTIFICADA" | "FIRMADA";

export interface FilaSeguimiento {
  id: string;
  fecha: string;
  nombre: string;
  asesorCodigo: string;
  numAuditorias: number;
  promedio: number;
  estado: EstadoSeguimiento;
  compromiso: string;
  enviadoEn: string | null;
  firmadoEn: string | null;
  diasSinFirmar: number | null;
  vencida: boolean;
}

export interface KpisSeguimiento {
  total: number;
  notificadas: number;
  pendientesFirma: number;
  firmadas: number;
  vencidas: number;
}

export interface FiltrosSeguimiento {
  fecha?: string;        // YYYY-MM-DD exacto
  asesora?: string;      // texto en nombre o código
  estado?: EstadoSeguimiento | "";
  soloVencidas?: boolean;
}

function diasEntre(desdeIso: string, hastaIso: string | null): number {
  const d = new Date(desdeIso).getTime();
  const h = hastaIso ? new Date(hastaIso).getTime() : Date.now();
  return Math.max(0, Math.floor((h - d) / 86_400_000));
}

function mapFila(r: Record<string, unknown>): FilaSeguimiento {
  const enviadoEn = r.enviado_en ? String(r.enviado_en) : null;
  const firmadoEn = r.firmado_en ? String(r.firmado_en) : null;
  const estado: EstadoSeguimiento = firmadoEn ? "FIRMADA" : enviadoEn ? "NOTIFICADA" : "PENDIENTE_NOTIF";
  const diasSinFirmar = enviadoEn && !firmadoEn ? diasEntre(enviadoEn, null) : null;
  const vencida = estado === "NOTIFICADA" && !!enviadoEn
    && Date.now() > sumarDiasHabiles(new Date(enviadoEn), DIAS_HABILES_PARA_VENCER).getTime();
  return {
    id: String(r.id),
    fecha: String(r.fecha),
    nombre: String(r.nombre ?? ""),
    asesorCodigo: String(r.asesor_codigo ?? ""),
    numAuditorias: Number(r.num_auditorias ?? 0),
    promedio: Number(r.promedio_nota ?? 0),
    estado,
    compromiso: String(r.compromiso ?? ""),
    enviadoEn, firmadoEn,
    diasSinFirmar,
    vencida,
  };
}

export async function obtenerSeguimientoResumen(
  filtros: FiltrosSeguimiento = {}
): Promise<{ kpis: KpisSeguimiento; filas: FilaSeguimiento[] }> {
  const supabase = getSupabase();
  let q = supabase.from("resumen_diario").select("*").order("fecha", { ascending: false }).limit(1000);
  if (filtros.fecha) q = q.eq("fecha", filtros.fecha);
  const { data, error } = await q;
  if (error) throw new Error(`Supabase (resumen_diario): ${error.message}`);

  let filas = (data ?? []).map((r) => mapFila(r as Record<string, unknown>));

  // Filtros en memoria (texto/estado).
  const f = (filtros.asesora ?? "").trim().toLowerCase();
  if (f) filas = filas.filter((x) => x.nombre.toLowerCase().includes(f) || x.asesorCodigo.toLowerCase().includes(f));
  if (filtros.estado) filas = filas.filter((x) => x.estado === filtros.estado);
  if (filtros.soloVencidas) filas = filas.filter((x) => x.vencida);

  // KPIs sobre TODAS las filas del rango (no sobre el filtro de texto/estado).
  const base = (data ?? []).map((r) => mapFila(r as Record<string, unknown>));
  const kpis: KpisSeguimiento = {
    total: base.length,
    notificadas: base.filter((x) => x.estado === "NOTIFICADA" || x.estado === "FIRMADA").length,
    pendientesFirma: base.filter((x) => x.estado === "NOTIFICADA").length,
    firmadas: base.filter((x) => x.estado === "FIRMADA").length,
    vencidas: base.filter((x) => x.vencida).length,
  };

  return { kpis, filas };
}
