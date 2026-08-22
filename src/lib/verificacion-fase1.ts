import "server-only";
import { getSupabase } from "./supabase";

// ============================================================
// SOLO PARA VERIFICAR LA PRUEBA DE FASE 1 — no es parte del diseño
// aprobado (gestion-auditorias.ts), y se puede borrar sin tocar nada de
// producción una vez que la corrida quede validada.
//
// No decide nada de negocio: solo consulta ciclo_auditoria/evento_ciclo
// y arma un resumen para poder confirmar, sin acceso directo a Supabase,
// que la adopción hizo exactamente lo esperado (idempotencia, sin
// duplicados, motivos correctos en NO_ELEGIBLE).
// ============================================================

export interface ReporteVerificacionFase1 {
  totalCiclos: number;
  porEstado: Record<string, number>;
  porMotivoNoElegible: Record<string, number>;
  totalEventos: number;
  porTipoEvento: Record<string, number>;
  // Si un mismo ciclo_id tiene más de un evento del mismo tipo, algo se
  // duplicó — debe salir vacío siempre.
  ciclosConEventosDuplicados: { ciclo_id: string; tipo_evento: string; cantidad: number }[];
  // requiere_compromiso NO debe tocarse en esta corrida (ver instrucción
  // explícita de no procesar "Por enviar" todavía) — se reporta para
  // confirmar que sigue en false para todos.
  ciclosConRequiereCompromisoActivo: number;
  muestraNoElegibles: { id_gestion: string; asesor_codigo: string; motivo_no_elegible: string }[];
}

// PostgREST no devuelve más de 1000 filas por consulta salvo que se pagine
// explícitamente con .range() — sin esto, cualquier tabla con más de 1000
// filas parece tener exactamente 1000 y el resto "falta" en silencio.
const TAMANO_PAGINA = 1000;

async function traerTodasLasFilas<T>(tabla: string, columnas: string): Promise<T[]> {
  const supabase = getSupabase();
  const todas: T[] = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await supabase.from(tabla).select(columnas).range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new Error(`Supabase (${tabla}): ${error.message}`);
    const pagina = (data ?? []) as T[];
    todas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }
  return todas;
}

export async function verificarAdopcion(): Promise<ReporteVerificacionFase1> {
  const ciclos = await traerTodasLasFilas<{
    id: string;
    id_gestion: string;
    asesor_codigo: string;
    estado: string;
    motivo_no_elegible: string | null;
    requiere_compromiso: boolean;
  }>("ciclo_auditoria", "id, id_gestion, asesor_codigo, estado, motivo_no_elegible, requiere_compromiso");

  const eventos = await traerTodasLasFilas<{ id: string; ciclo_id: string; tipo_evento: string }>(
    "evento_ciclo",
    "id, ciclo_id, tipo_evento"
  );

  const porEstado: Record<string, number> = {};
  const porMotivoNoElegible: Record<string, number> = {};
  let ciclosConRequiereCompromisoActivo = 0;
  const muestraNoElegibles: ReporteVerificacionFase1["muestraNoElegibles"] = [];

  for (const c of ciclos) {
    porEstado[c.estado] = (porEstado[c.estado] ?? 0) + 1;
    if (c.motivo_no_elegible) {
      porMotivoNoElegible[c.motivo_no_elegible] = (porMotivoNoElegible[c.motivo_no_elegible] ?? 0) + 1;
      if (muestraNoElegibles.length < 15) {
        muestraNoElegibles.push({
          id_gestion: c.id_gestion,
          asesor_codigo: c.asesor_codigo,
          motivo_no_elegible: c.motivo_no_elegible,
        });
      }
    }
    if (c.requiere_compromiso) ciclosConRequiereCompromisoActivo++;
  }

  const porTipoEvento: Record<string, number> = {};
  const conteoPorCicloYTipo = new Map<string, number>();
  for (const e of eventos) {
    porTipoEvento[e.tipo_evento] = (porTipoEvento[e.tipo_evento] ?? 0) + 1;
    const clave = `${e.ciclo_id}::${e.tipo_evento}`;
    conteoPorCicloYTipo.set(clave, (conteoPorCicloYTipo.get(clave) ?? 0) + 1);
  }

  const ciclosConEventosDuplicados: ReporteVerificacionFase1["ciclosConEventosDuplicados"] = [];
  for (const [clave, cantidad] of conteoPorCicloYTipo) {
    if (cantidad > 1) {
      const [ciclo_id, tipo_evento] = clave.split("::");
      ciclosConEventosDuplicados.push({ ciclo_id, tipo_evento, cantidad });
    }
  }

  return {
    totalCiclos: ciclos.length,
    porEstado,
    porMotivoNoElegible,
    totalEventos: eventos.length,
    porTipoEvento,
    ciclosConEventosDuplicados,
    ciclosConRequiereCompromisoActivo,
    muestraNoElegibles,
  };
}
