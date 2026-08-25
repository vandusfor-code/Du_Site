import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/auth-helpers";
import { adoptarAuditorias, diagnosticarBrechaAdopcion } from "@/lib/gestion-auditorias";
import { verificarAdopcion } from "@/lib/verificacion-fase1";

// ============================================================
// Ruta temporal SOLO para verificar Fase 1 contra datos reales.
//
// No es una pantalla ni se enlaza desde ninguna parte de la UI — se visita
// escribiendo la URL directamente, ya autenticado como Admin. Existe
// mientras se valida la adopción del ciclo de gestión; no reemplaza ni
// modifica nada de /admin ni de la plataforma del asesor.
//
// Autorización por columna Rol (esAdmin), la única fuente oficial del
// privilegio administrativo — nunca por el módulo "admin" asignable
// (corregido: antes usaba session.user.modulos.includes("admin"), lo que
// permitía que cualquier usuario con ese módulo marcado en Usuarios,
// aunque su Rol no fuera Admin, pudiera invocar esta ruta).
// ============================================================

// La primera corrida real inserta ~1000 filas nuevas; aunque ahora la
// adopción va en lotes (ver gestion-auditorias.ts) en vez de fila por fila,
// se deja el mismo margen que admin/page.tsx usa para el motor de auditoría
// sobre el mismo Consolidado.
export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!esAdmin(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await adoptarAuditorias();
    const verificacion = await verificarAdopcion();
    const diagnostico = await diagnosticarBrechaAdopcion();
    console.log("[fase1-adopcion] resultado:", JSON.stringify(resultado));
    console.log("[fase1-adopcion] verificacion:", JSON.stringify(verificacion));
    console.log("[fase1-adopcion] diagnostico:", JSON.stringify(diagnostico));
    return NextResponse.json({ resultado, verificacion, diagnostico });
  } catch (e) {
    console.error("[fase1-adopcion] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error desconocido en la adopción" },
      { status: 500 }
    );
  }
}
