import "server-only";
import { getSupabase } from "./supabase";

// ============================================================
// SOLO LECTURA — verifica, con datos reales, que la migración
// 0003_fase1_modulo_calidad.sql es segura antes de ejecutarla:
//
//   - ¿Existe alguna fila de ciclo_auditoria con un estado que NO esté en
//     el CHECK reducido de 7 valores (es decir, 'COMPROMISO_REGISTRADO')?
//   - ¿Existe algún evento con un tipo_evento fuera del catálogo ya
//     conocido? (sanity check — el CHECK nuevo solo agrega valores, nunca
//     quita ninguno de los 5 existentes, así que esto siempre debería
//     salir limpio, pero se verifica en vez de asumirlo).
//
// No escribe nada. No modifica Consolidado (ni podría — esto es Postgres).
// ============================================================

const ESTADOS_NUEVOS_PERMITIDOS = new Set([
  "CREADA",
  "NOTIFICADA",
  "ACUSADA",
  "COMPROMISO_PENDIENTE",
  "EN_SEGUIMIENTO",
  "CERRADA",
  "NO_ELEGIBLE",
]);

const TIPOS_EVENTO_YA_CONOCIDOS = new Set([
  "auditoria_creada",
  "auditoria_no_elegible",
  "compromiso_solicitado_por_calidad",
  "notificacion_enviada",
  "notificacion_fallida",
]);

const TAMANO_PAGINA = 1000;

async function contarPorValor(
  tabla: string,
  columna: string
): Promise<Record<string, number>> {
  const supabase = getSupabase();
  const conteo: Record<string, number> = {};

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columna)
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(`Supabase (${tabla}.${columna}): ${error.message}`);

    const pagina = (data ?? []) as unknown as Record<string, string>[];
    for (const fila of pagina) {
      const valor = fila[columna];
      conteo[valor] = (conteo[valor] ?? 0) + 1;
    }
    if (pagina.length < TAMANO_PAGINA) break;
  }

  return conteo;
}

export interface ReporteCompatibilidadMigracion {
  ciclosPorEstado: Record<string, number>;
  estadosIncompatiblesConElNuevoCheck: string[];
  eventosPorTipo: Record<string, number>;
  tiposEventoNoReconocidos: string[];
  migracionSegunDatosActuales: boolean;
}

export async function verificarCompatibilidadMigracion(): Promise<ReporteCompatibilidadMigracion> {
  const [ciclosPorEstado, eventosPorTipo] = await Promise.all([
    contarPorValor("ciclo_auditoria", "estado"),
    contarPorValor("evento_ciclo", "tipo_evento"),
  ]);

  const estadosIncompatiblesConElNuevoCheck = Object.keys(ciclosPorEstado).filter(
    (estado) => !ESTADOS_NUEVOS_PERMITIDOS.has(estado)
  );
  const tiposEventoNoReconocidos = Object.keys(eventosPorTipo).filter(
    (tipo) => !TIPOS_EVENTO_YA_CONOCIDOS.has(tipo)
  );

  return {
    ciclosPorEstado,
    estadosIncompatiblesConElNuevoCheck,
    eventosPorTipo,
    tiposEventoNoReconocidos,
    migracionSegunDatosActuales: estadosIncompatiblesConElNuevoCheck.length === 0,
  };
}
