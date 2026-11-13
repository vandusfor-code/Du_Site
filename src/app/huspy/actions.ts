"use server";

import { getSupabase } from "@/lib/supabase";

// Guarda el resultado de una asesora al terminar la jornada. Ruta pública (sin
// login): la escritura va server-side con la SERVICE_ROLE. Devuelve el error
// como dato (no lo lanza) para que la UI muestre el motivo real.
export async function guardarResultadoHuspy(input: {
  nombre: string;
  nota: number;
  detalle: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const nombre = (input.nombre || "").trim();
    if (!nombre) return { ok: false, error: "Falta el nombre." };
    const nota = Math.max(0, Math.min(100, Math.round(input.nota || 0)));

    const supabase = getSupabase();
    const { error } = await supabase.from("huspy_resultados").insert({
      nombre,
      nota,
      detalle: input.detalle ?? {},
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el resultado." };
  }
}

// Lista de resultados para la pantalla interna (/huspy/resultados).
export async function listarResultadosHuspy(): Promise<
  { ok: true; filas: { nombre: string; nota: number; creado_en: string }[] } | { ok: false; error: string }
> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("huspy_resultados")
      .select("nombre, nota, creado_en")
      .order("creado_en", { ascending: false })
      .limit(200);
    if (error) return { ok: false, error: error.message };
    return { ok: true, filas: (data ?? []) as { nombre: string; nota: number; creado_en: string }[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron cargar los resultados." };
  }
}
