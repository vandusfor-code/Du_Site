import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabase } from "@/lib/supabase";

// Avisa al celular de los novios cuando un invitado responde su invitación.
// Lo llama la propia página de la invitación justo después de guardar la respuesta.
// Solo avisa de respuestas reales, recientes y una única vez por respuesta.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODIGO = /^[A-Za-z0-9_-]{4,64}$/;
const VENTANA_MS = 10 * 60 * 1000;

const ok = (enviados: number) => NextResponse.json({ ok: true, enviados });

export async function POST(req: Request) {
  let codigo = "";
  try {
    const body = await req.json();
    codigo = String(body?.codigo ?? "");
  } catch {
    /* cuerpo vacío o inválido */
  }
  if (!CODIGO.test(codigo)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const sb = getSupabase();
    const { data: inv } = await sb
      .from("boda_invitado")
      .select("id, evento_id, nombre, estado, asistentes, pases, respondido, push_enviado")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!inv || inv.estado === "pendiente" || !inv.respondido) return ok(0);
    const respondido = new Date(inv.respondido).getTime();
    if (Date.now() - respondido > VENTANA_MS) return ok(0);
    if (inv.push_enviado && new Date(inv.push_enviado).getTime() >= respondido) return ok(0);

    // Reserva el aviso (evita duplicados si llegan dos llamadas a la vez)
    const marca = sb.from("boda_invitado").update({ push_enviado: new Date().toISOString() }).eq("id", inv.id);
    const { data: reservado } = await (inv.push_enviado ? marca.eq("push_enviado", inv.push_enviado) : marca.is("push_enviado", null)).select("id");
    if (!reservado?.length) return ok(0);

    const [{ data: subs }, { data: vapid }] = await Promise.all([
      sb.from("boda_push").select("id, endpoint, p256dh, auth").eq("evento_id", inv.evento_id),
      sb.from("boda_vapid").select("publica, privada").eq("id", 1).maybeSingle(),
    ]);
    if (!subs?.length || !vapid) return ok(0);

    webpush.setVapidDetails("https://www.duacademy.site", vapid.publica, vapid.privada);

    const n = inv.asistentes || inv.pases || 1;
    const cuerpo =
      inv.estado === "confirmado"
        ? `${inv.nombre} ha confirmado · ${n} ${n === 1 ? "invitado" : "invitados"}`
        : `${inv.nombre} no podrá asistir`;
    const carga = JSON.stringify({ title: "Nueva respuesta", body: cuerpo, tag: `resp-${inv.id}`, evento: inv.evento_id });

    let enviados = 0;
    const caducadas: number[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400, urgency: "high" });
          enviados++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) caducadas.push(s.id);
        }
      }),
    );
    if (caducadas.length) await sb.from("boda_push").delete().in("id", caducadas);
    return ok(enviados);
  } catch {
    // Un fallo de avisos nunca debe afectar a quien responde
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
