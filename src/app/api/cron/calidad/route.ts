import { NextRequest, NextResponse } from "next/server";
import {
  procesarNotificacionesPendientes,
  dryRunNotificaciones,
} from "@/lib/notificacion-por-enviar";
import {
  procesarRecordatoriosPendientes,
  dryRunRecordatorios,
} from "@/lib/recordatorios-calidad";
import {
  procesarEscalamiento,
  dryRunEscalamiento,
} from "@/lib/escalamiento-calidad";

// ============================================================
// CRON del módulo Calidad — ciclo diario COMPLETO de notificaciones.
//
// Pensado para dispararse desde un agendador externo (Upstash QStash) una vez
// por día hábil. A diferencia de las rutas manuales (/api/admin/*), NO exige
// sesión de admin: se autentica con un TOKEN secreto (CRON_SECRET), para que
// el agendador pueda llamarlo sin credenciales de usuario.
//
// En una sola corrida procesa TODOS los pendientes, en orden:
//   1) Notificaciones  (CREADA + requiere_compromiso -> NOTIFICADA)
//   2) Recordatorios   (ACUSE y COMPROMISO, día hábil 1 y 2)
//   3) Escalamiento    (vencidas -> un correo consolidado a Coordinación)
//
// La lógica de día hábil y de "ya enviado hoy" vive en cada procesador; aquí
// solo se orquesta. Con ?dry=1 simula (no envía, no escribe correos).
//
// Seguridad extra contra solapamiento (los chequeos de idempotencia son a
// nivel de app, no de BD): un candado en memoria evita dos corridas
// simultáneas en la misma instancia (Render free = 1 instancia).
// ============================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic";

let corriendo = false;

function tokenValido(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false; // sin secreto configurado, nadie entra
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-cron-secret") ?? "";
  const query = request.nextUrl.searchParams.get("token") ?? "";
  return bearer === esperado || header === esperado || query === esperado;
}

async function ejecutar(request: NextRequest): Promise<NextResponse> {
  if (!tokenValido(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dry = ["1", "true", "si", "sí"].includes(
    (request.nextUrl.searchParams.get("dry") ?? "").toLowerCase()
  );

  if (corriendo) {
    return NextResponse.json(
      { ok: true, saltado: true, motivo: "Ya hay una corrida en curso." },
      { status: 200 }
    );
  }
  corriendo = true;
  const inicio = Date.now();
  try {
    // En orden: notificar -> recordar -> escalar. Cada paso es independiente;
    // si uno falla, se registra y se sigue con los demás.
    const paso = async (nombre: string, fn: () => Promise<unknown>): Promise<unknown> => {
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        console.error(`[cron/calidad] ${nombre} falló:`, msg);
        return { error: msg };
      }
    };

    const notificaciones = await paso("notificaciones", () =>
      dry ? dryRunNotificaciones() : procesarNotificacionesPendientes()
    );
    const recordatorios = await paso("recordatorios", () =>
      dry ? dryRunRecordatorios() : procesarRecordatoriosPendientes()
    );
    const escalamiento = await paso("escalamiento", () =>
      dry ? dryRunEscalamiento() : procesarEscalamiento()
    );

    const resultado = {
      ok: true,
      modo: dry ? "dry-run" : "real",
      duracionMs: Date.now() - inicio,
      timestamp: new Date().toISOString(),
      notificaciones,
      recordatorios,
      escalamiento,
    };
    console.log("[cron/calidad] resultado:", JSON.stringify(resultado));
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[cron/calidad] error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error desconocido" },
      { status: 500 }
    );
  } finally {
    corriendo = false;
  }
}

// QStash dispara con POST; GET queda para pruebas manuales desde el navegador.
export async function POST(request: NextRequest) {
  return ejecutar(request);
}
export async function GET(request: NextRequest) {
  return ejecutar(request);
}
