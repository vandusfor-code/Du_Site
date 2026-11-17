import { NextRequest, NextResponse } from "next/server";
import { enviarResumenPrueba } from "@/lib/resumen-diario";

// Envío de PRUEBA del resumen diario de una asesora a un correo indicado.
// Protegido por token (CRON_SECRET). Params: ?token=&asesora=&correo=&fecha=
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function tokenValido(req: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  return (req.nextUrl.searchParams.get("token") ?? "") === esperado
    || (req.headers.get("x-cron-secret") ?? "") === esperado;
}

function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

async function run(req: NextRequest) {
  if (!tokenValido(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const asesora = sp.get("asesora") ?? "";
  const correo = sp.get("correo") ?? "";
  const fecha = sp.get("fecha") || hoyBogota();
  if (!asesora || !correo) return NextResponse.json({ error: "Faltan parámetros: asesora y correo" }, { status: 400 });
  try {
    const r = await enviarResumenPrueba(fecha, asesora, correo);
    return NextResponse.json({ ...r, fecha });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
