import "server-only";
import { getSupabase } from "@/lib/supabase";
import { CONFIG_REGLAS, type ConfigReglas, type RegistroPila, type ResultadoValidacion, type MetaTrabajador } from "./pila-tipos";

// ============================================================
// Persistencia NATIVA del Validador PILA (Supabase). Guarda cada validación
// con su resultado, los registros extraídos y el resumen por periodo. Acceso
// por service-role; el filtrado por asesor/rol lo imponen las server actions.
// ============================================================

const T_VAL = "empleo_validaciones";
const T_REG = "empleo_registros";
const T_RES = "empleo_resumen";
const T_CFG = "empleo_config";

export interface GuardarValidacionInput {
  asesorCodigo: string;
  asesorNombre: string;
  meta: MetaTrabajador;
  archivoNombre: string;
  archivoRuta: string | null;
  resultado: ResultadoValidacion;
  registros: RegistroPila[];
}

export async function guardarValidacion(input: GuardarValidacionInput): Promise<string> {
  const sb = getSupabase();
  const r = input.resultado;
  const { data, error } = await sb
    .from(T_VAL)
    .insert({
      asesor_codigo: input.asesorCodigo,
      asesor_nombre: input.asesorNombre,
      trabajador_nombre: input.meta.nombre ?? "",
      trabajador_documento: input.meta.documento ?? "",
      tipo_trabajador: r.tipoTrabajador,
      fecha_solicitud: r.fechaSolicitud,
      ventana_desde: r.ventana.desde,
      ventana_hasta: r.ventana.hasta,
      dias_requeridos: r.diasRequeridos,
      dias_acreditados: r.diasAcreditados,
      dias_diferencia: r.diasDiferencia,
      periodos_con_aporte: r.periodosConAporte,
      estado: r.estado,
      motivo: r.motivo,
      archivo_nombre: input.archivoNombre,
      archivo_ruta: input.archivoRuta,
      observacion_auto: observacionAutomatica(r),
      version_motor: r.versionMotor,
      analisis: r.analisis,
      inconsistencias: r.inconsistencias,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo guardar la validación: ${error.message}`);
  const validacionId = String(data.id);

  // Registros individuales (traza).
  if (input.registros.length > 0) {
    const porPeriodoEstado = new Map<string, string>();
    for (const p of r.resumenPorPeriodo) porPeriodoEstado.set(p.periodo, p.estado);
    const filas = input.registros.map((reg) => ({
      validacion_id: validacionId,
      fila: reg.fila, nit: reg.nit, periodo: reg.periodo, fecha_pago: reg.fechaPago,
      aporte: reg.aporte, salario_basico: reg.salarioBasico, ibc: reg.ibc, dias_cot: reg.diasCot,
      planilla: reg.planilla, novedades: reg.novedades,
      estado_registro: reg.aporte <= 0 ? "excluido" : (porPeriodoEstado.get(reg.periodo) === "excluido" ? "excluido" : "contabilizado"),
      motivo_exclusion: reg.aporte <= 0 ? "Aporte en cero" : "",
      crudo: reg.crudo,
    }));
    const { error: e2 } = await sb.from(T_REG).insert(filas);
    if (e2) throw new Error(`No se pudieron guardar los registros: ${e2.message}`);
  }

  // Resumen por periodo.
  if (r.resumenPorPeriodo.length > 0) {
    const filas = r.resumenPorPeriodo.map((p) => ({
      validacion_id: validacionId, periodo: p.periodo, nits: p.nits, registros: p.registros,
      dias_reportados: p.diasReportados, dias_reconocidos: p.diasReconocidos,
      aporte_acumulado: p.aporteAcumulado, novedades: p.novedades, estado: p.estado,
      excede_limite: p.excedeLimite, fuera_ventana: p.fueraDeVentana,
    }));
    const { error: e3 } = await sb.from(T_RES).insert(filas);
    if (e3) throw new Error(`No se pudo guardar el resumen: ${e3.message}`);
  }

  return validacionId;
}

export function observacionAutomatica(r: ResultadoValidacion): string {
  const partes: string[] = [r.motivo];
  if (r.analisis.registrosAporteCero > 0) partes.push(`Se excluyeron ${r.analisis.registrosAporteCero} registro(s) con aporte en cero.`);
  if (r.analisis.registrosFueraVentana > 0) partes.push(`${r.analisis.registrosFueraVentana} registro(s) quedaron fuera de la ventana de 3 años.`);
  const adv = r.inconsistencias.filter((i) => i.nivel !== "info");
  if (adv.length > 0) partes.push(`Inconsistencias detectadas: ${adv.length}.`);
  return partes.join(" ");
}

export interface FilaHistorial {
  id: string;
  creadoEn: string;
  asesorCodigo: string;
  asesorNombre: string;
  trabajadorNombre: string;
  trabajadorDocumento: string;
  tipoTrabajador: string;
  diasRequeridos: number;
  diasAcreditados: number;
  estado: string;
}

export interface FiltrosHistorial {
  asesorCodigo?: string | null; // si viene, solo ese asesor
  busqueda?: string;
  estado?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
}

export async function listarValidaciones(f: FiltrosHistorial): Promise<FilaHistorial[]> {
  try {
    const sb = getSupabase();
    let q = sb.from(T_VAL)
      .select("id,creado_en,asesor_codigo,asesor_nombre,trabajador_nombre,trabajador_documento,tipo_trabajador,dias_requeridos,dias_acreditados,estado")
      .order("creado_en", { ascending: false })
      .limit(f.limite ?? 300);
    if (f.asesorCodigo) q = q.eq("asesor_codigo", f.asesorCodigo);
    if (f.estado) q = q.eq("estado", f.estado);
    if (f.tipo) q = q.eq("tipo_trabajador", f.tipo);
    if (f.desde) q = q.gte("creado_en", f.desde);
    if (f.hasta) q = q.lte("creado_en", `${f.hasta}T23:59:59`);
    const { data, error } = await q;
    if (error) throw error;
    let filas = (data ?? []).map(mapHistorial);
    const b = (f.busqueda ?? "").trim().toLowerCase();
    if (b) filas = filas.filter((x) => x.trabajadorNombre.toLowerCase().includes(b) || x.trabajadorDocumento.includes(b));
    return filas;
  } catch {
    return [];
  }
}

function mapHistorial(r: Record<string, unknown>): FilaHistorial {
  return {
    id: String(r.id), creadoEn: String(r.creado_en), asesorCodigo: String(r.asesor_codigo ?? ""),
    asesorNombre: String(r.asesor_nombre ?? ""), trabajadorNombre: String(r.trabajador_nombre ?? ""),
    trabajadorDocumento: String(r.trabajador_documento ?? ""), tipoTrabajador: String(r.tipo_trabajador ?? ""),
    diasRequeridos: Number(r.dias_requeridos ?? 0), diasAcreditados: Number(r.dias_acreditados ?? 0),
    estado: String(r.estado ?? ""),
  };
}

export interface ValidacionCompleta {
  cabecera: Record<string, unknown>;
  registros: Record<string, unknown>[];
  resumen: Record<string, unknown>[];
}

export async function obtenerValidacion(id: string): Promise<ValidacionCompleta | null> {
  try {
    const sb = getSupabase();
    const { data: cab, error } = await sb.from(T_VAL).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!cab) return null;
    const [{ data: regs }, { data: res }] = await Promise.all([
      sb.from(T_REG).select("*").eq("validacion_id", id).order("fila", { ascending: true }),
      sb.from(T_RES).select("*").eq("validacion_id", id).order("periodo", { ascending: true }),
    ]);
    return { cabecera: cab, registros: regs ?? [], resumen: res ?? [] };
  } catch {
    return null;
  }
}

export async function actualizarObservacionAsesor(id: string, texto: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_VAL).update({ observacion_asesor: texto }).eq("id", id);
  if (error) throw new Error(`No se pudo guardar la observación: ${error.message}`);
}

/* ── Estadísticas (Reportes) ── */
export interface Estadisticas {
  total: number;
  cumple: number;
  noCumple: number;
  revision: number;
  pctCumplimiento: number;
  promedioDias: number;
  porAsesor: { asesor: string; total: number; cumple: number }[];
  porMes: { mes: string; total: number }[];
}

export async function obtenerEstadisticas(f: FiltrosHistorial): Promise<Estadisticas> {
  const vacio: Estadisticas = { total: 0, cumple: 0, noCumple: 0, revision: 0, pctCumplimiento: 0, promedioDias: 0, porAsesor: [], porMes: [] };
  try {
    const sb = getSupabase();
    let q = sb.from(T_VAL).select("asesor_nombre,asesor_codigo,estado,dias_acreditados,creado_en").limit(5000);
    if (f.asesorCodigo) q = q.eq("asesor_codigo", f.asesorCodigo);
    if (f.desde) q = q.gte("creado_en", f.desde);
    if (f.hasta) q = q.lte("creado_en", `${f.hasta}T23:59:59`);
    const { data, error } = await q;
    if (error) throw error;
    const filas = data ?? [];
    const total = filas.length;
    if (total === 0) return vacio;
    const cumple = filas.filter((r) => r.estado === "CUMPLE").length;
    const noCumple = filas.filter((r) => r.estado === "NO_CUMPLE").length;
    const revision = filas.filter((r) => r.estado === "REQUIERE_REVISION").length;
    const promedioDias = Math.round(filas.reduce((s, r) => s + Number(r.dias_acreditados ?? 0), 0) / total);
    const asesorMap = new Map<string, { total: number; cumple: number }>();
    const mesMap = new Map<string, number>();
    for (const r of filas) {
      const a = String(r.asesor_nombre || r.asesor_codigo || "—");
      const e = asesorMap.get(a) ?? { total: 0, cumple: 0 };
      e.total++; if (r.estado === "CUMPLE") e.cumple++; asesorMap.set(a, e);
      const mes = String(r.creado_en ?? "").slice(0, 7);
      if (mes) mesMap.set(mes, (mesMap.get(mes) ?? 0) + 1);
    }
    return {
      total, cumple, noCumple, revision,
      pctCumplimiento: Math.round((cumple / total) * 1000) / 10,
      promedioDias,
      porAsesor: [...asesorMap.entries()].map(([asesor, v]) => ({ asesor, ...v })).sort((a, b) => b.total - a.total),
      porMes: [...mesMap.entries()].map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  } catch {
    return vacio;
  }
}

/* ── Configuración de reglas (umbrales) ── */
export async function obtenerConfigReglas(): Promise<ConfigReglas> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from(T_CFG).select("valor").eq("clave", "reglas").maybeSingle();
    if (data?.valor && typeof data.valor === "object") {
      return { ...CONFIG_REGLAS, ...(data.valor as Partial<ConfigReglas>) };
    }
  } catch { /* usa el default */ }
  return CONFIG_REGLAS;
}

export async function guardarConfigReglas(cfg: ConfigReglas): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(T_CFG).upsert({ clave: "reglas", valor: cfg, actualizado_en: new Date().toISOString() }, { onConflict: "clave" });
  if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
}
