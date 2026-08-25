import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { ejecutarCorrida2PorEnviar, verificarCorrida2PorEnviar } from "@/lib/corrida2-por-enviar";

// ============================================================
// Ruta temporal — CORRIDA 2 REAL ("Por enviar" → requiere_compromiso).
//
// Autorizada explícitamente para: leer Consolidado, cruzar con
// ciclo_auditoria, y si "Por enviar"="OK" y requiere_compromiso sigue en
// false, marcarlo en true + crear un evento compromiso_solicitado_por_calidad.
//
// NO envía correos, NO notifica, NO cambia Consolidado, NO cambia estado
// ni identidad, NO agenda nada. Ver src/lib/corrida2-por-enviar.ts para el
// detalle de cada regla.
// ============================================================

export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await ejecutarCorrida2PorEnviar();
    const verificacion = await verificarCorrida2PorEnviar(resultado.casos.map((c) => c.idGestion));
    console.log("[fase1-corrida2-porenviar] resultado:", JSON.stringify(resultado));
    console.log("[fase1-corrida2-porenviar] verificacion:", JSON.stringify(verificacion));
    return NextResponse.json({ resultado, verificacion });
  } catch (e) {
    console.error("[fase1-corrida2-porenviar] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en la Corrida 2" },
      { status: 500 }
    );
  }
}
