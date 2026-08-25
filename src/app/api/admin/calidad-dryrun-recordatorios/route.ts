import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { dryRunRecordatorios } from "@/lib/recordatorios-calidad";

// ============================================================
// Ruta temporal SOLO de lectura — DRY-RUN de los recordatorios de Calidad
// (relojes ACUSE y COMPROMISO, día hábil 1 y 2).
//
// No llama al mailer, no escribe en evento_ciclo, no toca Consolidado.
// Mismo patrón que /api/admin/fase1-dryrun-notificaciones.
//
// ?id=<ID_GESTION> opcional: limita el dry-run a un solo ciclo.
// ============================================================

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idGestion = request.nextUrl.searchParams.get("id") ?? undefined;

  try {
    const reporte = await dryRunRecordatorios(idGestion);
    console.log("[calidad-dryrun-recordatorios] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[calidad-dryrun-recordatorios] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en el dry-run de recordatorios" },
      { status: 500 }
    );
  }
}
