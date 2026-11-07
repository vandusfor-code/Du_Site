// Comunicación con Supabase (solo fetch, sin librerías).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const H = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY };

export async function rpc(fn, args = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  let d = null;
  try { d = txt ? JSON.parse(txt) : null; } catch { d = txt; }
  if (!r.ok) {
    const e = new Error((d && d.message) || "Error de conexión");
    e.code = (d && d.message) || "";
    e.status = r.status;
    throw e;
  }
  return d;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// Sube un archivo/blob al bucket público "boda" y devuelve su URL pública.
export async function subirArchivo(blob, carpeta, ext) {
  const ruta = `${carpeta}/${uid()}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/boda/${ruta}`, {
    method: "POST",
    headers: { ...H, "Content-Type": blob.type || "application/octet-stream", "x-upsert": "false" },
    body: blob
  });
  if (!r.ok) {
    let m = "";
    try { m = (await r.json()).message || ""; } catch {}
    throw new Error(m || "No se pudo subir el archivo");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/boda/${ruta}`;
}

// Reduce la foto antes de subirla (más rápido y ligero para los invitados).
export function comprimirImagen(file, max = 1600, calidad = 0.82) {
  return new Promise((ok, fail) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? ok(b) : fail(new Error("No se pudo procesar la foto"))), "image/jpeg", calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("Ese archivo no parece una foto")); };
    img.src = url;
  });
}
