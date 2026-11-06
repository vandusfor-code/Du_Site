import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { NOVEDADES, type RegistroPila, type MetaTrabajador, type Novedad } from "./pila-tipos";

// ============================================================
// Parser del reporte "Histórico pagos por afiliado" (SSuRhipp / COFREM).
//
// Estrategia ROBUSTA (no depende de posiciones fijas): se extrae el texto del
// PDF y se interpreta LÍNEA por LÍNEA. Cada fila de aporte empieza por:
//   <NIT> <periodo AAAAMM> <fecha dd/mm/yyyy> <aporte> <salario> <díasCot> ...
// Esos 6 campos (los que usa el cálculo) salen limpios y separados. El resto de
// la línea (novedades Si/No, IBC, # planilla) se interpreta best-effort — las
// novedades NO afectan el cálculo, así que su mapeo exacto es secundario.
//
// Si el PDF no tiene texto seleccionable (escaneado), no se inventan registros:
// se devuelve sin filas y el motor marcará REQUIERE_REVISIÓN.
// ============================================================

export interface ResultadoParseo {
  meta: MetaTrabajador;
  registros: RegistroPila[];
  advertencias: string[];
  textoPlano: string;
}

// "6,200.00" -> 6200 · "1,254,674.00" -> 1254674 · "" -> null
function numero(s: string | undefined | null): number | null {
  if (!s) return null;
  const limpio = s.replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

// Una fila de aporte: NIT, periodo, fecha, aporte, salario, díasCot + resto.
const RE_FILA = /^(\d{5,})\s+(\d{6})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([\d.,]+)\s+([\d.,]+)\s+(\d+(?:\.\d+)?)\s+(.*)$/;

// Del "resto" de la fila: el IBC es un número con decimales (.dd); el # planilla
// es un entero largo sin decimales. Las novedades son la secuencia de Si/No.
function interpretarResto(resto: string): { ibc: number | null; planilla: string | null; novedadesSi: boolean[] } {
  // IBC: primer número con 2 decimales (puede venir pegado a un "No").
  const ibcMatch = resto.match(/(\d[\d.,]*\.\d{2})/);
  const ibc = ibcMatch ? numero(ibcMatch[1]) : null;
  // # planilla: entero largo (>=8 dígitos) sin decimales.
  const planillaMatch = resto.match(/\b(\d{8,})\b/);
  const planilla = planillaMatch ? planillaMatch[1] : null;
  // Novedades: secuencia de Si/No (best-effort, informativa).
  const flags = (resto.match(/\b(Si|No)\b/gi) ?? []).map((f) => f.toLowerCase() === "si");
  return { ibc, planilla, novedadesSi: flags };
}

function mapearNovedades(novedadesSi: boolean[]): Novedad[] {
  // Mapeo posicional best-effort contra el orden del encabezado. Las novedades
  // son informativas (no afectan el cálculo); el etiquetado es aproximado.
  const out: Novedad[] = [];
  NOVEDADES.forEach((nov, i) => {
    if (novedadesSi[i]) out.push(nov);
  });
  return out;
}

export async function parsearPdfPila(buffer: Uint8Array | ArrayBuffer): Promise<ResultadoParseo> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const advertencias: string[] = [];
  let textoPlano = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const res = await extractText(pdf, { mergePages: true });
    textoPlano = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } catch (e) {
    advertencias.push(`No se pudo leer el PDF: ${e instanceof Error ? e.message : "error"}`);
    return { meta: metaVacia(), registros: [], advertencias, textoPlano: "" };
  }

  if (!textoPlano || textoPlano.replace(/\s/g, "").length < 20) {
    advertencias.push("El PDF no contiene texto seleccionable (posible escaneo). Requiere revisión manual.");
    return { meta: metaVacia(), registros: [], advertencias, textoPlano };
  }

  const lineas = textoPlano.replace(/\r\n?/g, "\n").split("\n");
  const meta = metaVacia();
  const registros: RegistroPila[] = [];
  let fila = 0;

  for (const lineaRaw of lineas) {
    const linea = lineaRaw.trim();
    if (!linea) continue;

    // Metadatos del encabezado.
    const mGen = linea.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (mGen) meta.fechaGeneracion = mGen[1];
    const mPer = linea.match(/Periodo\s+Inicial:\s*(\d{6}).*Periodo\s+Final:\s*(\d{6})/i);
    if (mPer) { meta.periodoInicial = mPer[1]; meta.periodoFinal = mPer[2]; }
    // Línea del trabajador: <documento> <NOMBRE EN LETRAS>
    const mTrab = linea.match(/^(\d{6,12})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})$/);
    if (mTrab && !meta.documento) { meta.documento = mTrab[1]; meta.nombre = mTrab[2].replace(/\s+/g, " ").trim(); }

    // Fila de aporte.
    const m = linea.match(RE_FILA);
    if (!m) continue;
    const aporte = numero(m[4]);
    const diasCot = numero(m[6]);
    if (aporte === null || diasCot === null) continue;
    const { ibc, planilla, novedadesSi } = interpretarResto(m[7]);
    fila += 1;
    registros.push({
      fila,
      nit: m[1],
      periodo: m[2],
      fechaPago: m[3],
      aporte,
      salarioBasico: numero(m[5]),
      diasCot,
      ibc,
      planilla,
      novedades: mapearNovedades(novedadesSi),
      crudo: linea,
    });
  }

  if (registros.length === 0) {
    advertencias.push("No se detectaron registros de aporte en el documento. Verifica que sea el reporte 'Histórico pagos por afiliado'.");
  }
  return { meta, registros, advertencias, textoPlano };
}

function metaVacia(): MetaTrabajador {
  return { documento: null, nombre: null, periodoInicial: null, periodoFinal: null, fechaGeneracion: null };
}
