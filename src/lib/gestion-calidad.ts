import "server-only";
import { readRange } from "./sheets";
import { getSupabase } from "./supabase";
import { buscarUsuario } from "./usuarios";
import { sumarDiasHabiles } from "./dias-habiles-colombia";
import type { StatusTone } from "@/components/status-badge";

// ============================================================
// MÓDULO CALIDAD — capa de datos del Panel (Etapa 2, solo lectura)
//
// Consolidado sigue siendo de solo lectura, consultado EN VIVO solo para
// el detalle de una auditoría puntual (nota, hallazgos, puntos de mejora)
// — nunca se copia a Supabase. Todo lo demás viene de ciclo_auditoria +
// compromiso + evento_ciclo.
//
// Esta etapa NO implementa recordatorios, escalamiento, ni la acción de
// verificar cumplimiento — eso es la siguiente etapa.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

// Mismos índices que el resto de Fase 1 (Consolidado nunca se reordena).
const COL_ID_GESTION = 6;
const COL_NOTA = 16;
const COL_OBSERVACION = 18;
const COL_HALLAZGOS = 19;
const COL_MEJORA = 20;

const TAMANO_PAGINA_LISTADO = 25;
// Igual que en Fase 1: un IN() con muchos UUIDs arma una URL que el API
// gateway de Supabase rechaza — nunca se manda un lote de eventos más
// grande que esto.
const TAMANO_LOTE_EVENTOS = 150;

// Fecha de corte acordada explícitamente con Calidad: el panel oculta el
// backlog histórico adoptado en la Fase 1 (~1090 ciclos importados de
// Consolidado sin fecha_auditoria real, todos con creado_en del día de la
// migración) y solo muestra ciclos creados desde el arranque operativo
// del módulo. Es un filtro de PRESENTACIÓN sobre creado_en — no borra ni
// modifica ningún registro histórico en ciclo_auditoria.
// 2026-08-24T00:00:00 hora Colombia (UTC-5, sin horario de verano).
// Exportada para que recordatorios-calidad.ts respete el mismo corte —
// nunca una segunda fecha hardcodeada en otro archivo.
export const CORTE_HISTORICO_CALIDAD = "2026-08-24T05:00:00.000Z";

export type EstadoCiclo =
  | "CREADA"
  | "NOTIFICADA"
  | "ACUSADA"
  | "COMPROMISO_PENDIENTE"
  | "EN_SEGUIMIENTO"
  | "CERRADA"
  | "NO_ELEGIBLE";

export type Cumplimiento = "PENDIENTE" | "CUMPLIDO" | "INCUMPLIDO";

interface CompromisoFila {
  texto_compromiso: string;
  fecha_registro: string;
  registrado_por: string;
  fecha_prometida_original: string;
  fecha_prometida: string;
  cumplimiento: Cumplimiento;
  fecha_verificacion: string | null;
  verificado_por: string | null;
  observacion_verificacion: string | null;
  fecha_cierre: string | null;
}

interface CicloConCompromisoRaw {
  id: string;
  id_gestion: string;
  asesor_codigo: string;
  resultado: string;
  fecha_auditoria: string | null;
  fecha_acuse: string | null;
  estado: EstadoCiclo;
  motivo_no_elegible: string | null;
  requiere_compromiso: boolean;
  creado_en: string;
  // PostgREST puede devolver el embed 1:1 como objeto o como arreglo de 1
  // según cómo detecte la relación — se normaliza con compromisoDeFila().
  compromiso: CompromisoFila[] | CompromisoFila | null;
}

function compromisoDeFila(row: CicloConCompromisoRaw): CompromisoFila | null {
  const c = row.compromiso;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

export interface Semaforo {
  tone: StatusTone;
  etiqueta: string;
}

// Ventana de aviso antes de un vencimiento — 1 día calendario. No definida
// con un valor exacto en el diseño aprobado; queda como valor interino,
// señalado explícitamente para que Calidad lo confirme o ajuste. Se mide en
// DÍAS HÁBILES, no calendario — misma unidad que los tres relojes del
// diseño, y se calcula con sumarDiasHabiles(), nunca con una resta de
// milisegundos: nunca una segunda implementación de días hábiles.
const VENTANA_PROXIMO_A_VENCER_DIAS_HABILES = 1;

function estaProximoAVencer(ahoraMs: number, limiteMs: number): boolean {
  const umbral = sumarDiasHabiles(new Date(ahoraMs), VENTANA_PROXIMO_A_VENCER_DIAS_HABILES).getTime();
  return limiteMs <= umbral;
}

function calcularSemaforo(fila: {
  estado: EstadoCiclo;
  fechaNotificacion: string | null;
  fechaAcuse: string | null;
  compromiso: CompromisoFila | null;
}): Semaforo {
  const ahora = Date.now();

  if (fila.estado === "NO_ELEGIBLE") return { tone: "neutral", etiqueta: "No elegible" };
  if (fila.estado === "CERRADA") {
    if (fila.compromiso?.cumplimiento === "INCUMPLIDO") return { tone: "error", etiqueta: "Incumplido" };
    return { tone: "success", etiqueta: fila.compromiso ? "Cumplido" : "Cerrada" };
  }
  if (fila.estado === "CREADA") return { tone: "neutral", etiqueta: "Pendiente de notificación" };

  if (fila.estado === "NOTIFICADA") {
    if (!fila.fechaNotificacion) return { tone: "neutral", etiqueta: "Pendiente de acuse" };
    const limite = sumarDiasHabiles(new Date(fila.fechaNotificacion), 2).getTime();
    if (ahora > limite) return { tone: "error", etiqueta: "Vencida sin acuse" };
    if (estaProximoAVencer(ahora, limite)) return { tone: "warning", etiqueta: "Próxima a vencer (acuse)" };
    return { tone: "neutral", etiqueta: "Pendiente de acuse" };
  }

  if (fila.estado === "COMPROMISO_PENDIENTE") {
    if (!fila.fechaAcuse) return { tone: "neutral", etiqueta: "Pendiente de registrar compromiso" };
    const limite = sumarDiasHabiles(new Date(fila.fechaAcuse), 2).getTime();
    if (ahora > limite) return { tone: "error", etiqueta: "Compromiso no registrado / vencido" };
    if (estaProximoAVencer(ahora, limite)) return { tone: "warning", etiqueta: "Próxima a vencer (compromiso)" };
    return { tone: "neutral", etiqueta: "Pendiente de registrar compromiso" };
  }

  if (fila.estado === "EN_SEGUIMIENTO") {
    const c = fila.compromiso;
    if (!c || c.cumplimiento !== "PENDIENTE") return { tone: "info", etiqueta: "En seguimiento" };
    const limite = new Date(c.fecha_prometida).getTime();
    if (ahora > limite) return { tone: "error", etiqueta: "Compromiso vencido" };
    if (estaProximoAVencer(ahora, limite)) return { tone: "warning", etiqueta: "Próximo a vencer" };
    return { tone: "info", etiqueta: "En seguimiento" };
  }

  // ACUSADA es transitorio (se resuelve automáticamente al mismo tiempo
  // que se determina requiere_compromiso) — no debería observarse en la
  // práctica, pero se cubre igual sin asumir que es imposible.
  return { tone: "neutral", etiqueta: fila.estado };
}

function diasRestantes(fechaPrometida: string | null, cumplimiento: Cumplimiento | null): number | null {
  if (!fechaPrometida || cumplimiento !== "PENDIENTE") return null;
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(fechaPrometida).getTime() - Date.now()) / msPorDia);
}

export interface FilaPanelCalidad {
  cicloId: string;
  idGestion: string;
  asesorCodigo: string;
  nombreAsesora: string;
  fechaAuditoria: string | null;
  resultado: string;
  estado: EstadoCiclo;
  motivoNoElegible: string | null;
  fechaNotificacion: string | null;
  fechaAcuse: string | null;
  requiereCompromiso: boolean;
  fechaRegistroCompromiso: string | null;
  fechaPrometidaOriginal: string | null;
  fechaPrometida: string | null;
  diasRestantes: number | null;
  recordatoriosEnviados: number;
  ultimaNotificacion: string | null;
  cumplimiento: Cumplimiento | null;
  semaforo: Semaforo;
}

export interface FiltrosPanelCalidad {
  estado?: EstadoCiclo;
  asesorCodigo?: string;
  resultado?: "OK" | "PENC";
  requiereCompromiso?: boolean;
  vencidas?: boolean;
  fechaAuditoriaDesde?: string; // ISO
  fechaAuditoriaHasta?: string; // ISO
}

export interface ResultadoPanelCalidad {
  filas: FilaPanelCalidad[];
  totalFilas: number;
  pagina: number;
  tamanoPagina: number;
}

async function resolverNombresAsesoras(codigos: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(codigos)];
  const mapa = new Map<string, string>();
  // Promise.all sobre códigos ÚNICOS de la página actual (25 como máximo) —
  // no es un N+1 por fila, es a lo sumo un lookup por asesora distinta
  // dentro de una sola página.
  await Promise.all(
    unicos.map(async (codigo) => {
      try {
        const usuario = await buscarUsuario(codigo);
        mapa.set(codigo, usuario?.nombre || codigo);
      } catch {
        mapa.set(codigo, codigo);
      }
    })
  );
  return mapa;
}

// Trae, en un solo lote por página (nunca por fila), los eventos de
// notificación/recordatorio de los ciclos de esa página, para calcular
// fechaNotificacion / ultimaNotificacion / recordatoriosEnviados sin N+1.
// Exportada para que recordatorios-calidad.ts reutilice fechaNotificacion
// como fechaBase del reloj de acuse, en vez de releer evento_ciclo aparte.
export async function obtenerEventosNotificacionPorCiclo(
  cicloIds: string[]
): Promise<Map<string, { fechaNotificacion: string | null; ultimaNotificacion: string | null; recordatorios: number }>> {
  const mapa = new Map<string, { fechaNotificacion: string | null; ultimaNotificacion: string | null; recordatorios: number }>();
  if (cicloIds.length === 0) return mapa;

  const supabase = getSupabase();
  for (let i = 0; i < cicloIds.length; i += TAMANO_LOTE_EVENTOS) {
    const lote = cicloIds.slice(i, i + TAMANO_LOTE_EVENTOS);
    const { data, error } = await supabase
      .from("evento_ciclo")
      .select("ciclo_id, tipo_evento, creado_en")
      .in("ciclo_id", lote)
      .in("tipo_evento", ["notificacion_enviada", "recordatorio_acuse_enviado", "recordatorio_compromiso_enviado"])
      .order("creado_en", { ascending: true });
    if (error) throw new Error(`Supabase (evento_ciclo notificaciones): ${error.message}`);

    for (const fila of data ?? []) {
      const e = fila as { ciclo_id: string; tipo_evento: string; creado_en: string };
      const actual = mapa.get(e.ciclo_id) ?? { fechaNotificacion: null, ultimaNotificacion: null, recordatorios: 0 };
      if (e.tipo_evento === "notificacion_enviada" && !actual.fechaNotificacion) {
        actual.fechaNotificacion = e.creado_en;
      }
      if (e.tipo_evento === "recordatorio_acuse_enviado" || e.tipo_evento === "recordatorio_compromiso_enviado") {
        actual.recordatorios++;
      }
      if (!actual.ultimaNotificacion || e.creado_en > actual.ultimaNotificacion) {
        actual.ultimaNotificacion = e.creado_en;
      }
      mapa.set(e.ciclo_id, actual);
    }
  }
  return mapa;
}

// ------------------------------------------------------------
// "Vencidas" — las tres rutas del diseño. Ninguna escanea los 1090+ ciclos:
// las rutas A y B solo leen los estados TRANSITORIOS (NOTIFICADA,
// COMPROMISO_PENDIENTE — conjuntos acotados que se vacían a medida que las
// asesoras actúan, nunca crecen indefinidamente como el histórico
// completo); la ruta C es 100% SQL (fecha_prometida ya es un timestamp
// absoluto, no requiere aritmética de días hábiles). El resultado es una
// lista de ids ya acotada, que luego SÍ se pagina de verdad con .range().
// ------------------------------------------------------------

async function idsVencidosSinAcuse(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ciclo_auditoria")
    .select("id")
    .eq("estado", "NOTIFICADA")
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);
  if (error) throw new Error(`Supabase (vencidas ruta A): ${error.message}`);

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return [];

  const eventosPorCiclo = await obtenerEventosNotificacionPorCiclo(ids);
  const ahora = Date.now();
  return ids.filter((id) => {
    const fechaNotificacion = eventosPorCiclo.get(id)?.fechaNotificacion;
    if (!fechaNotificacion) return false;
    return ahora > sumarDiasHabiles(new Date(fechaNotificacion), 2).getTime();
  });
}

async function idsVencidosSinCompromiso(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ciclo_auditoria")
    .select("id, fecha_acuse")
    .eq("estado", "COMPROMISO_PENDIENTE")
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);
  if (error) throw new Error(`Supabase (vencidas ruta B): ${error.message}`);

  const ahora = Date.now();
  return (data ?? [])
    .filter((r) => {
      const fila = r as { id: string; fecha_acuse: string | null };
      if (!fila.fecha_acuse) return false;
      return ahora > sumarDiasHabiles(new Date(fila.fecha_acuse), 2).getTime();
    })
    .map((r) => (r as { id: string }).id);
}

async function idsCompromisoVencido(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ciclo_auditoria")
    .select("id, compromiso!inner(id)")
    .eq("estado", "EN_SEGUIMIENTO")
    .eq("compromiso.cumplimiento", "PENDIENTE")
    .lt("compromiso.fecha_prometida", new Date().toISOString())
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);
  if (error) throw new Error(`Supabase (vencidas ruta C): ${error.message}`);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

async function obtenerIdsVencidas(): Promise<string[]> {
  const [rutaA, rutaB, rutaC] = await Promise.all([
    idsVencidosSinAcuse(),
    idsVencidosSinCompromiso(),
    idsCompromisoVencido(),
  ]);
  // Las tres rutas son mutuamente excluyentes por estado, pero se
  // deduplica con un Set de todas formas — no cuesta nada y es correcto
  // por construcción en vez de asumirlo.
  return [...new Set([...rutaA, ...rutaB, ...rutaC])];
}

export async function obtenerPanelCalidad(
  filtros: FiltrosPanelCalidad,
  pagina: number
): Promise<ResultadoPanelCalidad> {
  const supabase = getSupabase();
  const desde = pagina * TAMANO_PAGINA_LISTADO;
  const hasta = desde + TAMANO_PAGINA_LISTADO - 1;

  let idsVencidas: string[] | null = null;
  if (filtros.vencidas) {
    idsVencidas = await obtenerIdsVencidas();
    if (idsVencidas.length === 0) {
      return { filas: [], totalFilas: 0, pagina, tamanoPagina: TAMANO_PAGINA_LISTADO };
    }
  }

  let query = supabase
    .from("ciclo_auditoria")
    .select("*, compromiso(*)", { count: "exact" })
    .gte("creado_en", CORTE_HISTORICO_CALIDAD);

  // idsVencidas viene de estados transitorios (acotados, no crecen como el
  // histórico) — en la práctica nunca debería acercarse al límite de URL
  // que ya vimos en Fase 1 con .in() de cientos de UUIDs. Si esa premisa
  // cambiara, habría que paginar este IN por lotes también.
  if (idsVencidas) query = query.in("id", idsVencidas);
  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.asesorCodigo) query = query.eq("asesor_codigo", filtros.asesorCodigo);
  if (filtros.resultado) query = query.eq("resultado", filtros.resultado);
  if (filtros.requiereCompromiso !== undefined) query = query.eq("requiere_compromiso", filtros.requiereCompromiso);
  if (filtros.fechaAuditoriaDesde) query = query.gte("fecha_auditoria", filtros.fechaAuditoriaDesde);
  if (filtros.fechaAuditoriaHasta) query = query.lte("fecha_auditoria", filtros.fechaAuditoriaHasta);

  const { data, error, count } = await query
    .order("creado_en", { ascending: false })
    .range(desde, hasta);
  if (error) throw new Error(`Supabase (ciclo_auditoria panel Calidad): ${error.message}`);

  const filasRaw = (data ?? []) as unknown as CicloConCompromisoRaw[];

  const [nombresPorCodigo, eventosPorCiclo] = await Promise.all([
    resolverNombresAsesoras(filasRaw.map((f) => f.asesor_codigo)),
    obtenerEventosNotificacionPorCiclo(filasRaw.map((f) => f.id)),
  ]);

  const filas: FilaPanelCalidad[] = filasRaw.map((f) => {
    const compromiso = compromisoDeFila(f);
    const eventos = eventosPorCiclo.get(f.id);
    const semaforo = calcularSemaforo({
      estado: f.estado,
      fechaNotificacion: eventos?.fechaNotificacion ?? null,
      fechaAcuse: f.fecha_acuse,
      compromiso,
    });

    return {
      cicloId: f.id,
      idGestion: f.id_gestion,
      asesorCodigo: f.asesor_codigo,
      nombreAsesora: nombresPorCodigo.get(f.asesor_codigo) ?? f.asesor_codigo,
      fechaAuditoria: f.fecha_auditoria,
      resultado: f.resultado,
      estado: f.estado,
      motivoNoElegible: f.motivo_no_elegible,
      fechaNotificacion: eventos?.fechaNotificacion ?? null,
      fechaAcuse: f.fecha_acuse,
      requiereCompromiso: f.requiere_compromiso,
      fechaRegistroCompromiso: compromiso?.fecha_registro ?? null,
      fechaPrometidaOriginal: compromiso?.fecha_prometida_original ?? null,
      fechaPrometida: compromiso?.fecha_prometida ?? null,
      diasRestantes: diasRestantes(compromiso?.fecha_prometida ?? null, compromiso?.cumplimiento ?? null),
      recordatoriosEnviados: eventos?.recordatorios ?? 0,
      ultimaNotificacion: eventos?.ultimaNotificacion ?? null,
      cumplimiento: compromiso?.cumplimiento ?? null,
      semaforo,
    };
  });

  return { filas, totalFilas: count ?? 0, pagina, tamanoPagina: TAMANO_PAGINA_LISTADO };
}

export interface KPIsPanelCalidad {
  notificadasTotales: number;
  pendientesDeAcuse: number;
  vencidasSinAcuse: number;
  compromisosPendientesDeRegistro: number;
  enSeguimiento: number;
  compromisosVencidos: number;
  cumplidos: number;
  incumplidos: number;
  noElegibles: number;
}

export async function obtenerKPIsPanelCalidad(): Promise<KPIsPanelCalidad> {
  const supabase = getSupabase();
  const ahora = new Date().toISOString();

  const [
    rNotificadasTotales,
    rPendientesDeAcuse,
    rCompromisosPendientesDeRegistro,
    rEnSeguimiento,
    rCompromisosVencidos,
    rCumplidos,
    rIncumplidos,
    rNoElegibles,
    idsVencidasSinAcuseKpi,
  ] = await Promise.all([
    supabase
      .from("ciclo_auditoria")
      .select("id", { count: "exact", head: true })
      .in("estado", ["NOTIFICADA", "ACUSADA", "COMPROMISO_PENDIENTE", "EN_SEGUIMIENTO", "CERRADA"])
      .gte("creado_en", CORTE_HISTORICO_CALIDAD),
    supabase
      .from("ciclo_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("estado", "NOTIFICADA")
      .gte("creado_en", CORTE_HISTORICO_CALIDAD),
    supabase
      .from("ciclo_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("estado", "COMPROMISO_PENDIENTE")
      .gte("creado_en", CORTE_HISTORICO_CALIDAD),
    supabase
      .from("ciclo_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("estado", "EN_SEGUIMIENTO")
      .gte("creado_en", CORTE_HISTORICO_CALIDAD),
    supabase.from("compromiso").select("id", { count: "exact", head: true }).eq("cumplimiento", "PENDIENTE").lt("fecha_prometida", ahora),
    supabase.from("compromiso").select("id", { count: "exact", head: true }).eq("cumplimiento", "CUMPLIDO"),
    supabase.from("compromiso").select("id", { count: "exact", head: true }).eq("cumplimiento", "INCUMPLIDO"),
    supabase
      .from("ciclo_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("estado", "NO_ELEGIBLE")
      .gte("creado_en", CORTE_HISTORICO_CALIDAD),
    // Misma ruta A que usa el filtro "Vencidas" del listado — una sola
    // implementación, reutilizada aquí en vez de duplicarla.
    idsVencidosSinAcuse(),
  ]);

  for (const [nombre, r] of [
    ["notificadasTotales", rNotificadasTotales],
    ["pendientesDeAcuse", rPendientesDeAcuse],
    ["compromisosPendientesDeRegistro", rCompromisosPendientesDeRegistro],
    ["enSeguimiento", rEnSeguimiento],
    ["compromisosVencidos", rCompromisosVencidos],
    ["cumplidos", rCumplidos],
    ["incumplidos", rIncumplidos],
    ["noElegibles", rNoElegibles],
  ] as const) {
    if (r.error) throw new Error(`Supabase (KPI ${nombre}): ${r.error.message}`);
  }

  const vencidasSinAcuse = idsVencidasSinAcuseKpi.length;

  const notificadasTotales = rNotificadasTotales.count ?? 0;
  const pendientesDeAcuse = rPendientesDeAcuse.count ?? 0;
  const compromisosPendientesDeRegistro = rCompromisosPendientesDeRegistro.count ?? 0;
  const enSeguimiento = rEnSeguimiento.count ?? 0;
  const compromisosVencidos = rCompromisosVencidos.count ?? 0;
  const cumplidos = rCumplidos.count ?? 0;
  const incumplidos = rIncumplidos.count ?? 0;
  const noElegibles = rNoElegibles.count ?? 0;

  return {
    notificadasTotales,
    pendientesDeAcuse,
    vencidasSinAcuse,
    compromisosPendientesDeRegistro,
    enSeguimiento,
    compromisosVencidos,
    cumplidos,
    incumplidos,
    noElegibles,
  };
}

export interface DetalleAuditoriaCalidad {
  idGestion: string;
  asesorCodigo: string;
  nombreAsesora: string;
  // Leído EN VIVO de Consolidado — nunca copiado a Supabase.
  fechaAuditoriaConsolidado: string;
  resultadoConsolidado: string;
  nota: string;
  observacion: string;
  hallazgos: string;
  mejora: string;

  estado: EstadoCiclo;
  motivoNoElegible: string | null;
  fechaAuditoria: string | null;
  fechaNotificacion: string | null;
  fechaAcuse: string | null;
  requiereCompromiso: boolean;

  compromiso: {
    texto: string;
    fechaRegistro: string;
    fechaPrometidaOriginal: string;
    fechaPrometida: string;
    cumplimiento: Cumplimiento;
    fechaVerificacion: string | null;
    verificadoPor: string | null;
    observacionVerificacion: string | null;
    // Misma diasRestantes() que ya usa el listado — null una vez que
    // cumplimiento deja de ser PENDIENTE (ya no aplica "restantes").
    diasRestantes: number | null;
  } | null;

  historial: { tipoEvento: string; origen: string; actor: string | null; detalle: unknown; creadoEn: string }[];
}

export async function obtenerDetalleAuditoriaCalidad(idGestion: string): Promise<DetalleAuditoriaCalidad> {
  const supabase = getSupabase();

  const { data: ciclo, error: errCiclo } = await supabase
    .from("ciclo_auditoria")
    .select("*, compromiso(*)")
    .eq("id_gestion", idGestion)
    .maybeSingle();
  if (errCiclo) throw new Error(`Supabase (ciclo_auditoria detalle): ${errCiclo.message}`);
  if (!ciclo) throw new Error(`No existe ciclo_auditoria para id_gestion=${idGestion}`);

  const cicloRaw = ciclo as unknown as CicloConCompromisoRaw;
  const compromiso = compromisoDeFila(cicloRaw);

  const [{ data: eventos, error: errEventos }, filaConsolidado, nombreAsesora] = await Promise.all([
    supabase
      .from("evento_ciclo")
      .select("tipo_evento, origen, actor, detalle, creado_en")
      .eq("ciclo_id", cicloRaw.id)
      .order("creado_en", { ascending: true }),
    buscarFilaConsolidado(idGestion),
    buscarUsuario(cicloRaw.asesor_codigo).then((u) => u?.nombre || cicloRaw.asesor_codigo).catch(() => cicloRaw.asesor_codigo),
  ]);
  if (errEventos) throw new Error(`Supabase (evento_ciclo detalle): ${errEventos.message}`);

  const eventoNotificacion = (eventos ?? []).find((e) => e.tipo_evento === "notificacion_enviada");

  return {
    idGestion,
    asesorCodigo: cicloRaw.asesor_codigo,
    nombreAsesora,
    fechaAuditoriaConsolidado: filaConsolidado ? texto(filaConsolidado, 0) : "",
    resultadoConsolidado: filaConsolidado ? texto(filaConsolidado, 17).trim().toUpperCase() : "",
    nota: filaConsolidado ? texto(filaConsolidado, COL_NOTA) : "",
    observacion: filaConsolidado ? texto(filaConsolidado, COL_OBSERVACION) : "",
    hallazgos: filaConsolidado ? texto(filaConsolidado, COL_HALLAZGOS) : "",
    mejora: filaConsolidado ? texto(filaConsolidado, COL_MEJORA) : "",

    estado: cicloRaw.estado,
    motivoNoElegible: cicloRaw.motivo_no_elegible,
    fechaAuditoria: cicloRaw.fecha_auditoria,
    fechaNotificacion: eventoNotificacion?.creado_en ?? null,
    fechaAcuse: cicloRaw.fecha_acuse,
    requiereCompromiso: cicloRaw.requiere_compromiso,

    compromiso: compromiso
      ? {
          texto: compromiso.texto_compromiso,
          fechaRegistro: compromiso.fecha_registro,
          fechaPrometidaOriginal: compromiso.fecha_prometida_original,
          fechaPrometida: compromiso.fecha_prometida,
          cumplimiento: compromiso.cumplimiento,
          fechaVerificacion: compromiso.fecha_verificacion,
          verificadoPor: compromiso.verificado_por,
          observacionVerificacion: compromiso.observacion_verificacion,
          diasRestantes: diasRestantes(compromiso.fecha_prometida, compromiso.cumplimiento),
        }
      : null,

    historial: (eventos ?? []).map((e) => ({
      tipoEvento: e.tipo_evento,
      origen: e.origen,
      actor: e.actor,
      detalle: e.detalle,
      creadoEn: e.creado_en,
    })),
  };
}

export type ResultadoVerificacion = Extract<Cumplimiento, "CUMPLIDO" | "INCUMPLIDO">;

export interface ResultadoVerificarCumplimiento {
  // false cuando esta solicitud llegó tarde (doble clic, refresh, dos
  // pestañas): el compromiso ya lo verificó otra solicitud primero. No es
  // un error — el estado devuelto ya refleja lo que de verdad quedó en la
  // base de datos.
  aplicado: boolean;
  estado: EstadoCiclo;
}

// ------------------------------------------------------------
// Etapa 3 — verificar cumplimiento de un compromiso EN_SEGUIMIENTO.
// Único punto que decide "quién ganó" es el UPDATE condicional sobre
// compromiso (paso 3 más abajo) — mismo patrón que
// notificacion-por-enviar.ts (transición NOTIFICADA) y
// corrida2-por-enviar.ts (requiere_compromiso): WHERE con el valor
// esperado + .select().maybeSingle() para saber si esta llamada afectó
// la fila o llegó después de que alguien más ya la cambió.
// ------------------------------------------------------------
export async function verificarCumplimiento(
  idGestion: string,
  resultado: ResultadoVerificacion,
  observacion: string,
  verificadoPor: string
): Promise<ResultadoVerificarCumplimiento> {
  const supabase = getSupabase();

  // 1. Buscar ciclo_auditoria por id_gestion.
  const { data: ciclo, error: errCiclo } = await supabase
    .from("ciclo_auditoria")
    .select("id, estado")
    .eq("id_gestion", idGestion)
    .maybeSingle();
  if (errCiclo) throw new Error(`Supabase (ciclo_auditoria verificar cumplimiento): ${errCiclo.message}`);
  if (!ciclo) throw new Error(`No existe ciclo_auditoria para id_gestion=${idGestion}`);
  const cicloRaw = ciclo as { id: string; estado: EstadoCiclo };

  // 2. Precondición dura: solo se puede verificar un ciclo EN_SEGUIMIENTO.
  // A diferencia del paso 4 (más abajo), esto NO es una carrera esperable
  // en operación normal — si la UI está bien (los botones solo aparecen
  // en EN_SEGUIMIENTO), llegar aquí con otro estado es una condición de
  // datos obsoletos en el cliente, no una concurrencia legítima.
  if (cicloRaw.estado !== "EN_SEGUIMIENTO") {
    throw new Error(
      `El ciclo no está EN_SEGUIMIENTO (estado actual: ${cicloRaw.estado}) — no se puede verificar cumplimiento.`
    );
  }

  const ahoraIso = new Date().toISOString();

  // 3. UPDATE condicional sobre compromiso — WHERE cumplimiento='PENDIENTE'.
  // Esto SÍ es la carrera legítima (doble clic, dos pestañas, refresh):
  // solo una solicitud concurrente encuentra la fila en PENDIENTE.
  const { data: compromisoActualizado, error: errUpdateCompromiso } = await supabase
    .from("compromiso")
    .update({
      cumplimiento: resultado,
      fecha_verificacion: ahoraIso,
      verificado_por: verificadoPor,
      observacion_verificacion: observacion,
      fecha_cierre: ahoraIso,
    })
    .eq("ciclo_id", cicloRaw.id)
    .eq("cumplimiento", "PENDIENTE")
    .select("id")
    .maybeSingle();
  if (errUpdateCompromiso) throw new Error(`Supabase (update compromiso): ${errUpdateCompromiso.message}`);

  if (!compromisoActualizado) {
    // 4. El UPDATE no afectó ninguna fila: otra solicitud ya verificó este
    // compromiso primero. No se duplica ningún evento ni se vuelve a tocar
    // el ciclo — se devuelve el estado real tal como quedó.
    const { data: cicloActual, error: errCicloActual } = await supabase
      .from("ciclo_auditoria")
      .select("estado")
      .eq("id", cicloRaw.id)
      .maybeSingle();
    if (errCicloActual) throw new Error(`Supabase (releer ciclo_auditoria): ${errCicloActual.message}`);
    return { aplicado: false, estado: (cicloActual?.estado as EstadoCiclo) ?? cicloRaw.estado };
  }

  // 5. Esta solicitud ganó la carrera — registra el evento de verificación.
  const { error: errEventoVerificado } = await supabase.from("evento_ciclo").insert({
    ciclo_id: cicloRaw.id,
    tipo_evento: "compromiso_verificado",
    origen: "calidad",
    actor: verificadoPor,
    detalle: { resultado, observacion, verificado_por: verificadoPor },
  });
  if (errEventoVerificado) throw new Error(`Supabase (evento compromiso_verificado): ${errEventoVerificado.message}`);

  // 6. Cierra el ciclo — también condicional (mismo patrón), aunque en el
  // modelo actual nada más puede haber movido EN_SEGUIMIENTO entre el
  // paso 2 y aquí: el UPDATE de compromiso ya "reservó" esta transición.
  const { data: cicloCerrado, error: errCierre } = await supabase
    .from("ciclo_auditoria")
    .update({ estado: "CERRADA" })
    .eq("id", cicloRaw.id)
    .eq("estado", "EN_SEGUIMIENTO")
    .select("id")
    .maybeSingle();
  if (errCierre) throw new Error(`Supabase (cerrar ciclo_auditoria): ${errCierre.message}`);

  // Defensivo: solo registra auditoria_cerrada si este llamado fue el que
  // de verdad cerró el ciclo (evita un evento duplicado en el caso teórico
  // de que ya estuviera CERRADA por otra vía).
  if (cicloCerrado) {
    const { error: errEventoCierre } = await supabase.from("evento_ciclo").insert({
      ciclo_id: cicloRaw.id,
      tipo_evento: "auditoria_cerrada",
      origen: "calidad",
      actor: verificadoPor,
      detalle: { motivo_cierre: "COMPROMISO_VERIFICADO" },
    });
    if (errEventoCierre) throw new Error(`Supabase (evento auditoria_cerrada): ${errEventoCierre.message}`);
  }

  return { aplicado: true, estado: "CERRADA" };
}

async function buscarFilaConsolidado(idGestion: string): Promise<unknown[] | null> {
  const id = sheetId();
  const consolidadoRaw = await readRange(id, "Consolidado!A2:R", { unformatted: true });
  return consolidadoRaw.find((r) => texto(r, COL_ID_GESTION).trim() === idGestion) ?? null;
}
