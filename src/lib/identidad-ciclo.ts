// ============================================================
// Resolución de identidad para el Ciclo de Gestión de Auditorías (Fase 1).
//
// Función PURA a propósito (sin I/O, sin "server-only", sin imports de
// Next): recibe los universos de datos ya leídos y solo decide. Esto
// permite probarla con datos sintéticos sin tocar Google Sheets ni
// Supabase, y sin depender de los alias "@/..." que solo resuelve Next.
//
// Regla de oro: nunca se hace coincidencia aproximada. Toda comparación
// es exacta tras normalizar (trim + mayúsculas). Ante cualquier duda,
// se falla cerrado (SIN_ASESOR_ASOCIADO / SIN_CORREO / AMBIGUO) — nunca
// se elige un candidato al azar.
//
// Consolidado NUNCA se modifica desde aquí: esta función solo lee datos
// ya extraídos (arrays en memoria) y no escribe nada.
// ============================================================

export type MotivoNoElegible = "SIN_ASESOR_ASOCIADO" | "SIN_CORREO" | "AMBIGUO";

export type ResultadoIdentidad =
  | { estado: "ELEGIBLE"; asesorCodigo: string; correo: string }
  | { estado: "SIN_CORREO"; asesorCodigo: string }
  | { estado: "SIN_ASESOR_ASOCIADO" }
  | { estado: "AMBIGUO"; correosEnConflicto: string[] };

export interface FilaFuncionario {
  codigo: string;
  correo: string;
}

function normalizar(v: string): string {
  return (v ?? "").trim().toUpperCase();
}

/**
 * session.user.usuario -> ¿existe como Asesor en Consolidado? -> correo desde Funcionarios.
 *
 * @param usuarioSesion   Valor tal cual viene de session.user.usuario (sin normalizar).
 * @param asesoresConsolidado  Valores crudos de la columna Asesor de Consolidado (pueden
 *   repetirse y venir en distinta mayúscula/minúscula; NO se deduplican antes de llamar).
 * @param funcionarios    Filas crudas de la hoja Funcionarios (código + correo), sin normalizar.
 */
export function resolverIdentidadAsesor(
  usuarioSesion: string,
  asesoresConsolidado: string[],
  funcionarios: FilaFuncionario[]
): ResultadoIdentidad {
  const objetivo = normalizar(usuarioSesion);

  if (!objetivo) return { estado: "SIN_ASESOR_ASOCIADO" };

  const existeEnConsolidado = asesoresConsolidado.some((a) => normalizar(a) === objetivo);
  if (!existeEnConsolidado) return { estado: "SIN_ASESOR_ASOCIADO" };

  const filasFuncionario = funcionarios.filter((f) => normalizar(f.codigo) === objetivo);

  const correosDistintos = [
    ...new Set(filasFuncionario.map((f) => (f.correo ?? "").trim().toLowerCase()).filter(Boolean)),
  ];

  if (correosDistintos.length > 1) {
    // Funcionarios tiene más de una fila para el mismo código, con correos
    // distintos entre sí: no hay forma segura de saber cuál usar. Se falla
    // cerrado en vez de adivinar (mismo criterio que resolverAsesoraId()
    // en el módulo de Documentación).
    return { estado: "AMBIGUO", correosEnConflicto: correosDistintos };
  }

  const correo = correosDistintos[0] ?? "";
  if (!correo) return { estado: "SIN_CORREO", asesorCodigo: objetivo };

  return { estado: "ELEGIBLE", asesorCodigo: objetivo, correo };
}
