import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dryRunEscalamiento } from "@/lib/escalamiento-calidad";

// ============================================================
// Ruta temporal SOLO de lectura — DRY-RUN del escalamiento consolidado de
// Calidad (rutas SIN_ACUSE / SIN_COMPROMISO / COMPROMISO_VENCIDO).
//
// No llama al mailer, no escribe en evento_ciclo, no toca Consolidado.
// Mismo patrón que /api/admin/calidad-dryrun-recordatorios.
//
// ?id=<ID_GESTION> opcional: limita el dry-run a un solo ciclo (para
// probar el cálculo de un caso puntual sin ver el universo completo).
// ============================================================

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idGestion = request.nextUrl.searchParams.get("id") ?? undefined;

  try {
    const reporte = await dryRunEscalamiento(idGestion);
    console.log("[calidad-dryrun-escalamiento] reporte:", JSON.stringify(reporte));
    return NextResponse.json(reporte);
  } catch (e) {
    console.error("[calidad-dryrun-escalamiento] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en el dry-run de escalamiento" },
      { status: 500 }
    );
  }
}
