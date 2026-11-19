import { NextRequest, NextResponse } from "next/server";
import { enviarEscalamientoResumen } from "@/lib/escalamiento-resumen";

// Envío de PRUEBA del correo de escalamiento consolidado (cómo le llega a Mónica).
// Protegido por token. ?token=&correo=&vencidas=1 (vencidas=1 solo las vencidas;
// por defecto incluye todas las no firmadas para ver un ejemplo con datos).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function tokenValido(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  return !!esperado && (req.nextUrl.searchParams.get("token") ?? "") === esperado;
}

async function run(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const correo = req.nextUrl.searchParams.get("correo") ?? "";
  if (!correo) return NextResponse.json({ error: "Falta el parámetro correo" }, { status: 400 });
  const soloVencidas = ["1", "true"].includes((req.nextUrl.searchParams.get("vencidas") ?? "").toLowerCase());
  try {
    const r = await enviarEscalamientoResumen({ soloVencidas, correoOverride: correo });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
