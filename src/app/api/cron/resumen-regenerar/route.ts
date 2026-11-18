import { NextRequest, NextResponse } from "next/server";
import { generarResumenesDelDia } from "@/lib/resumen-diario";

// Regenera (IA) y GUARDA los resúmenes de un día — sin enviar correos. Sirve para
// corregir resúmenes ya guardados tras ajustar las reglas del prompt.
// Protegido por token (CRON_SECRET). ?token=&fecha=YYYY-MM-DD
export const maxDuration = 120;
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
  const fecha = req.nextUrl.searchParams.get("fecha") || hoyBogota();
  try {
    const r = await generarResumenesDelDia(fecha);
    return NextResponse.json({ ok: true, fecha, regenerados: r.length, asesoras: r.map((x) => x.nombre) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
