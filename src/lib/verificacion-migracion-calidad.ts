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

// ============================================================
// SOLO LECTURA — verifica, DESPUÉS de ejecutar 0003, que los 1090 ciclos
// existentes quedaron intactos y que las tablas nuevas están en el estado
// esperado. No escribe nada.
// ============================================================

export interface ReporteVerificacionPostMigracion {
  totalCiclos: number;
  ciclosPorEstado: Record<string, number>;
  ciclosConFechaAuditoriaNoNula: number;
  ciclosConFechaAcuseNoNula: number;
  totalEventos: number;
  eventosPorTipo: Record<string, number>;
  configuracionCiclo: {
    totalFilas: number;
    diasHabilesCompromiso: number | null;
  };
  totalCompromisos: number;
}

export async function verificarEstadoPostMigracion(): Promise<ReporteVerificacionPostMigracion> {
  const supabase = getSupabase();

  const [ciclosPorEstado, eventosPorTipo] = await Promise.all([
    contarPorValor("ciclo_auditoria", "estado"),
    contarPorValor("evento_ciclo", "tipo_evento"),
  ]);
  const totalCiclos = Object.values(ciclosPorEstado).reduce((a, b) => a + b, 0);
  const totalEventos = Object.values(eventosPorTipo).reduce((a, b) => a + b, 0);

  const { count: ciclosConFechaAuditoriaNoNula, error: err1 } = await supabase
    .from("ciclo_auditoria")
    .select("id", { count: "exact", head: true })
    .not("fecha_auditoria", "is", null);
  if (err1) throw new Error(`Supabase (fecha_auditoria): ${err1.message}`);

  const { count: ciclosConFechaAcuseNoNula, error: err2 } = await supabase
    .from("ciclo_auditoria")
    .select("id", { count: "exact", head: true })
    .not("fecha_acuse", "is", null);
  if (err2) throw new Error(`Supabase (fecha_acuse): ${err2.message}`);

  const { data: configData, error: err3 } = await supabase
    .from("configuracion_ciclo")
    .select("dias_habiles_compromiso");
  if (err3) throw new Error(`Supabase (configuracion_ciclo): ${err3.message}`);

  const { count: totalCompromisos, error: err4 } = await supabase
    .from("compromiso")
    .select("id", { count: "exact", head: true });
  if (err4) throw new Error(`Supabase (compromiso): ${err4.message}`);

  return {
    totalCiclos,
    ciclosPorEstado,
    ciclosConFechaAuditoriaNoNula: ciclosConFechaAuditoriaNoNula ?? 0,
    ciclosConFechaAcuseNoNula: ciclosConFechaAcuseNoNula ?? 0,
    totalEventos,
    eventosPorTipo,
    configuracionCiclo: {
      totalFilas: configData?.length ?? 0,
      diasHabilesCompromiso: configData?.[0]?.dias_habiles_compromiso ?? null,
    },
    totalCompromisos: totalCompromisos ?? 0,
  };
}
