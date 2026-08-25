import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { verificarCompatibilidadMigracion } from "@/lib/verificacion-migracion-calidad";

// ============================================================
// Ruta temporal SOLO de lectura — confirma, con datos reales de
// producción, que la migración 0003_fase1_modulo_calidad.sql no va a
// romperse contra ningún dato existente antes de ejecutarla.
//
// No escribe nada en Supabase ni en Consolidado.
// ============================================================

export async function GET() {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const reporte = await verificarCompatibilidadMigracion();
    console.log("[fase-calidad-verificar-migracion] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[fase-calidad-verificar-migracion] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido verificando compatibilidad" },
      { status: 500 }
    );
  }
}
