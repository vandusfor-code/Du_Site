import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { verificarNotificacion } from "@/lib/notificacion-por-enviar";

// ============================================================
// Ruta temporal SOLO de lectura — confirma el estado real de un ciclo y el
// contenido exacto de sus eventos de notificación, después de un envío.
// No escribe nada.
// ============================================================

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const idGestion = request.nextUrl.searchParams.get("id");
  if (!idGestion) {
    return NextResponse.json({ error: "Falta el parámetro ?id=<ID_GESTION>" }, { status: 400 });
  }

  try {
    const verificacion = await verificarNotificacion(idGestion);
    return NextResponse.json(verificacion);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido verificando" },
      { status: 500 }
    );
  }
}
