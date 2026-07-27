import "server-only";
import { getSupabase } from "@/lib/supabase";

// ============================================================
// Configuración editable del banner "Enfoque del día" del Home.
// Se persiste dentro del bucket privado YA EXISTENTE (documentacion-operativa)
// bajo el prefijo home/: un JSON con el texto y la imagen como archivo.
// No se crea tabla ni bucket nuevo, ni se cambia RLS (acceso server-side).
// ============================================================

const BUCKET = "documentacion-operativa";
const JSON_PATH = "home/banner.json";
const IMG_PREFIX = "home/banner";
const EXTS = ["png", "webp", "jpg"] as const;
const URL_TTL = 3600; // 1 h

const DEFAULT_TITULO = "Concentra tu energía en lo importante";

interface BannerConfig {
  titulo: string;
  imagenPath: string | null;
}

export interface BannerHome {
  titulo: string;
  imagenUrl: string | null; // URL firmada temporal (o null → imagen por defecto)
}

async function leerConfig(): Promise<BannerConfig> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(BUCKET).download(JSON_PATH);
  if (error || !data) return { titulo: DEFAULT_TITULO, imagenPath: null };
  try {
    const j = JSON.parse(await data.text());
    return {
      titulo: typeof j.titulo === "string" && j.titulo.trim() ? j.titulo : DEFAULT_TITULO,
      imagenPath: typeof j.imagenPath === "string" && j.imagenPath ? j.imagenPath : null,
    };
  } catch {
    return { titulo: DEFAULT_TITULO, imagenPath: null };
  }
}

async function guardarConfig(cfg: BannerConfig): Promise<void> {
  const sb = getSupabase();
  const buffer = Buffer.from(JSON.stringify(cfg), "utf8");
  const { error } = await sb.storage.from(BUCKET).upload(JSON_PATH, buffer, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw new Error(error.message);
}

// Lectura para el Home (todos los roles). Devuelve texto + URL firmada de imagen.
export async function obtenerBannerHome(): Promise<BannerHome> {
  const sb = getSupabase();
  const cfg = await leerConfig();
  let imagenUrl: string | null = null;
  if (cfg.imagenPath) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(cfg.imagenPath, URL_TTL);
    if (!error) imagenUrl = data?.signedUrl ?? null;
  }
  return { titulo: cfg.titulo, imagenUrl };
}

// Guardar solo el texto (Admin).
export async function guardarBannerTexto(titulo: string): Promise<void> {
  const t = titulo.trim();
  if (!t) throw new Error("El texto no puede quedar vacío.");
  if (t.length > 160) throw new Error("El texto es demasiado largo (máx. 160 caracteres).");
  const cfg = await leerConfig();
  cfg.titulo = t;
  await guardarConfig(cfg);
}

// Subir/reemplazar imagen (Admin). Devuelve la URL firmada para reflejarla al instante.
export async function subirBannerImagen(file: File): Promise<string | null> {
  const tipos = ["image/png", "image/jpeg", "image/webp"];
  if (!tipos.includes(file.type)) throw new Error("Formato no permitido. Usa PNG, JPG o WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera el tamaño máximo de 5 MB.");

  const sb = getSupabase();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${IMG_PREFIX}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);

  // Elimina versiones con otra extensión para no dejar imágenes obsoletas.
  const sobrantes = EXTS.filter((e) => e !== ext).map((e) => `${IMG_PREFIX}.${e}`);
  await sb.storage.from(BUCKET).remove(sobrantes);

  const cfg = await leerConfig();
  cfg.imagenPath = path;
  await guardarConfig(cfg);

  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, URL_TTL);
  return data?.signedUrl ?? null;
}
