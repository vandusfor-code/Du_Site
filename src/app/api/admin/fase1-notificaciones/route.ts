import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { procesarNotificacionesPendientes } from "@/lib/notificacion-por-enviar";

// ============================================================
// Ruta temporal — ENVÍO REAL de notificación
// (CREADA + requiere_compromiso=true -> NOTIFICADA).
//
// Seguridad adicional para esta fase de prueba: ?id=<ID_GESTION> es
// OBLIGATORIO. Sin esto, un visitante accidental (o un doble clic) podría
// procesar TODOS los pendientes de una vez — con solo 1 candidato real hoy
// el riesgo es bajo, pero la ruta no debe depender de que siga siendo así.
// Cuando se diseñe el procesamiento por lote (con su propio mecanismo de
// concurrencia — ver notificacion-por-enviar.ts) se puede relajar esto.
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
    const resultado = await procesarNotificacionesPendientes(idGestion);
    console.log("[fase1-notificaciones] resultado:", JSON.stringify(resultado));
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[fase1-notificaciones] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido notificando" },
      { status: 500 }
    );
  }
}
