import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { verificarEstadoPostMigracion } from "@/lib/verificacion-migracion-calidad";

// ============================================================
// Ruta temporal SOLO de lectura — confirma, DESPUÉS de ejecutar
// 0003_fase1_modulo_calidad.sql, que los 1090 ciclos existentes quedaron
// intactos y que las tablas nuevas están en el estado esperado.
//
// No escribe nada en Supabase ni en Consolidado.
// ============================================================

export async function GET() {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const reporte = await verificarEstadoPostMigracion();
    console.log("[fase-calidad-verificar-post-migracion] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[fase-calidad-verificar-post-migracion] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido verificando post-migración" },
      { status: 500 }
    );
  }
}
