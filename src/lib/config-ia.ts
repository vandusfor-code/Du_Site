import "server-only";
import { getSupabase } from "./supabase";

// ============================================================
// Configuración del auditor con IA (clave-valor en Supabase: app_config).
//  - openai_api_key : clave de la API de OpenAI (secreta; NUNCA al cliente).
//  - openai_modelo  : modelo de chat de OpenAI (p. ej. gpt-4o-mini).
//  - auditor_motor  : "openai" | "claude" — qué motor usa el auditor.
// Se lee solo server-side con la SERVICE_ROLE. Caché corta para no golpear
// Supabase en cada transcripción de una corrida.
// ============================================================

const TABLA = "app_config";
export const MODELOS_OPENAI = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] as const;
export type MotorAuditor = "openai" | "claude";

export interface ConfigIA {
  openaiKey: string;
  modelo: string;
  motor: MotorAuditor;
}

let cache: ConfigIA | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

const CONFIG_DEFECTO: ConfigIA = { openaiKey: "", modelo: "gpt-4o-mini", motor: "claude" };

export async function obtenerConfigIA(forzar = false): Promise<ConfigIA> {
  if (!forzar && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const sb = getSupabase();
  const { data, error } = await sb.from(TABLA).select("clave, valor");
  if (error) {
    // Si la tabla aún no existe (o falla la lectura), NO rompemos el auditor:
    // se cae a los valores por defecto (motor Claude, sin key de OpenAI).
    console.error("config-ia: no se pudo leer app_config, uso valores por defecto:", error.message);
    cache = { ...CONFIG_DEFECTO };
    cacheAt = Date.now();
    return cache;
  }
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { clave: string; valor: string | null }[]) {
    map.set(r.clave, (r.valor ?? "").trim());
  }
  const openaiKey = map.get("openai_api_key") ?? "";
  const modelo = map.get("openai_modelo") || "gpt-4o-mini";
  const motorRaw = map.get("auditor_motor");
  const motor: MotorAuditor = motorRaw === "openai" || motorRaw === "claude"
    ? motorRaw
    : (openaiKey ? "openai" : "claude");
  cache = { openaiKey, modelo, motor };
  cacheAt = Date.now();
  return cache;
}

export async function guardarConfigIA(
  patch: Partial<{ openaiKey: string; modelo: string; motor: MotorAuditor }>
): Promise<void> {
  const sb = getSupabase();
  const filas: { clave: string; valor: string; actualizado_en: string }[] = [];
  const ahora = new Date().toISOString();
  if (patch.openaiKey !== undefined) filas.push({ clave: "openai_api_key", valor: patch.openaiKey.trim(), actualizado_en: ahora });
  if (patch.modelo !== undefined) filas.push({ clave: "openai_modelo", valor: patch.modelo.trim(), actualizado_en: ahora });
  if (patch.motor !== undefined) filas.push({ clave: "auditor_motor", valor: patch.motor, actualizado_en: ahora });
  if (filas.length === 0) return;
  const { error } = await sb.from(TABLA).upsert(filas, { onConflict: "clave" });
  if (error) throw new Error(`Supabase (guardar app_config): ${error.message}`);
  cache = null; // invalida la caché
}

// Prueba la validez de una key de OpenAI (y opcionalmente el modelo) con una
// llamada mínima. Devuelve ok o el mensaje de error de OpenAI.
export async function probarOpenAIKey(key: string, modelo: string): Promise<{ ok: boolean; mensaje: string }> {
  const k = (key ?? "").trim();
  if (!k) return { ok: false, mensaje: "No hay API key configurada." };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({ model: modelo || "gpt-4o-mini", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, mensaje: `Conexión correcta con ${modelo || "gpt-4o-mini"}.` };
    return { ok: false, mensaje: json?.error?.message || `OpenAI respondió HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo conectar con OpenAI." };
  }
}

// Máscara segura de la key para mostrar en la UI (nunca el valor completo).
export function enmascararKey(key: string): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  if (k.length <= 10) return "••••";
  return `${k.slice(0, 5)}••••${k.slice(-4)}`;
}
