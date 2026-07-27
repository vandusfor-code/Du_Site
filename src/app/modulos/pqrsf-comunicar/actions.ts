"use server";

import { auth } from "@/auth";
import { importarPqrsfComunicar, type ResultadoImportacion } from "@/lib/pqrsf-comunicar";

async function requirePqrsfComunicar(): Promise<void> {
  const session = await auth();
  if (!session?.user?.modulos.includes("pqrsf-comunicar")) {
    throw new Error("No autorizado");
  }
}

export async function importarPqrsfComunicarAction(formData: FormData): Promise<ResultadoImportacion> {
  try {
    await requirePqrsfComunicar();
    const archivo = formData.get("archivo");
    if (!(archivo instanceof File)) return { ok: false, error: "No se recibió ningún archivo." };
    const nombre = archivo.name.toLowerCase();
    if (!nombre.endsWith(".xls") && !nombre.endsWith(".xlsx")) {
      return { ok: false, error: "Formato no compatible. Sube un archivo .xls o .xlsx." };
    }
    const buffer = Buffer.from(await archivo.arrayBuffer());
    return await importarPqrsfComunicar(buffer);
  } catch (e) {
    console.error("[pqrsf-comunicar] importarAction:", e instanceof Error ? e.message : e);
    return { ok: false, error: "No fue posible completar la importación." };
  }
}
