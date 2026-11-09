import { NextRequest, NextResponse } from "next/server";
import { enviarReporteDiario } from "@/lib/reporte-diario";

// CRON del reporte diario de radicaciones/PQRSF. Lo dispara QStash a las 7 p. m.
// (hora Colombia); la lógica salta domingos. Autenticado por token (CRON_SECRET),
// igual que /api/cron/calidad. Con ?dry=1 genera el PDF pero no envía el correo.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

let corriendo = false;

function tokenValido(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-cron-secret") ?? "";
  const query = request.nextUrl.searchParams.get("token") ?? "";
  return bearer === esperado || header === esperado || query === esperado;
}

async function ejecutar(request: NextRequest): Promise<NextResponse> {
  if (!tokenValido(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dry = ["1", "true", "si", "sí"].includes((request.nextUrl.searchParams.get("dry") ?? "").toLowerCase());
  if (corriendo) return NextResponse.json({ ok: true, saltado: true, motivo: "Ya en ejecución." });
  corriendo = true;
  try {
    const r = await enviarReporteDiario(dry);
    console.log("[cron/reporte-diario]", JSON.stringify(r));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/reporte-diario] error:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  } finally {
    corriendo = false;
  }
}

export async function POST(request: NextRequest) { return ejecutar(request); }
export async function GET(request: NextRequest) { return ejecutar(request); }
