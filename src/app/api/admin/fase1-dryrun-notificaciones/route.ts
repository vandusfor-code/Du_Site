import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dryRunNotificaciones } from "@/lib/notificacion-por-enviar";

// ============================================================
// Ruta temporal SOLO de lectura — DRY-RUN de la notificación
// (CREADA + requiere_compromiso=true -> NOTIFICADA).
//
// No llama al mailer, no escribe en ciclo_auditoria, no escribe en
// evento_ciclo, no toca Consolidado.
//
// ?id=<ID_GESTION> opcional: limita el dry-run a un solo ciclo.
// ============================================================

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idGestion = request.nextUrl.searchParams.get("id") ?? undefined;

  try {
    const reporte = await dryRunNotificaciones(idGestion);
    console.log("[fase1-dryrun-notificaciones] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[fase1-dryrun-notificaciones] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en el dry-run de notificaciones" },
      { status: 500 }
    );
  }
}
