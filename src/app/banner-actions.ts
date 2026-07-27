"use server";

import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { guardarBannerTexto, subirBannerImagen } from "@/lib/home-config";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user || !esAdmin(session)) throw new Error("No autorizado");
}

export async function guardarBannerTextoAction(titulo: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await guardarBannerTexto(titulo);
    return { ok: true };
  } catch (e) {
    console.error("[home-banner] guardarBannerTextoAction:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar el texto." };
  }
}

export async function subirBannerImagenAction(formData: FormData): Promise<{ ok: boolean; url?: string | null; error?: string }> {
  try {
    await requireAdmin();
    const archivo = formData.get("archivo");
    if (!(archivo instanceof File)) throw new Error("No se recibió ninguna imagen.");
    const url = await subirBannerImagen(archivo);
    return { ok: true, url };
  } catch (e) {
    console.error("[home-banner] subirBannerImagenAction:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
}
