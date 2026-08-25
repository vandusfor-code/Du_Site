import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { dryRunPorEnviar } from "@/lib/dry-run-por-enviar";

// ============================================================
// Ruta temporal SOLO de lectura — DRY-RUN de la Corrida 2 ("Por enviar").
//
// No escribe absolutamente nada: no toca ciclo_auditoria, no toca
// evento_ciclo, no toca Consolidado. Solo lee y reporta qué pasaría si se
// ejecutara la Corrida 2 real. Separada a propósito de
// /api/admin/fase1-adopcion para no mezclar las dos pruebas.
//
// Misma autorización que el resto de rutas temporales de Fase 1.
// ============================================================

export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const reporte = await dryRunPorEnviar();
    console.log("[fase1-dryrun-porenviar] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[fase1-dryrun-porenviar] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en el dry-run" },
      { status: 500 }
    );
  }
}
