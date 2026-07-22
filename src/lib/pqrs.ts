import "server-only";
import { readRange, appendRow } from "@/lib/sheets";

function sheetId(): string {
  const id = process.env.SHEET_ID_PQRSF_DATA;
  if (!id) throw new Error("Falta la variable SHEET_ID_PQRSF_DATA");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

export type ModoBusqueda = "PQRSF" | "GENERAL";

export interface OpcionResultado {
  tipo: string;
  dirigido: string;
  clasificacion: string;
  accion: string;
  recordatorio: string;
  fuente: string;
  resumen_caso: string;
}

export interface ClasificacionResultado {
  options?: OpcionResultado[];
  error?: string;
}

// Búsqueda por palabras clave (todas deben aparecer) en una columna de una hoja.
async function buscarEnHoja(
  sheetName: string,
  columnIdx: number,
  query: string,
  limit = 8
): Promise<unknown[][]> {
  const id = sheetId();
  const data = await readRange(id, sheetName);
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (keywords.length === 0) return [];

  const results: unknown[][] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const content = texto(row, columnIdx).toLowerCase();
    if (!content) continue;
    if (keywords.every((kw) => content.indexOf(kw) !== -1)) {
      results.push(row);
    }
    if (results.length >= limit) break;
  }
  return results;
}

function extraerJson(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "");
  return JSON.parse(limpio);
}

export async function clasificarConIA(
  caso: string,
  mode: ModoBusqueda
): Promise<ClasificacionResultado> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "API Key no configurada" };

  const options: OpcionResultado[] = [];
  let contextEjemplos = "";

  if (mode === "PQRSF") {
    const [resultsData, resultsCasos] = await Promise.all([
      buscarEnHoja("DATA", 4, caso, 4),
      buscarEnHoja("CASOS", 0, caso, 4),
    ]);

    resultsData.forEach((r) => {
      options.push({
        tipo: texto(r, 1) || "SIN TIPO",
        dirigido: texto(r, 2) || "POR DEFINIR",
        clasificacion: "Hda. DATA (Previo)",
        accion: "Validar trámite con el área de " + (texto(r, 2) || "Subsidios"),
        recordatorio: "Este caso coincide con un radicado previo en DATA.",
        fuente: "Radicado #" + texto(r, 0),
        resumen_caso: texto(r, 4) || "Sin descripción disponible",
      });
    });

    resultsCasos.forEach((r) => {
      const aplicaPqrsf = texto(r, 2);
      options.push({
        tipo: texto(r, 3) || "PQRSF",
        dirigido: texto(r, 4) || "ÁREA INTERNA",
        clasificacion: "Guía CASOS",
        accion: texto(r, 1) || "Consultar manual de procesos",
        recordatorio: aplicaPqrsf
          ? `¿Aplica PQRSF?: ${aplicaPqrsf}`
          : "Seguir lineamientos de la hoja CASOS.",
        fuente: "Base CASOS",
        resumen_caso: texto(r, 0) || "Sin descripción",
      });
    });

    contextEjemplos = options
      .map(
        (o) =>
          `PQRSF: ${o.resumen_caso} -> Clasificación: ${o.tipo}, Dirigido: ${o.dirigido}, Acción: ${o.accion}`
      )
      .join("\n");
  } else {
    const resultsGeneral = await buscarEnHoja("GENERAL", 0, caso, 6);
    resultsGeneral.forEach((r) => {
      const queHacer = texto(r, 2);
      options.push({
        tipo: "RESPUESTA DIRECTA",
        dirigido: texto(r, 4) || "GENERAL",
        clasificacion: "CONOCIMIENTO ACADEMIA",
        accion: texto(r, 1) || "No hay una respuesta definida para este tema.",
        recordatorio: queHacer || "Basado estrictamente en la base GENERAL.",
        fuente: "Hoja GENERAL",
        resumen_caso: texto(r, 0) || "Tema de consulta",
      });
    });

    contextEjemplos = options
      .map((o) => `TEMA: ${o.resumen_caso} -> RESPUESTA: ${o.accion}`)
      .join("\n");
  }

  const prompt =
    mode === "PQRSF"
      ? `Eres un experto en clasificación de PQRSF de PEOPLE ACADEMY PRO.
   Analiza este caso: "${caso}"

   Usa el CONTEXTO para devolver un JSON con campos tipo, clasificacion, dirigido, accion, recordatorio.
   Responde ÚNICAMENTE con JSON basado en el contexto. Si no hay contexto útil, responde JSON con error.

   CONTEXTO:
   ${contextEjemplos || "No hay ejemplos directos."}`
      : `Eres el buscador inteligente de PEOPLE ACADEMY PRO.
   Responde a: "${caso}"

   IMPORTANTE: Da una respuesta directa clara y concisa basada SOLO en el contexto.
   Devuelve JSON con campos tipo (TEMA), clasificacion, dirigido, accion (LA RESPUESTA), recordatorio.

   CONTEXTO GENERAL:
   ${contextEjemplos || "Información no encontrada."}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Eres un asistente corporativo estricto que solo responde basándose en el contexto dado. Formato: JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    const json = await response.json();
    const contenido = json.choices?.[0]?.message?.content;
    if (!contenido) throw new Error("Respuesta de IA vacía");

    const aiResult = extraerJson(contenido) as OpcionResultado;
    aiResult.fuente = "Análisis IA (People Academy)";
    aiResult.resumen_caso = "Interpretación inteligente para: " + caso;

    options.unshift(aiResult);
    return { options };
  } catch {
    if (options.length > 0) return { options };
    return { error: "No se encontró información relacionada en nuestra base de datos." };
  }
}

export async function guardarRegistro(usuario: string, consulta: string): Promise<void> {
  const id = sheetId();
  const fecha = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" });
  await appendRow(id, "Registros!A:C", [fecha, usuario, consulta]);
}
