import { NextResponse } from "next/server";
import { readRange } from "@/lib/sheets";

// TEMPORAL: endpoint de diagnóstico para verificar en el preview que el nuevo
// cliente de Sheets (fetch + google-auth-library) autentica y lee bien con las
// credenciales reales. NO devuelve datos de celdas, solo tiempos y nº de columnas.
// Se elimina antes de mezclar a main.
export const dynamic = "force-dynamic";

export async function GET() {
  const id = process.env.SHEET_ID_USUARIOS;
  if (!id) return NextResponse.json({ ok: false, error: "Falta SHEET_ID_USUARIOS" }, { status: 500 });

  const t0 = Date.now();
  try {
    const encabezado = await readRange(id, "Usuarios!A1:F1"); // solo la fila de encabezados
    const t1 = Date.now();
    await readRange(id, "Usuarios!A1:A1"); // 2ª lectura: token ya cacheado
    const t2 = Date.now();
    return NextResponse.json({
      ok: true,
      firstReadMs: t1 - t0, // incluye emisión del token
      secondReadMs: t2 - t1, // token reutilizado (debe ser mucho menor)
      cols: encabezado[0]?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
