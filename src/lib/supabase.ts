import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Conexión SERVER-SIDE a Supabase (fuente adicional; no reemplaza
// Google Sheets). La SERVICE_ROLE_KEY nunca debe usarse en cliente:
// este módulo está marcado "server-only" para evitarlo.
// ============================================================

let cliente: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

// Comprobación mínima de conexión: obtiene el registro "Seven" de
// public.aplicativos (columna "nombre"). Lanza el error de Supabase si falla.
export async function verificarConexionSupabase(): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("aplicativos")
    .select("*")
    .eq("nombre", "Seven")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}
