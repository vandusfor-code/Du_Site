import "server-only";
import { getSupabase } from "@/lib/supabase";
import { CONFIG_REGLAS, type ConfigReglas, type ResultadoValidacion } from "./pila-tipos";

// ============================================================
// Gestión de empleo — Validador PILA. El validador NO guarda validaciones ni
// PDFs (se procesa al momento y se descarta). Lo único que persiste aquí es la
// CONFIGURACIÓN de umbrales (parámetros operativos, sin datos personales).
// ============================================================

const T_CFG = "empleo_config";

// Texto de observación automática a partir del resultado (para mostrar y para
// el PDF). No se almacena.
export function observacionAutomatica(r: ResultadoValidacion): string {
  const partes: string[] = [r.motivo];
  if (r.analisis.registrosAporteCero > 0) partes.push(`Se excluyeron ${r.analisis.registrosAporteCero} registro(s) con aporte en cero.`);
  if (r.analisis.registrosFueraVentana > 0) partes.push(`${r.analisis.registrosFueraVentana} registro(s) quedaron fuera de la ventana de 3 años.`);
  const adv = r.inconsistencias.filter((i) => i.nivel !== "info");
  if (adv.length > 0) partes.push(`Inconsistencias detectadas: ${adv.length}.`);
  return partes.join(" ");
}

export async function obtenerConfigReglas(): Promise<ConfigReglas> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from(T_CFG).select("valor").eq("clave", "reglas").maybeSingle();
    if (data?.valor && typeof data.valor === "object") {
      return { ...CONFIG_REGLAS, ...(data.valor as Partial<ConfigReglas>) };
    }
  } catch { /* usa el default */ }
  return CONFIG_REGLAS;
}

export async function guardarConfigReglas(cfg: ConfigReglas): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_CFG).upsert({ clave: "reglas", valor: cfg, actualizado_en: new Date().toISOString() }, { onConflict: "clave" });
  if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
}
