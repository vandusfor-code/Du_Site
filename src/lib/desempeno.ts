import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja } from "@/lib/sheets";
import {
  AREAS_ORDEN,
  LABELS,
  type Area,
  type CampoDesempeno,
  type FuncionarioDesempeno,
  type DesempenoFiltros,
  type FilaTabla,
  type DashboardDesempeno,
  type ResultadoSnapshot,
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
  type ResultadoSnapshot,
};

// ============================================================
// DESEMPEÑO — lee la hoja "TO" (mismo spreadsheet que Consolidado).
// La hoja tiene BLOQUES apilados por área, cada uno con su fila de
// encabezado (col A = "Usuario") y columnas distintas. La detección es
// dinámica: no se hardcodean rangos ni filas.
// Sheets es la fuente de verdad (PEC, PENC, Bono Ganado ya calculados);
// aquí solo se consume, organiza, filtra y visualiza. No se recalculan
// reglas de negocio.
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

// Mapea el texto de un encabezado a un campo canónico.
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

// Determina el área canónica de un bloque a partir del valor del campo Área
// de sus filas y, como respaldo, de la firma de columnas presentes.
function detectarArea(campos: Set<CampoDesempeno>, valoresArea: string[]): Area | null {
  for (const v of valoresArea) {
    const n = norm(v);
    if (n.includes("cofrem")) return "G. Empleo Cofrem";
    if (n.includes("linea amiga") || n === "chat") return "Línea amiga / Chat";
    if (n.includes("encuesta")) return "Encuestas";
    if (n.includes("radicacion")) return "Radicación";
    if (n.includes("g. empleo") || n.includes("empleo")) return "G. Empleo";
  }
  // Respaldo por firma de columnas.
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

// Parsea toda la hoja TO en bloques por área.
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
    // Fila de encabezado → nuevo bloque.
    const mapaCol: { idx: number; campo: CampoDesempeno }[] = [];
    fila.forEach((h, idx) => {
      const campo = encabezadoACampo(String(h));
      if (campo) mapaCol.push({ idx, campo });
    });
    const campos = mapaCol.map((m) => m.campo);

    // Filas de datos hasta el próximo encabezado.
    const funcionariosRaw: { usuario: string; funcionario: string; fecha: string; area: string; valores: Partial<Record<CampoDesempeno, string>> }[] = [];
    let j = i + 1;
    for (; j < data.length; j++) {
      const r = data[j] ?? [];
      if (norm(r[0]) === "usuario") break; // siguiente bloque
      const usuario = String(r[0] ?? "").trim();
      if (!usuario) continue; // fila vacía → ignorar
      const valores: Partial<Record<CampoDesempeno, string>> = {};
      for (const { idx, campo } of mapaCol) {
        const val = String(r[idx] ?? "").trim();
        if (val) valores[campo] = val;
      }
      funcionariosRaw.push({
        usuario,
        funcionario: valores.funcionario ?? usuario,
        fecha: valores.fecha ?? "",
        area: valores.area ?? "",
        valores,
      });
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

/* ── Parsers numéricos (respetan vacío/No aplica → null) ── */
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

/* ── Indicadores a promediar por área (campo → etiqueta) ── */
const INDICADORES_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["pec", "penc", "productividad", "adherencia"],
  "G. Empleo": ["pec", "penc", "productividad", "adherencia"],
  "Encuestas": ["pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta"],
  "Radicación": ["productividad", "radicadosPct", "snc", "precision", "adherencia"],
  "G. Empleo Cofrem": ["pec", "penc"],
};

/* ── Columnas de tabla por área (además de #, Funcionario, Área) ── */
const COLUMNAS_POR_AREA: Record<Area, CampoDesempeno[]> = {
  "Línea amiga / Chat": ["pec", "penc", "productividad", "adherencia", "bono", "pqrsfCreados", "pqrsfDevueltos", "auditorias"],
  "G. Empleo": ["pec", "penc", "productividad", "adherencia", "bono"],
  "Encuestas": ["pec", "penc", "productividad", "adherencia", "precision", "errorRespuesta", "bono"],
  "Radicación": ["pec", "penc", "productividad", "radicadosPct", "snc", "precision", "adherencia", "bono", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados"],
  "G. Empleo Cofrem": ["pec", "penc", "auditorias"],
};

// Promedio de un campo (porcentaje) sobre un conjunto de funcionarios,
// ignorando vacíos / "No aplica" (no los cuenta como 0).
function promedioPct(funcs: FuncionarioDesempeno[], campo: CampoDesempeno): number | null {
  const nums = funcs.map((f) => parsePct(f.valores[campo])).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

export async function obtenerDashboardDesempeno(filtros: DesempenoFiltros = {}): Promise<DashboardDesempeno> {
  const { bloques, desconocidos } = await leerBloquesTO();

  const todos: FuncionarioDesempeno[] = [];
  for (const b of bloques) if (b.area) todos.push(...b.funcionarios);

  const fArea = (filtros.area ?? "").trim();
  const fBusqueda = norm(filtros.busqueda ?? "");

  const filtrados = todos.filter((f) => {
    if (fArea && f.area !== fArea) return false;
    if (fBusqueda && !norm(f.funcionario).includes(fBusqueda) && !norm(f.usuario).includes(fBusqueda)) return false;
    return true;
  });

  // ── KPIs ──
  const funcionariosActivos = filtrados.length;
  const pecPromedio = promedioPct(filtrados, "pec");
  const pencPromedio = promedioPct(filtrados, "penc");
  const bonosGenerados = filtrados.reduce((s, f) => s + (parseMoney(f.valores.bono) ?? 0), 0);

  // ── Indicadores por área (promedios reales) ──
  const areaParaIndicadores: Area | null = (AREAS_ORDEN as readonly string[]).includes(fArea) ? (fArea as Area) : null;
  let indicadores: { nombre: string; pct: number }[];
  if (areaParaIndicadores) {
    indicadores = INDICADORES_POR_AREA[areaParaIndicadores]
      .map((campo) => ({ nombre: LABELS[campo], pct: promedioPct(filtrados, campo) ?? 0 }));
  } else {
    // "Todos": indicadores comunes.
    indicadores = (["pec", "penc", "productividad", "adherencia"] as CampoDesempeno[])
      .map((campo) => ({ nombre: LABELS[campo], pct: promedioPct(filtrados, campo) ?? 0 }));
  }

  // ── Ranking: por bono descendente (real) ──
  const ranking = [...filtrados]
    .sort((a, b) => (parseMoney(b.valores.bono) ?? 0) - (parseMoney(a.valores.bono) ?? 0))
    .slice(0, 5)
    .map((f) => ({
      funcionario: f.funcionario,
      pec: f.valores.pec ?? "—",
      penc: f.valores.penc ?? "—",
      bono: f.valores.bono ?? "—",
    }));

  // ── Bonificación por área ──
  const montoPorArea = new Map<string, number>();
  for (const f of filtrados) {
    const m = parseMoney(f.valores.bono) ?? 0;
    montoPorArea.set(f.area, (montoPorArea.get(f.area) ?? 0) + m);
  }
  const porArea = Array.from(montoPorArea.entries())
    .filter(([, monto]) => monto > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([area, monto]) => ({
      area,
      monto,
      montoLabel: fmtMoney(monto),
      pct: bonosGenerados > 0 ? Math.round((monto / bonosGenerados) * 1000) / 10 : 0,
    }));

  // ── Tabla: columnas dinámicas según área seleccionada ──
  let columnas: CampoDesempeno[];
  if (areaParaIndicadores) {
    columnas = COLUMNAS_POR_AREA[areaParaIndicadores];
  } else {
    columnas = ["pec", "penc", "productividad", "adherencia", "bono"];
  }
  const filas: FilaTabla[] = filtrados.map((f) => ({
    usuario: f.usuario,
    funcionario: f.funcionario,
    area: f.area,
    valores: f.valores,
  }));

  // ── Histórico (tendencias + sparklines) ──
  const hist = await leerHistorico(fArea);

  return {
    kpi: {
      funcionariosActivos,
      pecPromedio,
      pencPromedio,
      bonosGenerados,
      bonosGeneradosLabel: fmtMoney(bonosGenerados),
      tendencia: hist.tendencia,
      sparklines: hist.sparklines,
      hayHistorico: hist.hayHistorico,
    },
    indicadores,
    ranking,
    bonificacion: {
      total: bonosGenerados,
      totalLabel: fmtMoney(bonosGenerados),
      porArea,
    },
    tabla: { columnas, filas },
    areasDisponibles: AREAS_ORDEN.filter((a) => todos.some((f) => f.area === a)),
    labels: LABELS,
    bloquesDesconocidos: desconocidos,
  };
}

/* ===================== */
/* HISTÓRICO (SNAPSHOTS) */
/* ===================== */

const HISTORICO_HEADERS = [
  "fecha", "usuario", "funcionario", "area",
  "pec", "penc", "productividad", "adherencia", "bono", "auditorias",
  "pqrsfCreados", "pqrsfDevueltos", "precision", "errorRespuesta",
  "radicadosPct", "snc", "sncRecibidos", "cantidadRadicados", "correccion", "sncSolucionados",
  "satisfaccion", "calidadLlamada",
];
const HIST_CAMPOS = HISTORICO_HEADERS.slice(4) as CampoDesempeno[];

function hoyBogotaISO(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // YYYY-MM-DD
}

// Lee el histórico y arma tendencias + sparklines para los filtros dados.
async function leerHistorico(fArea: string): Promise<{
  tendencia: DashboardDesempeno["kpi"]["tendencia"];
  sparklines: DashboardDesempeno["kpi"]["sparklines"];
  hayHistorico: boolean;
}> {
  const vacio = {
    tendencia: { funcionarios: null, pec: null, penc: null, bonos: null },
    sparklines: { funcionarios: [], pec: [], penc: [], bonos: [] },
    hayHistorico: false,
  };
  let data: unknown[][];
  try {
    data = await readRange(sheetId(), `${TAB_HISTORICO}!A:V`);
  } catch {
    return vacio;
  }
  if (data.length < 2) return vacio;

  const idx = Object.fromEntries(HISTORICO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
  // Agrupar por fecha (aplicando filtro de área).
  const porFecha = new Map<string, { funcs: number; pec: number[]; penc: number[]; bonos: number }>();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const area = String(r[idx.area] ?? "").trim();
    if (fArea && area !== fArea) continue;
    const fecha = String(r[idx.fecha] ?? "").trim();
    if (!fecha) continue;
    if (!porFecha.has(fecha)) porFecha.set(fecha, { funcs: 0, pec: [], penc: [], bonos: 0 });
    const g = porFecha.get(fecha)!;
    g.funcs++;
    const pec = parsePct(String(r[idx.pec] ?? ""));
    const penc = parsePct(String(r[idx.penc] ?? ""));
    if (pec !== null) g.pec.push(pec);
    if (penc !== null) g.penc.push(penc);
    g.bonos += parseMoney(String(r[idx.bono] ?? "")) ?? 0;
  }
  const fechas = Array.from(porFecha.keys()).sort();
  if (fechas.length < 2) return { ...vacio, hayHistorico: false };

  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10 : 0);
  const serieFuncs = fechas.map((f) => porFecha.get(f)!.funcs);
  const seriePec = fechas.map((f) => avg(porFecha.get(f)!.pec));
  const seriePenc = fechas.map((f) => avg(porFecha.get(f)!.penc));
  const serieBonos = fechas.map((f) => porFecha.get(f)!.bonos);

  const deltaPts = (s: number[]) => (s.length < 2 ? null : Math.round((s[s.length - 1] - s[s.length - 2]) * 10) / 10);
  const deltaPct = (s: number[]) => {
    if (s.length < 2) return null;
    const prev = s[s.length - 2];
    if (prev === 0) return null;
    return Math.round(((s[s.length - 1] - prev) / prev) * 1000) / 10;
  };

  return {
    tendencia: {
      funcionarios: deltaPct(serieFuncs),
      pec: deltaPts(seriePec),
      penc: deltaPts(seriePenc),
      bonos: deltaPct(serieBonos),
    },
    sparklines: {
      funcionarios: serieFuncs.slice(-8),
      pec: seriePec.slice(-8),
      penc: seriePenc.slice(-8),
      bonos: serieBonos.slice(-8),
    },
    hayHistorico: true,
  };
}

// Guarda/actualiza el snapshot de HOY (upsert por fecha+usuario+área).
// No duplica filas: si ya existe la clave para hoy, la actualiza.
export async function guardarSnapshotDesempeno(): Promise<ResultadoSnapshot> {
  const id = sheetId();
  await asegurarHoja(id, TAB_HISTORICO, HISTORICO_HEADERS);

  const { bloques } = await leerBloquesTO();
  const funcs: FuncionarioDesempeno[] = [];
  for (const b of bloques) if (b.area) funcs.push(...b.funcionarios);

  const fecha = hoyBogotaISO();
  const existentes = await readRange(id, `${TAB_HISTORICO}!A:V`);
  const idx = Object.fromEntries(HISTORICO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

  const mapaFila = new Map<string, number>(); // clave → fila (1-based)
  for (let i = 1; i < existentes.length; i++) {
    const r = existentes[i];
    const clave = `${String(r[idx.fecha] ?? "").trim()}||${String(r[idx.usuario] ?? "").trim()}||${String(r[idx.area] ?? "").trim()}`;
    mapaFila.set(clave, i + 1);
  }

  const filaDe = (f: FuncionarioDesempeno): (string | number)[] => [
    fecha, f.usuario, f.funcionario, f.area,
    ...HIST_CAMPOS.map((c) => f.valores[c] ?? ""),
  ];

  const nuevas: (string | number)[][] = [];
  const updates: { fila: number; valores: (string | number)[] }[] = [];
  for (const f of funcs) {
    const clave = `${fecha}||${f.usuario}||${f.area}`;
    if (mapaFila.has(clave)) updates.push({ fila: mapaFila.get(clave)!, valores: filaDe(f) });
    else nuevas.push(filaDe(f));
  }

  for (const u of updates) {
    await updateRange(id, `${TAB_HISTORICO}!A${u.fila}:V${u.fila}`, [u.valores]);
  }
  if (nuevas.length > 0) await appendRows(id, `${TAB_HISTORICO}!A:V`, nuevas);

  return { fecha, guardados: nuevas.length, actualizados: updates.length };
}

// Guarda el snapshot de hoy solo si aún no existe ninguna fila de hoy.
// Pensado para llamarse automáticamente al abrir el módulo (1 vez/día).
export async function asegurarSnapshotDeHoy(): Promise<void> {
  const id = sheetId();
  try {
    const existentes = await readRange(id, `${TAB_HISTORICO}!A:D`);
    const hoy = hoyBogotaISO();
    const yaHay = existentes.slice(1).some((r) => String(r[0] ?? "").trim() === hoy);
    if (yaHay) return;
  } catch {
    // La hoja no existe todavía; guardarSnapshotDesempeno la crea.
  }
  await guardarSnapshotDesempeno();
}
