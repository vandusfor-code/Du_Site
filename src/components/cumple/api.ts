// Comunicación con Supabase desde el navegador (clave pública "anon": los datos se protegen con funciones).
export const SUPABASE_URL = "https://fkphdbgetxoscvehmbhy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrcGhkYmdldHhvc2N2ZWhtYmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTgzNTMsImV4cCI6MjEwOTM3NDM1M30.SSja6p0EUhIBb81yNCFhUzYYsaQ_reFbKpvFpC_gyFI";

const H = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY };

export class ApiError extends Error {
  code: string;
  constructor(code: string, msg?: string) {
    super(msg || code || "Error de conexión");
    this.code = code;
  }
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const txt = await r.text();
  let d: unknown = null;
  try {
    d = txt ? JSON.parse(txt) : null;
  } catch {
    d = txt;
  }
  if (!r.ok) {
    const m = (d && typeof d === "object" && "message" in d ? String((d as { message: unknown }).message) : "") || "";
    throw new ApiError(m, m);
  }
  return d as T;
}

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// Sube un archivo al bucket público "boda" y devuelve su URL pública.
export async function subirArchivo(blob: Blob, carpeta: string, ext: string): Promise<string> {
  const ruta = `${carpeta}/${uid()}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/boda/${ruta}`, {
    method: "POST",
    headers: { ...H, "Content-Type": blob.type || "application/octet-stream", "x-upsert": "false" },
    body: blob,
  });
  if (!r.ok) {
    let m = "";
    try {
      m = (await r.json()).message || "";
    } catch {}
    throw new Error(m || "No se pudo subir el archivo");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/boda/${ruta}`;
}

// Reduce la foto antes de subirla (más rápido y ligero para los invitados).
export function comprimirImagen(file: File, max = 1600, calidad = 0.86): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen"))), "image/jpeg", calidad);
    };
    img.onerror = () => rej(new Error("Imagen no válida"));
    img.src = url;
  });
}

// Avisa al celular del anfitrión (si activó las notificaciones). Nunca bloquea ni lanza errores.
export function notificarRespuesta(codigo: string) {
  try {
    fetch("/api/boda-notificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }), keepalive: true }).catch(() => {});
  } catch {}
}
