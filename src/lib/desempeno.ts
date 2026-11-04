import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja, parseSheetDate } from "@/lib/sheets";
import { obtenerMetricasRadicacionMes, type MetricasRadMes } from "@/lib/radicaciones";
import {
  AREAS_ORDEN,
  LABELS,
  esCampoAutomatico,
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
  "Línea amiga / Chat": ["pec", "penc", "productividad", "adherencia"],
  "G. Empleo": ["pec", "penc", "productividad", "adherencia"],
  "Encuestas": ["pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta"],
  "Radicación": ["productividad", "radicadosPct", "snc", "precision", "adherencia"],
  "G. Empleo Cofrem": ["pec", "penc"],
};
const COLUMNAS_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["pec", "penc", "productividad", "adherencia", "bono", "pqrsfCreados", "pqrsfDevueltos", "auditorias"],
  "G. Empleo": ["pec", "penc", "productividad", "adherencia", "bono"],
  "Encuestas": ["pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta", "bono"],
  "Radicación": ["pec", "penc", "productividad", "radicadosPct", "snc", "precision", "adherencia", "bono", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados"],
  "G. Empleo Cofrem": ["pec", "penc", "auditorias"],
};

function promedioPct(funcs: FuncionarioDesempeno[], campo: CampoDesempeno): number | null {
  const nums = funcs.map((f) => parsePct(f.valores[campo])).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/* ── Histórico: headers y helpers ── */
const HISTORICO_HEADERS = [
  "mes", "usuario", "funcionario", "area",
  "pec", "penc", "productividad", "adherencia", "bono", "auditorias",
  "pqrsfCreados", "pqrsfDevueltos", "precision", "errorRespuesta",
  "radicadosPct", "snc", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados",
  "satisfaccion", "calidadLlamada", "cerrado_el",
];
const HIST_CAMPOS = HISTORICO_HEADERS.slice(4, 22) as CampoDesempeno[];
const HIST_LAST_COL = "W"; // 23 columnas → A:W

async function leerHistorico(): Promise<unknown[][]> {
  try {
    return await readRange(sheetId(), `${TAB_HISTORICO}!A:${HIST_LAST_COL}`);
  } catch {
    return [];
  }
}

// Reconstruye la lista de funcionarios de un mes cerrado desde el histórico.
function funcsDeHistorico(data: unknown[][], mes: string): FuncionarioDesempeno[] {
  if (data.length < 2) return [];
  const idx = Object.fromEntries(HISTORICO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
  const out: FuncionarioDesempeno[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (String(r[idx.mes] ?? "").trim() !== mes) continue;
    const area = String(r[idx.area] ?? "").trim() as Area;
    const valores: Partial<Record<CampoDesempeno, string>> = {};
    for (const c of HIST_CAMPOS) {
      const v = String(r[idx[c]] ?? "").trim();
      if (v) valores[c] = v;
    }
    out.push({ usuario: String(r[idx.usuario] ?? "").trim(), funcionario: String(r[idx.funcionario] ?? "").trim(), area, fecha: mes, valores });
  }
  return out;
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

  const histData = await leerHistorico();
  const mesesHist = Array.from(new Set(histData.slice(1).map((r) => String(r[0] ?? "").trim()).filter(Boolean))).sort();

  // Fuente: mes cerrado (histórico) o mes en curso (TO vivo).
  const esHistorico = fMes !== "" && mesesHist.includes(fMes);
  let todos: FuncionarioDesempeno[];
  let desconocidos = 0;
  if (esHistorico) {
    todos = funcsDeHistorico(histData, fMes);
  } else {
    const bloques = await leerBloquesTO();
    desconocidos = bloques.desconocidos;
    todos = [];
    for (const b of bloques.bloques) if (b.area) todos.push(...b.funcionarios);
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
    const fh = funcsDeHistorico(histData, mes).filter((f) => !fArea || f.area === fArea);
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
  };
}

/* ===================== */
/* CERRAR MES (snapshot manual) */
/* ===================== */

// Guarda/actualiza el cierre de un mes en el histórico (upsert por mes+usuario+área).
// El mes se toma de la columna Fecha de TO (lo que representan los datos); si no
// se puede determinar, usa el mes calendario actual.
export async function cerrarMes(mesObjetivo?: string): Promise<ResultadoCierre> {
  const id = sheetId();
  await asegurarHoja(id, TAB_HISTORICO, HISTORICO_HEADERS);

  const { bloques } = await leerBloquesTO();
  const funcs: FuncionarioDesempeno[] = [];
  for (const b of bloques) if (b.area) funcs.push(...b.funcionarios);

  // El mes que se cierra lo ELIGE el usuario (por defecto, el mes ANTERIOR: los
  // meses se cierran a inicios del siguiente — octubre se cierra en noviembre).
  const mes = /^\d{4}-\d{2}$/.test(mesObjetivo ?? "") ? (mesObjetivo as string) : mesAnteriorBogota();

  const existentes = await leerHistorico();
  const idx = Object.fromEntries(HISTORICO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
  const mapaFila = new Map<string, number>();
  for (let i = 1; i < existentes.length; i++) {
    const r = existentes[i];
    const clave = `${String(r[idx.mes] ?? "").trim()}||${String(r[idx.usuario] ?? "").trim()}||${String(r[idx.area] ?? "").trim()}`;
    mapaFila.set(clave, i + 1);
  }

  const hoy = hoyBogotaISO();
  const filaDe = (f: FuncionarioDesempeno): (string | number)[] => [
    mes, f.usuario, f.funcionario, f.area,
    ...HIST_CAMPOS.map((c) => f.valores[c] ?? ""),
    hoy,
  ];

  const nuevas: (string | number)[][] = [];
  const updates: { fila: number; valores: (string | number)[] }[] = [];
  for (const f of funcs) {
    const clave = `${mes}||${f.usuario}||${f.area}`;
    if (mapaFila.has(clave)) updates.push({ fila: mapaFila.get(clave)!, valores: filaDe(f) });
    else nuevas.push(filaDe(f));
  }
  for (const u of updates) {
    await updateRange(id, `${TAB_HISTORICO}!A${u.fila}:${HIST_LAST_COL}${u.fila}`, [u.valores]);
  }
  if (nuevas.length > 0) await appendRows(id, `${TAB_HISTORICO}!A:${HIST_LAST_COL}`, nuevas);

  // Reinicia las métricas del mes en curso (TO) para empezar el siguiente en 0.
  // Preserva identidad y la fórmula del bono.
  await reiniciarMetricasTO();

  return { mes, mesLabel: mesLabel(mes), guardados: nuevas.length, actualizados: updates.length };
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

// Localiza la fila (1-based, absoluta en la hoja) de un usuario en TO y el mapa
// campo→índice de columna de su bloque. null si no está.
async function localizarUsuarioTO(usuario: string): Promise<{ filaNum: number; mapaCol: Map<CampoDesempeno, number> } | null> {
  const data = await readRange(sheetId(), `${TAB_TO}!A:Z`);
  const uNorm = norm(usuario);
  let mapaCol = new Map<CampoDesempeno, number>();
  for (let i = 0; i < data.length; i++) {
    const fila = data[i] ?? [];
    if (norm(fila[0]) === "usuario") {
      // Nueva cabecera de bloque: reconstruye el mapa de columnas.
      mapaCol = new Map<CampoDesempeno, number>();
      fila.forEach((h, idx) => {
        const campo = encabezadoACampo(String(h));
        if (campo) mapaCol.set(campo, idx);
      });
      continue;
    }
    if (norm(fila[0]) === uNorm && mapaCol.size > 0) {
      return { filaNum: i + 1, mapaCol }; // i es 0-based en A:Z → fila real = i+1
    }
  }
  return null;
}

// Guarda cambios de métricas de un asesor en la hoja TO (mes en curso). El
// Coordinador no puede tocar los campos automáticos (PEC/PENC/conteos); el Admin sí.
export async function guardarMetricasDesempeno(
  usuario: string,
  cambios: Partial<Record<CampoDesempeno, string>>,
  puedeEditarAutomaticos: boolean
): Promise<ResultadoGuardarMetricas> {
  const id = sheetId();
  const loc = await localizarUsuarioTO(usuario);
  if (!loc) return { ok: false, error: "No se encontró al funcionario en la hoja del mes en curso." };

  const entradas = Object.entries(cambios) as [CampoDesempeno, string][];
  let guardados = 0;
  for (const [campo, valor] of entradas) {
    if (campo === "bono" || campo === "usuario" || campo === "funcionario" || campo === "area" || campo === "fecha") continue;
    if (esCampoAutomatico(campo) && !puedeEditarAutomaticos) continue; // el coordinador no toca automáticos
    const idx = loc.mapaCol.get(campo);
    if (idx === undefined) continue; // esa área no tiene esa columna
    const rango = `${TAB_TO}!${colLetter(idx)}${loc.filaNum}`;
    await updateRange(id, rango, [[valor ?? ""]]);
    guardados++;
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

function mesAnteriorBogota(): string {
  const [y, m] = mesActualBogota().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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

export interface ResultadoSincronizar { ok: boolean; actualizados: number; mesLabel: string }

// Trae las automáticas del MES EN CURSO y las escribe en TO (solo las celdas que
// cambian). PEC/PENC/#auditorías salen de las auditorías (Consolidado), cruzadas
// por CÓDIGO de asesor; los conteos de Radicación (radicados, SNC recibidas,
// solucionadas y en corrección) salen del módulo de Radicaciones, cruzados por
// NOMBRE de la funcionaria. El bono de la hoja se recalcula solo.
export async function sincronizarAutomaticas(): Promise<ResultadoSincronizar> {
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

    // Radicación por nombre de funcionaria (solo bloques con esas columnas).
    const idxNombre = mapaCol.get("funcionario");
    const nombre = idxNombre !== undefined ? String(fila[idxNombre] ?? "").trim() : "";
    const r = nombre ? rad.get(norm(nombre)) : undefined;
    if (r) for (const { campo, key } of camposRad) await escribir(mapaCol.get(campo), fila, i + 1, String(r[key]));
  }
  return { ok: true, actualizados, mesLabel: mesLabel(mes) };
}

// Limpia los valores de métricas en TO (reset del mes), preservando identidad y
// la fórmula del bono. Usado al cerrar un mes para empezar el siguiente en 0.
async function reiniciarMetricasTO(): Promise<void> {
  const id = sheetId();
  const data = await readRange(sheetId(), `${TAB_TO}!A:Z`);
  const NO_LIMPIAR = new Set<CampoDesempeno>(["usuario", "funcionario", "area", "fecha", "bono"]);
  let mapaCol = new Map<CampoDesempeno, number>();
  let filaInicio = -1;
  let filaFin = -1;

  const limpiarBloque = async () => {
    if (filaInicio === -1 || mapaCol.size === 0) return;
    for (const [campo, idx] of mapaCol) {
      if (NO_LIMPIAR.has(campo)) continue;
      const col = colLetter(idx);
      const vacios = Array.from({ length: filaFin - filaInicio + 1 }, () => [""]);
      await updateRange(id, `${TAB_TO}!${col}${filaInicio}:${col}${filaFin}`, vacios);
    }
  };

  for (let i = 0; i < data.length; i++) {
    const fila = data[i] ?? [];
    if (norm(fila[0]) === "usuario") {
      await limpiarBloque();
      mapaCol = new Map<CampoDesempeno, number>();
      fila.forEach((h, idx) => { const c = encabezadoACampo(String(h)); if (c) mapaCol.set(c, idx); });
      filaInicio = -1; filaFin = -1;
      continue;
    }
    if (String(fila[0] ?? "").trim()) {
      if (filaInicio === -1) filaInicio = i + 1;
      filaFin = i + 1;
    }
  }
  await limpiarBloque();
}
