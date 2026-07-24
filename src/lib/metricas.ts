import "server-only";
import { readRange, appendRow, parseSheetDate, formatSheetDate, formatDuration } from "@/lib/sheets";

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

const ASESORES_SIN_BONO = [
  "ANAMARIA.MAHECHA",
  "DEISY.ROMERO",
  "LISANDRO.GUTIERREZ",
  "PAULAISABEL.ABELLAESPINOSA",
  "FRANCY.HERNANDEZ",
  "CESAR.RIVAS",
  "MONICA.RUIZ",
];

export interface Metrica {
  label: string;
  value: string;
}

export interface AuditoriaTabla {
  fecha: string;
  mes: string;
  asesor: string;
  canal: string;
  tipoGestion: string;
  idGestion: string;
  evaluador: string;
  puntosMejora: string;
  grabacion: string;
}

export interface AuditoriaConEstado extends AuditoriaTabla {
  comprometido: boolean;
  comentario: string;
  fechaCompromiso: string;
}

export interface HistorialBonoItem {
  fecha: string;
  monto: number;
  estado: string;
}

export interface MetricasAsesor {
  asesor: string;
  area: string;
  metrics: Metrica[];
  tablaData: AuditoriaTabla[];
  bonoGanado: number;
  historialBono: HistorialBonoItem[];
  sinBono: boolean;
}

function fmtPct(val: unknown): string {
  if (typeof val === "number") return `${(val * 100).toFixed(1)}%`;
  if (typeof val === "string" && val.includes("%")) return val;
  return (val ?? 0).toString();
}

function parseBono(val: unknown): number {
  if (!val) return 0;
  const str = typeof val === "string" ? val.replace(/[^\d]/g, "") : String(val);
  return Number(str) || 0;
}

function cell(row: unknown[], idx: number): unknown {
  return row[idx] ?? 0;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

export async function obtenerMetricas(asesor: string): Promise<MetricasAsesor> {
  const id = sheetId();
  const asesorBuscado = (asesor || "").trim().toUpperCase();
  const sinBono = ASESORES_SIN_BONO.includes(asesorBuscado);

  const [dataTO, dataDesempeno, dataConsolidado] = await Promise.all([
    readRange(id, "TO!A2:P", { unformatted: true }),
    readRange(id, "Desempeño!A2:J", { unformatted: true }),
    readRange(id, "Consolidado!A2:W", { unformatted: true }),
  ]);

  let area = "";
  let bonoGanado = 0;
  const metrics: Metrica[] = [];

  const rowUser = dataTO.find(
    (row) => texto(row, 0).trim().toUpperCase() === asesorBuscado
  );
  const rowDesempeno = dataDesempeno.find(
    (row) => texto(row, 0).trim().toUpperCase() === asesorBuscado
  );

  if (rowUser) {
    area =
      texto(rowUser, 5).trim() === "G. Empleo Cofrem"
        ? "G. Empleo Cofrem"
        : texto(rowUser, 2).trim();

    if (area === "G. Empleo Cofrem") {
      metrics.push({ label: "PEC", value: fmtPct(cell(rowUser, 2)) });
      metrics.push({ label: "PENC", value: fmtPct(cell(rowUser, 3)) });
      metrics.push({ label: "Auditorías", value: String(cell(rowUser, 4)) });
      bonoGanado = 0;
    } else if (area === "Linea amiga - Caja" || area === "Chat") {
      metrics.push({ label: "Satisfacción", value: fmtPct(cell(rowUser, 4)) });
      metrics.push({ label: "PEC", value: fmtPct(cell(rowUser, 5)) });
      metrics.push({ label: "PENC", value: fmtPct(cell(rowUser, 6)) });
      metrics.push({ label: "Productividad", value: fmtPct(cell(rowUser, 7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(cell(rowUser, 8)) });
      metrics.push({ label: "PQRSF Creados", value: String(cell(rowUser, 10)) });
      metrics.push({ label: "PQRSF Devueltos", value: String(cell(rowUser, 11)) });
      metrics.push({ label: "Auditorías", value: String(cell(rowUser, 12)) });
      bonoGanado = sinBono ? 0 : parseBono(cell(rowUser, 9));
    } else if (area === "G. Empleo") {
      metrics.push({ label: "Satisfacción", value: fmtPct(cell(rowUser, 4)) });
      metrics.push({ label: "PEC", value: fmtPct(cell(rowUser, 5)) });
      metrics.push({ label: "PENC", value: fmtPct(cell(rowUser, 6)) });
      metrics.push({ label: "Productividad", value: fmtPct(cell(rowUser, 7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(cell(rowUser, 8)) });
      bonoGanado = sinBono ? 0 : parseBono(cell(rowUser, 9));
    } else if (area === "Encuestas") {
      metrics.push({ label: "Calidad de la llamada", value: fmtPct(cell(rowUser, 4)) });
      metrics.push({ label: "PEC", value: fmtPct(cell(rowUser, 5)) });
      metrics.push({ label: "PENC", value: fmtPct(cell(rowUser, 6)) });
      metrics.push({ label: "Productividad", value: fmtPct(cell(rowUser, 7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(cell(rowUser, 8)) });
      metrics.push({ label: "Precisión Ortográfica", value: fmtPct(cell(rowUser, 9)) });
      metrics.push({ label: "Error de Respuesta", value: String(cell(rowUser, 10)) });
      bonoGanado = sinBono ? 0 : parseBono(cell(rowUser, 11));
    } else if (area === "Radicacion") {
      metrics.push({ label: "Productividad", value: fmtPct(cell(rowUser, 4)) });
      metrics.push({ label: "Radicados", value: fmtPct(cell(rowUser, 5)) });
      metrics.push({ label: "SNC", value: fmtPct(cell(rowUser, 6)) });
      metrics.push({ label: "Precisión Ortográfica", value: fmtPct(cell(rowUser, 7)) });
      metrics.push({ label: "Adherencia", value: fmtPct(cell(rowUser, 8)) });
      metrics.push({ label: "SNC Recibidos", value: String(cell(rowUser, 10)) });
      metrics.push({ label: "Cant. Radicados", value: String(cell(rowUser, 11)) });
      metrics.push({ label: "Por Corrección", value: String(cell(rowUser, 12)) });
      metrics.push({ label: "SNC Solucionados", value: String(cell(rowUser, 13)) });
      bonoGanado = sinBono ? 0 : parseBono(cell(rowUser, 9));
    }

    if (rowDesempeno) {
      metrics.push({ label: "Gest.", value: String(cell(rowDesempeno, 2)) });
      metrics.push({ label: "% Ans Rate", value: fmtPct(cell(rowDesempeno, 3)) });
      metrics.push({ label: "ATT", value: formatDuration(rowDesempeno[4]) });
      metrics.push({ label: "Missed", value: String(cell(rowDesempeno, 5)) });
      metrics.push({ label: "Hold", value: formatDuration(rowDesempeno[6]) });
      metrics.push({ label: "ACW", value: formatDuration(rowDesempeno[7]) });
      metrics.push({ label: "AHT", value: formatDuration(rowDesempeno[8]) });
      metrics.push({ label: "Meta", value: texto(rowDesempeno, 9) || "N/A" });
    }
  }

  const tablaData = extraerAuditorias(dataConsolidado, asesorBuscado).slice(0, 10);
  const historialBono = sinBono ? [] : await obtenerHistorialBonos(asesorBuscado);

  return { asesor, area, metrics, tablaData, bonoGanado, historialBono, sinBono };
}

function extraerAuditorias(dataConsolidado: unknown[][], asesorBuscado: string): AuditoriaTabla[] {
  const conOrden = dataConsolidado
    .map((row) => {
      if (texto(row, 2).trim().toUpperCase() !== asesorBuscado) return null;
      const fechaDate = parseSheetDate(row[0]);
      const item: AuditoriaTabla = {
        fecha: formatSheetDate(row[0], "dd-MM-yyyy HH:mm"),
        mes: texto(row, 1),
        asesor: texto(row, 2),
        canal: texto(row, 3),
        tipoGestion: texto(row, 4),
        idGestion: texto(row, 6).trim(),
        evaluador: texto(row, 7),
        puntosMejora: texto(row, 20),
        grabacion: texto(row, 22).trim(),
      };
      return { item, orden: fechaDate ? fechaDate.getTime() : -1 };
    })
    .filter((x): x is { item: AuditoriaTabla; orden: number } => x !== null);

  conOrden.sort((a, b) => b.orden - a.orden);
  return conOrden.map((x) => x.item);
}

async function obtenerHistorialBonos(asesorBuscado: string): Promise<HistorialBonoItem[]> {
  try {
    const id = sheetId();
    const data = await readRange(id, "Historial_bonos!A2:D", { unformatted: true });
    return data
      .filter((row) => texto(row, 0).trim().toUpperCase() === asesorBuscado)
      .map((row) => ({
        fecha: formatSheetDate(row[1], "MMMM yyyy"),
        monto: parseBono(row[2]),
        estado: texto(row, 3),
      }));
  } catch {
    return [];
  }
}

function mesYAnioBogota(): { mes: number; anio: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const anio = Number(parts.find((p) => p.type === "year")?.value);
  const mes = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return { mes, anio };
}

export async function obtenerAuditoriasConEstado(asesor: string): Promise<AuditoriaConEstado[]> {
  try {
    const id = sheetId();
    const asesorBuscado = (asesor || "").trim().toUpperCase();

    const [dataConsolidado, dataCompromisos] = await Promise.all([
      readRange(id, "Consolidado!A2:W", { unformatted: true }),
      readRange(id, "Compromisos!A2:E", { unformatted: true }),
    ]);

    const mapaCompromisos = new Map<string, { comentario: string; fechaCompromiso: string }>();
    dataCompromisos.forEach((row) => {
      const asesorComp = texto(row, 0).trim().toUpperCase();
      const idGestion = texto(row, 1).trim();
      if (asesorComp === asesorBuscado && idGestion) {
        mapaCompromisos.set(idGestion, {
          comentario: texto(row, 3),
          fechaCompromiso: formatSheetDate(row[4], "dd-MM-yyyy HH:mm"),
        });
      }
    });

    const { mes: mesActual, anio: anioActual } = mesYAnioBogota();

    const conOrden = dataConsolidado
      .map((row) => {
        if (texto(row, 2).trim().toUpperCase() !== asesorBuscado) return null;
        const fechaDate = parseSheetDate(row[0]);
        if (!fechaDate) return null;
        if (fechaDate.getUTCMonth() !== mesActual || fechaDate.getUTCFullYear() !== anioActual) return null;

        const idGestion = texto(row, 6).trim();
        const comp = mapaCompromisos.get(idGestion);

        const item: AuditoriaConEstado = {
          fecha: formatSheetDate(row[0], "dd-MM-yyyy HH:mm"),
          mes: texto(row, 1),
          asesor: texto(row, 2),
          canal: texto(row, 3),
          tipoGestion: texto(row, 4),
          idGestion,
          evaluador: texto(row, 7),
          puntosMejora: texto(row, 20),
          grabacion: texto(row, 22).trim(),
          comprometido: !!comp,
          comentario: comp?.comentario ?? "",
          fechaCompromiso: comp?.fechaCompromiso ?? "",
        };
        return { item, orden: fechaDate.getTime() };
      })
      .filter((x): x is { item: AuditoriaConEstado; orden: number } => x !== null);

    conOrden.sort((a, b) => b.orden - a.orden);
    return conOrden.map((x) => x.item);
  } catch {
    return [];
  }
}

export async function obtenerConteoMesAnterior(asesor: string): Promise<number> {
  try {
    const id = sheetId();
    const asesorBuscado = (asesor || "").trim().toUpperCase();
    const dataConsolidado = await readRange(id, "Consolidado!A2:W", { unformatted: true });

    const { mes: mesActual, anio: anioActual } = mesYAnioBogota();
    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
    const anioAnterior = mesActual === 0 ? anioActual - 1 : anioActual;

    let total = 0;
    dataConsolidado.forEach((row) => {
      if (texto(row, 2).trim().toUpperCase() !== asesorBuscado) return;
      const fechaDate = parseSheetDate(row[0]);
      if (!fechaDate) return;
      if (fechaDate.getUTCMonth() !== mesAnterior || fechaDate.getUTCFullYear() !== anioAnterior) return;
      total++;
    });
    return total;
  } catch {
    return 0;
  }
}

export async function guardarCompromiso(
  asesor: string,
  idGestion: string,
  fechaAuditoria: string,
  comentario: string
): Promise<"OK" | "YA_EXISTE" | "ERROR"> {
  try {
    if (!asesor || !idGestion || !comentario) return "ERROR";
    const id = sheetId();
    const asesorUpper = asesor.trim().toUpperCase();
    const idGestionStr = idGestion.trim();

    const existentes = await readRange(id, "Compromisos!A2:B", { unformatted: true });
    const yaExiste = existentes.some(
      (row) =>
        texto(row, 0).trim().toUpperCase() === asesorUpper &&
        texto(row, 1).trim() === idGestionStr
    );
    if (yaExiste) return "YA_EXISTE";

    const fechaGuardado = new Date().toLocaleString("sv-SE", {
      timeZone: "America/Bogota",
    });

    await appendRow(id, "Compromisos!A:E", [
      asesor.trim(),
      idGestionStr,
      fechaAuditoria,
      comentario.trim(),
      fechaGuardado,
    ]);
    return "OK";
  } catch {
    return "ERROR";
  }
}

/* ===================== */
/* CRONOGRAMA */
/* ===================== */

export interface SesionCronograma {
  anio: number;
  mes: number;
  dia: number;
  horario: string;
  actividad: string;
  companero: string;
  link: string;
}

export async function obtenerCronograma(nombre: string): Promise<SesionCronograma[]> {
  const id = sheetId();
  const data = await readRange(id, "Cronograma!A2:G", { unformatted: true });
  const nNorm = nombre.trim().toLowerCase();
  const resultado: SesionCronograma[] = [];

  for (const row of data) {
    const agente1 = texto(row, 4).trim();
    const agente2 = texto(row, 5).trim();
    const esAgente1 = agente1.toLowerCase() === nNorm;
    const esAgente2 = agente2.toLowerCase() === nNorm;
    if (!esAgente1 && !esAgente2) continue;

    const fecha = parseSheetDate(row[0]);
    if (!fecha) continue;

    resultado.push({
      anio: fecha.getUTCFullYear(),
      mes: fecha.getUTCMonth(),
      dia: fecha.getUTCDate(),
      horario: texto(row, 2),
      actividad: texto(row, 3),
      companero: esAgente1 ? agente2 : agente1,
      link: texto(row, 6),
    });
  }

  return resultado;
}
