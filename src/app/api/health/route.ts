import { NextResponse } from "next/server";

// Endpoint de salud liviano y público. Sirve para que un agendador externo
// (QStash) lo "pingee" cada pocos minutos y el servicio free de Render NO se
// duerma (evita los arranques en frío de ~50s que hacían sentir la app muerta).
// No hace trabajo pesado ni toca la base de datos.
export const dynamic = "force-dynamic";

function ok() {
  return NextResponse.json({ ok: true, ts: Date.now() }, { headers: { "cache-control": "no-store" } });
}
export function GET() { return ok(); }
export function POST() { return ok(); } // QStash dispara con POST
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "cache-control": "no-store" } });
}
