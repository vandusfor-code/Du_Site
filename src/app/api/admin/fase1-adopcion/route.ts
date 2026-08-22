import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adoptarAuditorias } from "@/lib/gestion-auditorias";
import { verificarAdopcion } from "@/lib/verificacion-fase1";

// ============================================================
// Ruta temporal SOLO para verificar Fase 1 contra datos reales.
//
// No es una pantalla ni se enlaza desde ninguna parte de la UI — se visita
// escribiendo la URL directamente, ya autenticado como Admin. Existe
// mientras se valida la adopción del ciclo de gestión; no reemplaza ni
// modifica nada de /admin ni de la plataforma del asesor.
//
// Misma verificación de autorización que ya usa admin/actions.ts
// (session.user.modulos.includes("admin")) — no session.user.rol, para
// ser consistentes con cómo están protegidos hoy los demás server actions
// de auditorías (ver diagnóstico de Fase 0, sección de seguridad).
// ============================================================

export async function GET() {
  const session = await auth();
  if (!session?.user?.modulos.includes("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await adoptarAuditorias();
    const verificacion = await verificarAdopcion();
    console.log("[fase1-adopcion] resultado:", JSON.stringify(resultado));
    console.log("[fase1-adopcion] verificacion:", JSON.stringify(verificacion));
    return NextResponse.json({ resultado, verificacion });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en la adopción" },
      { status: 500 }
    );
  }
}
