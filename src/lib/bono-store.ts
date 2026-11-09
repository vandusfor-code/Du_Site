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
const TABLA_AUDITORIA = "bono_auditoria";

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

// Borra TODAS las métricas manuales de un asesor (cualquier mes). Útil para
// limpiar datos de prueba o reiniciar a una asesora.
export async function borrarMetricasAsesor(asesor: string): Promise<void> {
  if (!asesor) return;
  const sb = getSupabase();
  const { error } = await sb.from(TABLA_MANUAL).delete().eq("asesor", asesor);
  if (error) throw new Error(`No se pudo borrar: ${error.message}`);
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

/* ── Auditorías → PEC/PENC ── */

// Registra (upsert por id_gestion) una auditoría para el cálculo de PEC/PENC.
// Best-effort: si falla, NO rompe el guardado de la auditoría en la hoja.
export async function registrarAuditoriaBono(
  idGestion: string,
  mes: string,
  asesor: string,
  nota: number,
  resultado: string
): Promise<void> {
  if (!idGestion || !mes || !asesor) return;
  try {
    const sb = getSupabase();
    await sb.from(TABLA_AUDITORIA).upsert(
      { id_gestion: idGestion, mes, asesor: asesor.toUpperCase(), nota, resultado: resultado.toUpperCase() },
      { onConflict: "id_gestion" }
    );
  } catch {
    // silencioso: el PEC/PENC del bono no debe bloquear la auditoría
  }
}

export interface PecPenc { pec: number; penc: number; auditorias: number }

// PEC = % de auditorías conformes (OK); PENC = promedio de la nota. Por asesor
// (código en MAYÚSCULAS), para un mes 'YYYY-MM'.
export async function obtenerPecPencMes(mes: string): Promise<Map<string, PecPenc>> {
  const out = new Map<string, PecPenc>();
  if (!mes) return out;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(TABLA_AUDITORIA)
      .select("asesor,nota,resultado")
      .eq("mes", mes);
    if (error) throw error;
    const acc = new Map<string, { n: number; ok: number; suma: number }>();
    for (const r of data ?? []) {
      const code = String(r.asesor ?? "").trim().toUpperCase();
      if (!code) continue;
      const a = acc.get(code) ?? { n: 0, ok: 0, suma: 0 };
      a.n += 1;
      if (String(r.resultado ?? "").trim().toUpperCase() === "OK") a.ok += 1;
      a.suma += Number(r.nota ?? 0);
      acc.set(code, a);
    }
    for (const [code, a] of acc) {
      out.set(code, {
        pec: a.n > 0 ? Math.round((a.ok / a.n) * 1000) / 10 : 0,
        penc: a.n > 0 ? Math.round((a.suma / a.n) * 10) / 10 : 0,
        auditorias: a.n,
      });
    }
  } catch {
    // sin datos → vacío
  }
  return out;
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

// Filas del histórico de un asesor (por código), de todos los meses cerrados,
// del más reciente al más antiguo. Para la vista "Mi bono" de la asesora.
export async function obtenerBonoHistoricoAsesor(asesor: string): Promise<FilaHistoricoBono[]> {
  const code = (asesor ?? "").trim();
  if (!code) return [];
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from(TABLA_HISTORICO)
      .select("mes,asesor,nombre,area,datos")
      .ilike("asesor", code) // coincidencia exacta, sin distinguir mayúsculas
      .order("mes", { ascending: false });
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
