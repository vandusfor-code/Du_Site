import "server-only";

// ============================================================
// Parser de archivos PQRSF. La plataforma entrega archivos con extensión
// .xls que internamente son una TABLA HTML (no un XLS binario). Este parser
// detecta el formato real y extrae filas/columnas. Preparado para ampliar a
// .xlsx real más adelante.
// ============================================================

export interface ArchivoParseado {
  headers: string[];
  filas: Record<string, string>[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // quita tags internos (spans, etc.)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á").replace(/&Ntilde;/gi, "Ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .trim();
}

function esHtml(contenido: string): boolean {
  const inicio = contenido.slice(0, 2000).toLowerCase();
  return inicio.includes("<html") || inicio.includes("<table") || inicio.includes("<!doctype html");
}

// Extrae la primera tabla HTML del contenido.
function parseHtmlTabla(html: string): ArchivoParseado {
  const trBloques = html.split(/<tr[^>]*>/i).slice(1).map((b) => b.split(/<\/tr>/i)[0]);

  const filasCeldas: string[][] = [];
  const headers: string[] = [];

  for (const tr of trBloques) {
    const ths = [...tr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => decodeEntities(m[1]));
    if (ths.length > 0 && headers.length === 0) {
      headers.push(...ths);
      continue;
    }
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => decodeEntities(m[1]));
    if (tds.length > 0) filasCeldas.push(tds);
  }

  const filas: Record<string, string>[] = filasCeldas
    .filter((c) => c.some((v) => v.trim() !== ""))
    .map((celdas) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = celdas[i] ?? ""; });
      return obj;
    });

  return { headers, filas };
}

/**
 * Parsea el contenido de un archivo PQRSF. Actualmente soporta el .xls-HTML
 * real de la plataforma. Si detecta un binario (xlsx/xls real), lanza un error
 * claro (aún no soportado en esta fase).
 */
export function parseArchivoPqrsf(contenido: string): ArchivoParseado {
  // Un .xlsx real empieza con "PK" (ZIP); un .xls binario con 0xD0CF11E0.
  const magic = contenido.slice(0, 8);
  if (magic.startsWith("PK") || magic.includes("��")) {
    throw new Error(
      "El archivo parece ser un Excel binario (.xlsx/.xls real). Descarga el archivo directamente desde la plataforma de PQRSF (formato .xls compatible)."
    );
  }
  if (!esHtml(contenido)) {
    throw new Error("No se reconoció el formato del archivo. Debe ser el .xls que exporta la plataforma de PQRSF.");
  }
  const parseado = parseHtmlTabla(contenido);
  if (parseado.headers.length === 0) {
    throw new Error("El archivo no contiene una tabla con encabezados válidos.");
  }
  return parseado;
}
