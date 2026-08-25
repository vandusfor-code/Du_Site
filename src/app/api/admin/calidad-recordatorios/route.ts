import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { procesarRecordatoriosPendientes } from "@/lib/recordatorios-calidad";

// ============================================================
// Ruta temporal — ENVÍO REAL de recordatorios de Calidad (relojes ACUSE y
// COMPROMISO, día hábil 1 y 2). Mismo patrón que /api/admin/fase1-notificaciones.
//
// Seguridad adicional para esta fase de prueba manual: ?id=<ID_GESTION> es
// OBLIGATORIO. Sin esto, un visitante accidental (o un doble clic) podría
// procesar TODOS los pendientes de golpe. Se relaja cuando se diseñe el
// procesamiento por lote con su propio mecanismo de concurrencia (etapa
// de Automatización/Cron — todavía no autorizada).
// ============================================================

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idGestion = request.nextUrl.searchParams.get("id");
  if (!idGestion) {
    return NextResponse.json(
      { error: "Falta el parámetro obligatorio ?id=<ID_GESTION>. Esta ruta no procesa todos los pendientes todavía." },
      { status: 400 }
    );
  }

  try {
    const resultado = await procesarRecordatoriosPendientes(idGestion);
    console.log("[calidad-recordatorios] resultado:", JSON.stringify(resultado));
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[calidad-recordatorios] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido enviando recordatorios" },
      { status: 500 }
    );
  }
}
