import "server-only";
import { getSupabase } from "@/lib/supabase";

// ============================================================
// Almacenamiento NATIVO de los bonos (Supabase). Guarda las métricas manuales
// capturadas en la plataforma, la configuración (mes activo) y el histórico de
// cierres. Reemplaza la captura en el Excel; no toca la hoja del usuario.
// ============================================================

const TABLA_MANUAL = "bono_metrica_manual";
const TABLA_CONFIG = "bono_config";
const TABLA_HISTORICO = "bono_historico";

/* ── Métricas manuales ── */

// Devuelve las métricas manuales de un mes como mapa "asesor||campo" → valor.
export async function obtenerMetricasManual(mes: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!mes) return out;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(TABLA_MANUAL)
      .select("asesor,campo,valor")
      .eq("mes", mes);
    if (error) throw error;
    for (const r of data ?? []) {
      out.set(`${String(r.asesor)}||${String(r.campo)}`, String(r.valor ?? ""));
    }
  } catch {
    // sin datos → mapa vacío (el bono se calcula con lo que haya)
  }
  return out;
}

// Guarda (upsert) una métrica manual de un asesor para un mes.
export async function guardarMetricaManual(
  mes: string,
  asesor: string,
  campo: string,
  valor: string
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from(TABLA_MANUAL)
    .upsert({ mes, asesor, campo, valor, actualizado_en: new Date().toISOString() }, { onConflict: "mes,asesor,campo" });
  if (error) throw new Error(`No se pudo guardar la métrica: ${error.message}`);
}

// Borra las métricas manuales de un mes (reinicio al cerrar).
export async function limpiarMetricasManual(mes: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(TABLA_MANUAL).delete().eq("mes", mes);
  if (error) throw new Error(`No se pudo limpiar: ${error.message}`);
}

/* ── Configuración (mes activo nativo) ── */

export async function obtenerConfig(clave: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLA_CONFIG).select("valor").eq("clave", clave).maybeSingle();
    if (error) throw error;
    return data ? String(data.valor ?? "") : null;
  } catch {
    return null;
  }
}

export async function guardarConfig(clave: string, valor: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(TABLA_CONFIG).upsert({ clave, valor }, { onConflict: "clave" });
  if (error) throw new Error(`No se pudo guardar config: ${error.message}`);
}

/* ── Histórico de cierres ── */

export interface FilaHistoricoBono {
  mes: string;
  asesor: string;
  nombre: string;
  area: string;
  datos: Record<string, string>;
}

export async function archivarHistorico(filas: FilaHistoricoBono[]): Promise<number> {
  if (filas.length === 0) return 0;
  const sb = getSupabase();
  const payload = filas.map((f) => ({
    mes: f.mes, asesor: f.asesor, nombre: f.nombre, area: f.area,
    datos: f.datos, cerrado_en: new Date().toISOString(),
  }));
  const { error } = await sb.from(TABLA_HISTORICO).upsert(payload, { onConflict: "mes,asesor" });
  if (error) throw new Error(`No se pudo archivar: ${error.message}`);
  return filas.length;
}

export async function obtenerHistorico(mes: string): Promise<FilaHistoricoBono[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(TABLA_HISTORICO)
      .select("mes,asesor,nombre,area,datos")
      .eq("mes", mes);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      mes: String(r.mes), asesor: String(r.asesor), nombre: String(r.nombre ?? ""),
      area: String(r.area ?? ""), datos: (r.datos ?? {}) as Record<string, string>,
    }));
  } catch {
    return [];
  }
}

export async function obtenerMesesHistorico(): Promise<string[]> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLA_HISTORICO).select("mes");
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r) => String(r.mes)))).sort();
  } catch {
    return [];
  }
}
