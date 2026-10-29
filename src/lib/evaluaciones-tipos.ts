// ============================================================
// Evaluaciones (quizzes) — tipos + lógica PURA (cliente-segura).
//
// Sin "server-only" ni red. Interpreta las preguntas pegadas desde Excel/Sheets
// (formato real: ID · Pregunta · Opción A · B · C · D · Respuesta Correcta ·
// Explicación, separadas por TAB al copiar) y califica. Se prueba con
// `node --test`. Sintaxis erasable-only (sin enums/namespaces).
// ============================================================

export type Letra = "A" | "B" | "C" | "D";
export const LETRAS: Letra[] = ["A", "B", "C", "D"];

export interface OpcionPregunta {
  letra: Letra;
  texto: string;
}

export interface PreguntaEval {
  id: string;
  pregunta: string;
  opciones: OpcionPregunta[];
  correcta: Letra;
  explicacion: string;
}

export interface ResultadoParseoPreguntas {
  preguntas: PreguntaEval[];
  errores: string[]; // bloquean el guardado
  advertencias: string[]; // informativas
}

// Normaliza la celda "Respuesta Correcta": acepta "B", "b", "B.", "Opción B".
function normalizarCorrecta(valor: string): Letra | null {
  const m = (valor ?? "").trim().toUpperCase().match(/^(?:OPCI[OÓ]N\s*)?([A-D])\.?$/);
  return m ? (m[1] as Letra) : null;
}

function esFilaEncabezado(celdas: string[]): boolean {
  const a = (celdas[0] ?? "").trim().toLowerCase();
  const b = (celdas[1] ?? "").trim().toLowerCase();
  return a === "id" || b === "pregunta" || b === "preguntas";
}

/**
 * Interpreta el texto pegado (filas separadas por salto de línea; columnas por
 * TAB). Devuelve las preguntas válidas + errores/advertencias por fila.
 */
export function parsearPreguntasTSV(texto: string): ResultadoParseoPreguntas {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const preguntas: PreguntaEval[] = [];
  const idsVistos = new Set<string>();

  const lineas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");

  lineas.forEach((linea, i) => {
    const nFila = i + 1;
    if (linea.trim() === "") return; // fila vacía: se ignora

    const celdas = linea.split("\t").map((c) => c.trim());

    // Debe venir separado por TAB (copiar/pegar desde Sheets/Excel).
    if (celdas.length < 2) {
      errores.push(`Fila ${nFila}: no se detectaron columnas. Copia y pega las filas desde tu hoja (se separan por tabulación).`);
      return;
    }
    if (esFilaEncabezado(celdas)) return; // encabezado: se omite

    const pregunta = (celdas[1] ?? "").trim();
    if (!pregunta) {
      errores.push(`Fila ${nFila}: falta el texto de la pregunta.`);
      return;
    }

    const textos = [celdas[2] ?? "", celdas[3] ?? "", celdas[4] ?? "", celdas[5] ?? ""];
    const opciones: OpcionPregunta[] = [];
    LETRAS.forEach((letra, idx) => {
      const t = (textos[idx] ?? "").trim();
      if (t) opciones.push({ letra, texto: t });
    });
    if (opciones.length < 2) {
      errores.push(`Fila ${nFila}: necesita al menos 2 opciones con texto.`);
      return;
    }

    const correcta = normalizarCorrecta(celdas[6] ?? "");
    if (!correcta) {
      errores.push(`Fila ${nFila}: la respuesta correcta debe ser A, B, C o D (dice "${celdas[6] ?? ""}").`);
      return;
    }
    if (!opciones.some((o) => o.letra === correcta)) {
      errores.push(`Fila ${nFila}: la respuesta correcta es ${correcta} pero esa opción está vacía.`);
      return;
    }

    let id = (celdas[0] ?? "").trim() || `P${preguntas.length + 1}`;
    if (idsVistos.has(id)) {
      advertencias.push(`Fila ${nFila}: el ID "${id}" estaba repetido; se renombró.`);
      id = `${id}_${preguntas.length + 1}`;
    }
    idsVistos.add(id);

    preguntas.push({
      id,
      pregunta,
      opciones,
      correcta,
      explicacion: (celdas[7] ?? "").trim(),
    });
  });

  if (preguntas.length === 0 && errores.length === 0) {
    errores.push("No se detectaron preguntas. Copia las filas desde tu hoja (Pregunta, opciones, respuesta correcta).");
  }

  return { preguntas, errores, advertencias };
}

// ── Calificación (regla oficial portada del Apps Script: aprueba si el
// porcentaje ≥ umbral). Pura. ──
export interface ResultadoCalificacion {
  aciertos: number;
  total: number;
  porcentaje: number;
  resultado: "APROBADO" | "NO APROBADO";
  falladas: number[]; // números (1-based) de preguntas falladas o sin responder
}

export function calificar(
  preguntas: { correcta: Letra }[],
  respuestas: Record<number, Letra | "">, // por número de pregunta (1-based)
  umbral: number
): ResultadoCalificacion {
  let aciertos = 0;
  const falladas: number[] = [];
  preguntas.forEach((p, idx) => {
    const num = idx + 1;
    const r = respuestas[num];
    if (r && r === p.correcta) aciertos++;
    else falladas.push(num);
  });
  const total = preguntas.length;
  const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  return {
    aciertos,
    total,
    porcentaje,
    resultado: porcentaje >= umbral ? "APROBADO" : "NO APROBADO",
    falladas,
  };
}
