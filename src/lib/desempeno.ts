import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja, parseSheetDate } from "@/lib/sheets";
import { obtenerMetricasRadicacionMes, type MetricasRadMes } from "@/lib/radicaciones";
import { obtenerPqrsfPorAgenteMes } from "@/lib/lineaAmiga";
import { calcularBono, camposEditablesDe } from "@/lib/desempeno-bono";
import {
  obtenerMetricasManual, guardarMetricaManual, obtenerPecPencMes,
  obtenerConfig, guardarConfig, borrarMetricasAsesor,
  archivarHistorico, obtenerHistorico, obtenerMesesHistorico,
  type FilaHistoricoBono,
} from "@/lib/bono-store";
import {
  AREAS_ORDEN,
  LABELS,
  type Area,
  type CampoDesempeno,
  type FuncionarioDesempeno,
  type DesempenoFiltros,
  type FilaTabla,
  type DashboardDesempeno,
  type ResultadoCierre,
} from "@/lib/desempeno-tipos";

export {
  AREAS_ORDEN,
  LABELS,
  type Area,
  type CampoDesempeno,
  type FuncionarioDesempeno,
  type DesempenoFiltros,
  type FilaTabla,
  type DashboardDesempeno,
  type ResultadoCierre,
};

// ============================================================
// DESEMPEÑO — lee la hoja "TO" (mes en curso) y guarda cierres
// mensuales manuales en "Historico_Desempeno" para poder ver meses
// anteriores y calcular tendencias reales. Sheets es la fuente de
// verdad (PEC/PENC/Bono ya calculados); aquí no se recalcula nada.
// ============================================================

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

const TAB_TO = "TO";
const TAB_HISTORICO = "Historico_Desempeno";

// La pestaña TO del libro de métricas está CALCULADA con fórmulas propias
// (porcentajes, bono, etc.). La app NO debe escribir VALORES en ella o las borra.
// Este interruptor deja la sincronización de valores y la edición manual
// desactivadas. (El reinicio inteligente y avanzar el mes activo SÍ se permiten:
// no pisan fórmulas.)
const APP_ESCRIBE_TO = false;

// Celda "mes activo" (desplegable MES_ACTIVO) de la hoja Base. TODO lo automático
// (PEC/PENC de auditorías, radicados, SNC, PQRSF) filtra por ella. Avanzarla al
// mes siguiente hace que todo se recalcule solo para el mes nuevo.
const CELDA_MES_ACTIVO = "Base!G1";
const MESES_NOMBRE = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

async function leerMesActivo(): Promise<string> {
  try {
    const v = await readRange(sheetId(), CELDA_MES_ACTIVO);
    return String(v?.[0]?.[0] ?? "").trim();
  } catch {
    return "";
  }
}

// Índice 0-based del nombre de mes ("Septiembre" → 8); -1 si no coincide.
function indiceMesNombre(nombre: string): number {
  const n = norm(nombre);
  return MESES_NOMBRE.findIndex((m) => norm(m) === n);
}

function siguienteMesNombre(nombre: string): string {
  const i = indiceMesNombre(nombre);
  return i < 0 ? nombre : MESES_NOMBRE[(i + 1) % 12];
}

// Nombre de mes activo → "YYYY-MM" para el histórico. El año se infiere: si el mes
// es posterior al calendario actual, es del año pasado (se cierran meses pasados).
function mesActivoAYM(nombre: string): string {
  const i = indiceMesNombre(nombre);
  if (i < 0) return mesActualBogota();
  const mesNum = i + 1;
  const [y, mCal] = mesActualBogota().split("-").map(Number);
  const year = mesNum <= mCal ? y : y - 1;
  return `${year}-${String(mesNum).padStart(2, "0")}`;
}

// Mes activo del bono (NATIVO, independiente del Excel): config "mes_activo" o,
// por defecto, el mes calendario actual. Aquí se cuentan PQRSF/radicados/SNC,
// auditorías y métricas manuales.
const CFG_MES_ACTIVO = "mes_activo";
async function mesActivoBonoKey(): Promise<string> {
  const cfg = await obtenerConfig(CFG_MES_ACTIVO);
  return /^\d{4}-\d{2}$/.test(cfg ?? "") ? (cfg as string) : mesActualBogota();
}
function mesSiguienteKey(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function encabezadoACampo(h: string): CampoDesempeno | null {
  const n = norm(h);
  if (n === "usuario") return "usuario";
  if (n === "funcionaria" || n === "funcionario") return "funcionario";
  if (n === "area") return "area";
  if (n === "fecha") return "fecha";
  if (n === "satisfaccion") return "satisfaccion";
  if (n.includes("calidad de la llamada")) return "calidadLlamada";
  if (n === "pec") return "pec";
  if (n === "penc") return "penc";
  if (n.startsWith("productividad")) return "productividad";
  if (n === "adherencia") return "adherencia";
  if (n.includes("bono")) return "bono";
  if (n.includes("pqrsf creados")) return "pqrsfCreados";
  if (n.includes("pqrsf devueltos")) return "pqrsfDevueltos";
  if (n.includes("cantidad auditorias")) return "auditorias";
  if (n.includes("precision ortografica")) return "precision";
  if (n.includes("error de respuesta")) return "errorRespuesta";
  if (n === "radicados") return "radicadosPct";
  if (n === "snc") return "snc";
  if (n.includes("snc recibidos")) return "sncRecibidos";
  if (n.includes("cantidad radicados")) return "cantidadRadicados";
  if (n.includes("por correccion")) return "correccion";
  if (n.includes("snc solucionados")) return "sncSolucionados";
  return null;
}

function detectarArea(campos: Set<CampoDesempeno>, valoresArea: string[]): Area | null {
  for (const v of valoresArea) {
    const n = norm(v);
    if (n.includes("cofrem")) return "G. Empleo Cofrem";
    if (n.includes("linea amiga") || n === "chat") return "Línea amiga / Chat";
    if (n.includes("encuesta")) return "Encuestas";
    if (n.includes("radicacion")) return "Radicación";
    if (n.includes("g. empleo") || n.includes("empleo")) return "G. Empleo";
  }
  if (campos.has("radicadosPct") || campos.has("sncRecibidos") || campos.has("cantidadRadicados")) return "Radicación";
  if (campos.has("calidadLlamada") || campos.has("errorRespuesta")) return "Encuestas";
  if (campos.has("pqrsfCreados") || campos.has("pqrsfDevueltos")) return "Línea amiga / Chat";
  return null;
}

interface BloqueTO {
  area: Area | null;
  campos: CampoDesempeno[];
  funcionarios: FuncionarioDesempeno[];
}

async function leerBloquesTO(): Promise<{ bloques: BloqueTO[]; desconocidos: number }> {
  const data = await readRange(sheetId(), `${TAB_TO}!A:Z`);
  const bloques: BloqueTO[] = [];
  let desconocidos = 0;
  let i = 0;
  while (i < data.length) {
    const fila = data[i] ?? [];
    if (norm(fila[0]) !== "usuario") {
      i++;
      continue;
    }
    const mapaCol: { idx: number; campo: CampoDesempeno }[] = [];
    fila.forEach((h, idx) => {
      const campo = encabezadoACampo(String(h));
      if (campo) mapaCol.push({ idx, campo });
    });
    const campos = mapaCol.map((m) => m.campo);

    const funcionariosRaw: { usuario: string; funcionario: string; fecha: string; area: string; valores: Partial<Record<CampoDesempeno, string>> }[] = [];
    let j = i + 1;
    for (; j < data.length; j++) {
      const r = data[j] ?? [];
      if (norm(r[0]) === "usuario") break;
      const usuario = String(r[0] ?? "").trim();
      if (!usuario) continue;
      const valores: Partial<Record<CampoDesempeno, string>> = {};
      for (const { idx, campo } of mapaCol) {
        const val = String(r[idx] ?? "").trim();
        if (val) valores[campo] = val;
      }
      funcionariosRaw.push({ usuario, funcionario: valores.funcionario ?? usuario, fecha: valores.fecha ?? "", area: valores.area ?? "", valores });
    }

    const area = detectarArea(new Set(campos), funcionariosRaw.map((f) => f.area));
    if (!area) desconocidos++;

    bloques.push({
      area,
      campos,
      funcionarios: area
        ? funcionariosRaw.map((f) => ({ usuario: f.usuario, funcionario: f.funcionario, area, fecha: f.fecha, valores: f.valores }))
        : [],
    });
    i = j;
  }
  return { bloques, desconocidos };
}

/* ── Parsers ── */
function parsePct(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace("%", "").replace(",", ".").trim());
  return isNaN(n) ? null : n;
}
function parseMoney(v: string | undefined): number | null {
  if (!v) return null;
  const limpio = v.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = parseInt(limpio, 10);
  return isNaN(n) ? null : n;
}
function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("es-CO");
}
const MESES_ES =["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function mesLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const nombre = MESES_ES[parseInt(m[2], 10) - 1] ?? m[2];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${m[1]}`;
}
function mesActualBogota(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(new Date());
  return p.slice(0, 7);
}
function hoyBogotaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const INDICADORES_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["satisfaccion", "pec", "penc", "productividad", "adherencia"],
  "G. Empleo": ["satisfaccion", "pec", "penc", "productividad", "adherencia"],
  "Encuestas": ["calidadLlamada", "pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta"],
  "Radicación": ["productividad", "radicadosPct", "snc", "precision", "adherencia"],
  "G. Empleo Cofrem": ["pec", "penc"],
};
const COLUMNAS_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["satisfaccion", "pec", "penc", "productividad", "adherencia", "bono", "pqrsfCreados", "pqrsfDevueltos", "auditorias"],
  "G. Empleo": ["satisfaccion", "pec", "penc", "productividad", "adherencia", "bono"],
  "Encuestas": ["calidadLlamada", "pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta", "bono"],
  "Radicación": ["productividad", "radicadosPct", "snc", "precision", "adherencia", "bono", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados"],
  "G. Empleo Cofrem": ["pec", "penc", "auditorias"],
};

function promedioPct(funcs: FuncionarioDesempeno[], campo: CampoDesempeno): number | null {
  const nums = funcs.map((f) => parsePct(f.valores[campo])).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/* ── Histórico NATIVO (Supabase) ── */
// Reconstruye la lista de funcionarios de un mes cerrado desde bono_historico.
async function funcsDeHistoricoNativo(mes: string): Promise<FuncionarioDesempeno[]> {
  const hist = await obtenerHistorico(mes);
  return hist.map((h) => ({
    usuario: h.asesor,
    funcionario: h.nombre,
    area: h.area as Area,
    fecha: mes,
    valores: h.datos as Partial<Record<CampoDesempeno, string>>,
  }));
}

/* ── Agregación común (sirve para vivo o histórico) ── */
function agregar(funcs: FuncionarioDesempeno[]) {
  const total = funcs.length;
  const penc = funcs.filter((f) => parsePct(f.valores.penc) !== null && parsePct(f.valores.penc)! > 0).length;
  const pec = promedioPct(funcs, "pec");
  const pencProm = promedioPct(funcs, "penc");
  const bonos = funcs.reduce((s, f) => s + (parseMoney(f.valores.bono) ?? 0), 0);
  return { total, penc, pec, pencProm, bonos };
}

export async function obtenerDashboardDesempeno(filtros: DesempenoFiltros = {}): Promise<DashboardDesempeno> {
  const fArea = (filtros.area ?? "").trim();
  const fMes = (filtros.mes ?? "").trim();
  const fBusqueda = norm(filtros.busqueda ?? "");

  // Histórico NATIVO (Supabase): meses cerrados y sus funcionarios.
  const mesesHist = await obtenerMesesHistorico();
  const histPorMes = new Map<string, FuncionarioDesempeno[]>();
  for (const m of mesesHist) histPorMes.set(m, await funcsDeHistoricoNativo(m));

  // Mes activo del bono (nativo; por defecto el mes calendario actual).
  const mesKeyActivo = await mesActivoBonoKey();
  const mmActivo = parseInt(mesKeyActivo.split("-")[1] ?? "0", 10);
  const mesActivoNombre = MESES_NOMBRE[mmActivo - 1] ?? "";

  // Fuente: mes cerrado (histórico) o mes en curso (vivo).
  const esHistorico = fMes !== "" && mesesHist.includes(fMes);
  let todos: FuncionarioDesempeno[];
  let desconocidos = 0;
  if (esHistorico) {
    todos = histPorMes.get(fMes) ?? [];
  } else {
    const bloques = await leerBloquesTO();
    desconocidos = bloques.desconocidos;
    todos = [];
    for (const b of bloques.bloques) if (b.area) todos.push(...b.funcionarios);
    // Dedupe por código: algunas (como Joselyn) aparecen en 2 bloques del Excel;
    // en la plataforma debe salir una sola vez (sus reglas son por código).
    const vistosCodigo = new Set<string>();
    todos = todos.filter((f) => {
      const k = f.usuario.trim().toUpperCase();
      if (!k || vistosCodigo.has(k)) return false;
      vistosCodigo.add(k);
      return true;
    });
    // AUTO desde los módulos: PQRSF creados (Línea amiga) y radicados/SNC
    // (Radicaciones), por mes, cruzados por nombre. Luego lo capturado en la
    // plataforma (Supabase) MANDA sobre el auto. El bono se calcula NATIVO.
    const [manual, pqrsf, rad, audit] = await Promise.all([
      obtenerMetricasManual(mesKeyActivo),
      obtenerPqrsfPorAgenteMes(mesKeyActivo).catch(() => new Map<string, number>()),
      obtenerMetricasRadicacionMes(mesKeyActivo).catch(() => new Map<string, MetricasRadMes>()),
      obtenerPecPencMes(mesKeyActivo),
    ]);
    for (const f of todos) {
      // El Excel SOLO aporta el roster (usuario/funcionaria/área). Los valores de
      // métricas se calculan 100% nativo: ignoramos lo que traiga la hoja TO para
      // no sumar datos viejos del Excel al bono.
      f.valores = {};
      // PEC/PENC desde las auditorías (Supabase), por código de asesor.
      // PEC = % conformes; PENC = promedio de la nota.
      const pp = audit.get(f.usuario.trim().toUpperCase());
      if (pp) {
        f.valores.pec = `${pp.pec}%`;
        f.valores.penc = `${pp.penc}%`;
        f.valores.auditorias = String(pp.auditorias);
      }
      // Conteo de PQRSF (Línea amiga / Chat)
      const pq = matchNombre(f.funcionario, pqrsf);
      if (pq !== null) f.valores.pqrsfCreados = String(pq);
      // Radicación: conteos + %. SNC% = (radicados − SNC) / radicados;
      // RADICADOS% = (radicados − devueltos por error) / radicados.
      const r = matchNombre(f.funcionario, rad);
      if (r) {
        f.valores.cantidadRadicados = String(r.radicados);
        f.valores.sncRecibidos = String(r.sncRecibidos);
        f.valores.sncSolucionados = String(r.sncSolucionados);
        f.valores.correccion = String(r.correccion);
        if (r.radicados > 0) {
          f.valores.snc = `${Math.round((1 - r.sncRecibidos / r.radicados) * 1000) / 10}%`;
          f.valores.radicadosPct = `${Math.round((1 - r.devueltos / r.radicados) * 1000) / 10}%`;
        }
      }
      // Capturado en la plataforma MANDA sobre el auto.
      for (const campo of camposEditablesDe(f.area, f.usuario)) {
        const v = manual.get(`${f.usuario}||${campo}`);
        if (v !== undefined && v !== "") f.valores[campo] = v;
      }
      f.valores.bono = String(calcularBono(f.area, f.valores, f.usuario).total);
    }
  }

  const filtrados = todos.filter((f) => {
    if (fArea && f.area !== fArea) return false;
    if (fBusqueda && !norm(f.funcionario).includes(fBusqueda) && !norm(f.usuario).includes(fBusqueda)) return false;
    return true;
  });

  const agg = agregar(filtrados);

  // Indicadores por área.
  const areaSel: Area | null = (AREAS_ORDEN as readonly string[]).includes(fArea) ? (fArea as Area) : null;
  const camposInd = areaSel ? INDICADORES_POR_AREA[areaSel] : (["pec", "penc", "productividad", "adherencia"] as CampoDesempeno[]);
  const indicadores = camposInd.map((c) => ({ nombre: LABELS[c], pct: promedioPct(filtrados, c) ?? 0 }));

  // Ranking por bono desc.
  const ranking = [...filtrados]
    .sort((a, b) => (parseMoney(b.valores.bono) ?? 0) - (parseMoney(a.valores.bono) ?? 0))
    .slice(0, 5)
    .map((f) => ({ funcionario: f.funcionario, pec: f.valores.pec ?? "—", penc: f.valores.penc ?? "—", bono: f.valores.bono ?? "—" }));

  // Bonificación por área.
  const montoPorArea = new Map<string, number>();
  for (const f of filtrados) montoPorArea.set(f.area, (montoPorArea.get(f.area) ?? 0) + (parseMoney(f.valores.bono) ?? 0));
  const porArea = Array.from(montoPorArea.entries())
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([area, monto]) => ({ area, monto, montoLabel: fmtMoney(monto), pct: agg.bonos > 0 ? Math.round((monto / agg.bonos) * 1000) / 10 : 0 }));

  // Tabla con columnas dinámicas.
  const columnas = areaSel ? COLUMNAS_POR_AREA[areaSel] : (["pec", "penc", "productividad", "adherencia", "bono"] as CampoDesempeno[]);
  const filas: FilaTabla[] = filtrados.map((f) => ({ usuario: f.usuario, funcionario: f.funcionario, area: f.area, valores: f.valores }));

  // ── Serie mensual (para tendencias y sparklines) ──
  // Agregados de cada mes cerrado (filtrados por área) + punto vivo si es "en curso".
  const serie: { mes: string; funcs: number; pec: number; penc: number; bonos: number }[] = [];
  for (const mes of mesesHist) {
    const fh = (histPorMes.get(mes) ?? []).filter((f) => !fArea || f.area === fArea);
    if (fh.length === 0) continue;
    const a = agregar(fh);
    serie.push({ mes, funcs: a.total, pec: a.pec ?? 0, penc: a.pencProm ?? 0, bonos: a.bonos });
  }
  // Si estamos viendo el mes en curso, agregamos el punto vivo al final.
  const mesVivo = mesActualBogota();
  if (!esHistorico && !mesesHist.includes(mesVivo)) {
    serie.push({ mes: mesVivo, funcs: agg.total, pec: agg.pec ?? 0, penc: agg.pencProm ?? 0, bonos: agg.bonos });
  }
  // Si vemos un mes histórico puntual, recortamos la serie hasta ese mes.
  const serieVista = esHistorico ? serie.filter((p) => p.mes <= fMes) : serie;

  const deltaPts = (arr: number[]) => (arr.length < 2 ? null : Math.round((arr[arr.length - 1] - arr[arr.length - 2]) * 10) / 10);
  const deltaPct = (arr: number[]) => {
    if (arr.length < 2) return null;
    const prev = arr[arr.length - 2];
    if (prev === 0) return null;
    return Math.round(((arr[arr.length - 1] - prev) / prev) * 1000) / 10;
  };
  const sf = serieVista.map((p) => p.funcs);
  const sp = serieVista.map((p) => p.pec);
  const sn = serieVista.map((p) => p.penc);
  const sb = serieVista.map((p) => p.bonos);
  const hayHistorico = serieVista.length >= 2;

  // Opciones del selector de mes.
  const mesesDisponibles = [
    { value: "", label: "Mes en curso" },
    ...mesesHist.slice().reverse().map((m) => ({ value: m, label: mesLabel(m) })),
  ];

  // Mes al que pasaría al cerrar.
  const mesActivoSiguiente = MESES_NOMBRE[mmActivo % 12] ?? "";

  return {
    kpi: {
      funcionariosActivos: agg.total,
      pecPromedio: agg.pec,
      pencPromedio: agg.pencProm,
      bonosGenerados: agg.bonos,
      bonosGeneradosLabel: fmtMoney(agg.bonos),
      tendencia: { funcionarios: deltaPct(sf), pec: deltaPts(sp), penc: deltaPts(sn), bonos: deltaPct(sb) },
      sparklines: { funcionarios: sf.slice(-8), pec: sp.slice(-8), penc: sn.slice(-8), bonos: sb.slice(-8) },
      hayHistorico,
    },
    indicadores,
    ranking,
    bonificacion: { total: agg.bonos, totalLabel: fmtMoney(agg.bonos), porArea },
    tabla: { columnas, filas },
    areasDisponibles: AREAS_ORDEN.filter((a) => todos.some((f) => f.area === a)),
    labels: LABELS,
    bloquesDesconocidos: desconocidos,
    esHistorico,
    mesActualLabel: esHistorico ? mesLabel(fMes) : "Mes en curso",
    mesesDisponibles,
    mesActivoNombre,
    mesActivoSiguiente,
  };
}

/* ===================== */
/* CERRAR MES (snapshot manual) */
/* ===================== */

// Cierra el MES ACTIVO (nativo): archiva el snapshot del mes a Supabase
// (bono_historico, consultable) y AVANZA el mes activo al siguiente. El mes nuevo
// arranca con las manuales vacías; lo automático se recalcula solo. No toca Excel.
export async function cerrarMes(): Promise<ResultadoCierre> {
  const mes = await mesActivoBonoKey();
  // Snapshot de lo que muestra el módulo (computado) → histórico nativo.
  const dash = await obtenerDashboardDesempeno({});
  const filas: FilaHistoricoBono[] = dash.tabla.filas.map((f) => ({
    mes,
    asesor: f.usuario,
    nombre: f.funcionario,
    area: f.area,
    datos: Object.fromEntries(Object.entries(f.valores).map(([k, v]) => [k, String(v ?? "")])),
  }));
  const guardados = await archivarHistorico(filas);
  // Avanza el mes activo nativo.
  await guardarConfig(CFG_MES_ACTIVO, mesSiguienteKey(mes));
  return { mes, mesLabel: mesLabel(mes), guardados, actualizados: 0 };
}

// Borra las métricas manuales de un asesor (limpiar datos de prueba / reiniciar).
export async function borrarMetricasDesempeno(usuario: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await borrarMetricasAsesor(usuario);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar" };
  }
}

/* ===================== */
/* EDICIÓN DE MÉTRICAS (panel Bonos) — escribe en TO, mes en curso */
/* ===================== */

function colLetter(idx: number): string {
  let n = idx + 1;
  let out = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export interface ResultadoGuardarMetricas {
  ok: boolean;
  error?: string;
  guardados?: number;
}

// Guarda las métricas MANUALES de un asesor en Du Site (Supabase), para el mes
// activo. Solo se guardan las métricas manuales del área (satisfacción,
// productividad, adherencia, precisión…); las automáticas (PEC/PENC/conteos) las
// calcula la plataforma y no se tocan. NO escribe en el Excel.
export async function guardarMetricasDesempeno(
  usuario: string,
  area: Area,
  cambios: Partial<Record<CampoDesempeno, string>>
): Promise<ResultadoGuardarMetricas> {
  const mesKey = await mesActivoBonoKey();
  // Se puede capturar CUALQUIER métrica del funcionario (cada asesora es distinta;
  // algunas 100% manuales; Joselyn tiene su set especial). Lo guardado manda.
  const validos = new Set(camposEditablesDe(area, usuario));
  const entradas = Object.entries(cambios) as [CampoDesempeno, string][];
  let guardados = 0;
  try {
    for (const [campo, valor] of entradas) {
      if (!validos.has(campo)) continue; // no se guardan identidad/bono
      await guardarMetricaManual(mesKey, usuario, campo, (valor ?? "").trim());
      guardados++;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
  return { ok: true, guardados };
}

/* ===================== */
/* AUTOMÁTICAS — PEC/PENC/#auditorías desde Consolidado (mes en curso) */
/* ===================== */
// Consolidado: col C(2)=asesor (código), col Q(16)=nota "%", col R(17)=Tipo Nota (OK/PENC).
const CONS_COL_ASESOR = 2;
const CONS_COL_NOTA = 16;
const CONS_COL_TIPO = 17;


function fechaConsolidadoAMes(valor: unknown): string | null {
  const d = parseSheetDate(valor);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface AutoMetrica { pec: string; penc: string; auditorias: string }

// Calcula, por código de asesor, las automáticas del mes dado desde Consolidado.
// PEC = promedio de la Nota%. PENC = % de auditorías conformes (Tipo Nota = OK).
async function calcularAutomaticasConsolidado(mesYM: string): Promise<Map<string, AutoMetrica>> {
  const data = await readRange(sheetId(), "Consolidado!A:R", { unformatted: true });
  const acc = new Map<string, { suma: number; n: number; ok: number }>();
  for (let i = 1; i < data.length; i++) {
    const r = data[i] ?? [];
    if (fechaConsolidadoAMes(r[0]) !== mesYM) continue;
    const code = String(r[CONS_COL_ASESOR] ?? "").trim().toUpperCase();
    if (!code) continue;
    const nota = parseFloat(String(r[CONS_COL_NOTA] ?? "").replace("%", "").replace(",", ".")) || 0;
    const esOK = String(r[CONS_COL_TIPO] ?? "").trim().toUpperCase() === "OK";
    const a = acc.get(code) ?? { suma: 0, n: 0, ok: 0 };
    a.suma += nota; a.n += 1; if (esOK) a.ok += 1;
    acc.set(code, a);
  }
  const out = new Map<string, AutoMetrica>();
  for (const [code, a] of acc) {
    const pec = a.n > 0 ? Math.round((a.suma / a.n) * 10) / 10 : 0;
    const penc = a.n > 0 ? Math.round((a.ok / a.n) * 1000) / 10 : 0;
    out.set(code, { pec: `${pec}%`, penc: `${penc}%`, auditorias: String(a.n) });
  }
  return out;
}

function tokensNombre(s: string): string[] {
  return norm(s).split(/\s+/).filter(Boolean);
}

// Cruza un nombre COMPLETO de TO (p. ej. "Joselyn del Carmen Mendoza Jiménez")
// con un mapa cuyas claves son nombres CORTOS (p. ej. "Joselyn Mendoza"): mismo
// primer nombre y todos los tokens del corto contenidos en el completo. Si dos
// claves distintas calzan, se considera ambiguo y no asigna. Sirve para cualquier
// módulo (Radicación, PQRSF…).
function matchNombre<T>(nombreTO: string, mapa: Map<string, T>): T | null {
  const full = tokensNombre(nombreTO);
  if (full.length === 0) return null;
  const fullSet = new Set(full);
  let encontrado: T | null = null;
  let ambiguo = false;
  for (const [key, val] of mapa) {
    const kt = tokensNombre(key);
    if (kt.length === 0 || kt[0] !== full[0]) continue; // mismo primer nombre
    if (!kt.every((t) => fullSet.has(t))) continue; // apellidos del corto ⊆ completo
    if (encontrado !== null && encontrado !== val) ambiguo = true;
    encontrado = val;
  }
  return ambiguo ? null : encontrado;
}

export interface ResultadoSincronizar { ok: boolean; actualizados: number; mesLabel: string }

// Trae las automáticas del MES EN CURSO y las escribe en TO (solo las celdas que
// cambian). PEC/PENC/#auditorías salen de las auditorías (Consolidado), cruzadas
// por CÓDIGO de asesor; los conteos de Radicación (radicados, SNC recibidas,
// solucionadas y en corrección) salen del módulo de Radicaciones, cruzados por
// NOMBRE de la funcionaria. El bono de la hoja se recalcula solo.
export async function sincronizarAutomaticas(): Promise<ResultadoSincronizar> {
  // DESACTIVADO: la hoja TO se calcula con fórmulas propias. Escribir valores
  // aquí las sobrescribía. Mientras se rehace el enfoque, la app solo LEE.
  if (!APP_ESCRIBE_TO) return { ok: true, actualizados: 0, mesLabel: mesLabel(mesActualBogota()) };

  const id = sheetId();
  const mes = mesActualBogota();
  const auto = await calcularAutomaticasConsolidado(mes);
  let rad: Map<string, MetricasRadMes> = new Map();
  try {
    rad = await obtenerMetricasRadicacionMes(mes);
  } catch {
    rad = new Map(); // si falla Radicaciones, igual sincroniza lo del Consolidado
  }
  if (auto.size === 0 && rad.size === 0) return { ok: true, actualizados: 0, mesLabel: mesLabel(mes) };

  // Leemos TO una sola vez y recorremos bloque por bloque.
  const data = await readRange(sheetId(), `${TAB_TO}!A:Z`);
  let mapaCol = new Map<CampoDesempeno, number>();
  let actualizados = 0;
  const camposCons: (keyof AutoMetrica)[] = ["pec", "penc", "auditorias"];
  const camposRad: { campo: CampoDesempeno; key: keyof MetricasRadMes }[] = [
    { campo: "cantidadRadicados", key: "radicados" },
    { campo: "sncRecibidos", key: "sncRecibidos" },
    { campo: "sncSolucionados", key: "sncSolucionados" },
    { campo: "correccion", key: "correccion" },
  ];

  const escribir = async (idx: number | undefined, fila: unknown[], filaReal: number, nuevo: string) => {
    if (idx === undefined) return;
    if (String(fila[idx] ?? "").trim() === nuevo) return; // sin cambios → no escribir
    await updateRange(id, `${TAB_TO}!${colLetter(idx)}${filaReal}`, [[nuevo]]);
    actualizados++;
  };

  for (let i = 0; i < data.length; i++) {
    const fila = data[i] ?? [];
    if (norm(fila[0]) === "usuario") {
      mapaCol = new Map<CampoDesempeno, number>();
      fila.forEach((h, idx) => {
        const c = encabezadoACampo(String(h));
        if (c) mapaCol.set(c, idx);
      });
      continue;
    }
    if (!String(fila[0] ?? "").trim() || mapaCol.size === 0) continue;

    // Auditorías (Consolidado) por código de asesor.
    const vals = auto.get(String(fila[0]).trim().toUpperCase());
    if (vals) for (const campo of camposCons) await escribir(mapaCol.get(campo as CampoDesempeno), fila, i + 1, vals[campo]);

    // Radicación: cruza por nombre de funcionaria (TO usa nombre completo,
    // Radicaciones nombre corto). Solo escribe en bloques con esas columnas.
    const idxNombre = mapaCol.get("funcionario");
    const nombre = idxNombre !== undefined ? String(fila[idxNombre] ?? "").trim() : "";
    const r = nombre ? matchNombre(nombre, rad) : null;
    if (r) for (const { campo, key } of camposRad) await escribir(mapaCol.get(campo), fila, i + 1, String(r[key]));
  }
  return { ok: true, actualizados, mesLabel: mesLabel(mes) };
}

// Limpia TODOS los valores de métricas en TO (reset del mes) para empezar el
// siguiente en 0, incluidos los bonos. Preserva la identidad (usuario,
// funcionaria, área, fecha) y NUNCA destruye una fórmula: las celdas con fórmula
// (empiezan con "=") se dejan intactas y recalculan solas a 0 al vaciar sus
// insumos; solo se vacían las celdas con valor fijo. Se lee con render FORMULA
// para distinguir una de otra.
async function reiniciarMetricasTO(): Promise<void> {
  const id = sheetId();
  const data = await readRange(sheetId(), `${TAB_TO}!A:Z`, { formula: true });
  const SOLO_IDENTIDAD = new Set<CampoDesempeno>(["usuario", "funcionario", "area", "fecha"]);
  const esFormula = (v: unknown) => typeof v === "string" && v.trim().startsWith("=");

  let mapaCol = new Map<CampoDesempeno, number>();
  let filas: number[] = []; // filas de datos (1-based) del bloque actual

  const limpiarBloque = async () => {
    if (filas.length === 0 || mapaCol.size === 0) return;
    const inicio = filas[0];
    const fin = filas[filas.length - 1];
    for (const [campo, idx] of mapaCol) {
      if (SOLO_IDENTIDAD.has(campo)) continue;
      // Marca qué celdas de la columna son valores fijos (vaciables) vs fórmulas.
      const vaciables = filas.filter((f) => !esFormula((data[f - 1] ?? [])[idx]) && String((data[f - 1] ?? [])[idx] ?? "").trim() !== "");
      if (vaciables.length === 0) continue; // todas fórmula o vacías → no tocar
      const col = colLetter(idx);
      // Caso común: ninguna fórmula en la columna → un solo write del rango.
      const hayFormula = filas.some((f) => esFormula((data[f - 1] ?? [])[idx]));
      if (!hayFormula) {
        const vacios = Array.from({ length: fin - inicio + 1 }, () => [""]);
        await updateRange(id, `${TAB_TO}!${col}${inicio}:${col}${fin}`, vacios);
      } else {
        // Columna mixta: vacía celda por celda solo los valores fijos.
        for (const f of vaciables) await updateRange(id, `${TAB_TO}!${col}${f}`, [[""]]);
      }
    }
  };

  for (let i = 0; i < data.length; i++) {
    const fila = data[i] ?? [];
    if (norm(fila[0]) === "usuario") {
      await limpiarBloque();
      mapaCol = new Map<CampoDesempeno, number>();
      fila.forEach((h, idx) => { const c = encabezadoACampo(String(h)); if (c) mapaCol.set(c, idx); });
      filas = [];
      continue;
    }
    if (String(fila[0] ?? "").trim()) filas.push(i + 1);
  }
  await limpiarBloque();
}
