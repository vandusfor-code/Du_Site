import "server-only";
import { getSupabase } from "@/lib/supabase";

// ============================================================
// Resuelve la identidad de la asesora autenticada (NextAuth) contra
// public.asesoras, para autorizar server-side el acceso a sus propios
// procedimientos. NUNCA se acepta un asesora_id enviado por el cliente.
// ============================================================

interface FilaAsesoraUsuario {
  id: string;
  usuario: string | null;
}

// Comparación trim + case-insensitive. Si hay 0 o más de 1 coincidencia,
// se trata como identidad no resuelta (el llamador debe denegar acceso).
export async function resolverAsesoraId(usuarioSesion: string | null | undefined): Promise<string | null> {
  const objetivo = (usuarioSesion ?? "").trim().toLowerCase();
  if (!objetivo) return null;

  const sb = getSupabase();
  const { data, error } = await sb.from("asesoras").select("id, usuario");
  if (error) throw new Error(`Supabase: ${error.message}`);

  const coincidencias = ((data ?? []) as FilaAsesoraUsuario[]).filter(
    (a) => (a.usuario ?? "").trim().toLowerCase() === objetivo
  );

  if (coincidencias.length !== 1) return null;
  return coincidencias[0].id;
}
