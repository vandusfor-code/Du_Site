import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { procesarEscalamiento } from "@/lib/escalamiento-calidad";

// ============================================================
// Ruta temporal — ENVÍO REAL del escalamiento consolidado de Calidad.
//
// A diferencia de /api/admin/fase1-notificaciones o
// /api/admin/calidad-recordatorios (que operan sobre UN ciclo puntual vía
// ?id= obligatorio), el escalamiento por diseño agrupa TODOS los ciclos
// vencidos en un solo correo — exigir ?id= aquí rompería el propósito
// mismo de la función. El mecanismo de seguridad equivalente es
// ?confirmar=true, obligatorio: sin él, la ruta no envía nada. Así un
// visitante accidental o un doble clic sin querer no dispara el correo
// real a Coordinación.
//
// ?id=<ID_GESTION> opcional además de ?confirmar=true: limita el envío a
// un solo ciclo, útil para probar el mecanismo completo (correo + evento)
// sin escalar todo el universo real de una vez.
// ============================================================

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const confirmar = request.nextUrl.searchParams.get("confirmar");
  if (confirmar !== "true") {
    return NextResponse.json(
      {
        error:
          "Falta el parámetro obligatorio ?confirmar=true. Esta ruta envía un correo real a Coordinación — no se ejecuta sin confirmación explícita.",
      },
      { status: 400 }
    );
  }

  const idGestion = request.nextUrl.searchParams.get("id") ?? undefined;

  try {
    const resultado = await procesarEscalamiento(idGestion);
    console.log("[calidad-escalamiento] resultado:", JSON.stringify(resultado));
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[calidad-escalamiento] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en el escalamiento" },
      { status: 500 }
    );
  }
}
