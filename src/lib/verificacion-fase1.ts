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

export async function verificarAdopcion(): Promise<ReporteVerificacionFase1> {
  const supabase = getSupabase();

  const { data: ciclos, error: errCiclos } = await supabase
    .from("ciclo_auditoria")
    .select("id, id_gestion, asesor_codigo, estado, motivo_no_elegible, requiere_compromiso");
  if (errCiclos) throw new Error(`Supabase (ciclo_auditoria): ${errCiclos.message}`);

  const { data: eventos, error: errEventos } = await supabase
    .from("evento_ciclo")
    .select("id, ciclo_id, tipo_evento");
  if (errEventos) throw new Error(`Supabase (evento_ciclo): ${errEventos.message}`);

  const porEstado: Record<string, number> = {};
  const porMotivoNoElegible: Record<string, number> = {};
  let ciclosConRequiereCompromisoActivo = 0;
  const muestraNoElegibles: ReporteVerificacionFase1["muestraNoElegibles"] = [];

  for (const c of ciclos ?? []) {
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
  for (const e of eventos ?? []) {
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
    totalCiclos: ciclos?.length ?? 0,
    porEstado,
    porMotivoNoElegible,
    totalEventos: eventos?.length ?? 0,
    porTipoEvento,
    ciclosConEventosDuplicados,
    ciclosConRequiereCompromisoActivo,
    muestraNoElegibles,
  };
}
