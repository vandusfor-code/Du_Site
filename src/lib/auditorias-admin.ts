import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja, parseSheetDate, hoyEnBogota } from "@/lib/sheets";
import { parseCsv } from "@/lib/csv-parse";

// ============================================================
// AUDITORÍA COFREM — puerto del Apps Script original a Next.js.
// Se ejecuta SOLO cuando el admin presiona el botón — nunca por cron/trigger.
// Conserva los mismos topes de seguridad que el script de Apps Script:
// máx. 50 transcripciones por corrida, 5 minutos, 2 intentos por transcripción.
// ============================================================

const BLOQUE_ESCRITURA = 10;
const MAX_INTENTOS = 2;
const TOPE_MAXIMO_POR_CORRIDA = 50;
const LIMITE_MS = 5 * 60 * 1000;

const MODELO_CRITERIOS = "claude-haiku-4-5";
const MODELO_TEXTOS = "claude-opus-4-8";

function sheetId(): string {
  const id = process.env.SHEET_ID_METRICAS;
  if (!id) throw new Error("Falta la variable SHEET_ID_METRICAS");
  return id;
}

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta la variable ANTHROPIC_API_KEY");
  return key;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function esFechaDeHoyBogota(valor: unknown): boolean {
  const fecha = parseSheetDate(valor);
  if (!fecha) return false;
  const hoy = hoyEnBogota();
  return fecha.getUTCDate() === hoy.dia && fecha.getUTCMonth() === hoy.mes && fecha.getUTCFullYear() === hoy.anio;
}

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
}

/* ===================== */
/* NORMALIZAR VALOR */
/* ===================== */

function normalizar(valor: unknown, tipo: "criterio" | "tuteo" | "tono"): string | null {
  if (!valor) return null;
  const v = String(valor).trim().toLowerCase();

  if (tipo === "criterio") {
    if (v.includes("no cumple") || v === "no" || v === "incumple") return "No cumple";
    if (v.includes("no aplica") || v === "n/a") return "No aplica";
    if (v.includes("cumple") || v === "sí" || v === "si" || v === "ok") return "Cumple";
    return null;
  }
  if (tipo === "tuteo") {
    if (v.includes("real") || v === "sí" || v === "si") return "Tuteo real";
    if (v.includes("leve")) return "Tuteo leve";
    if (v.includes("sin")) return "Sin tuteo";
    return "Sin tuteo";
  }
  if (tipo === "tono") {
    if (v.includes("alto") || v.includes("excelent")) return "Alto";
    if (v.includes("bajo") || v.includes("malo")) return "Bajo";
    return "Medio";
  }
  return String(valor);
}

/* ===================== */
/* LLAMAR A CLAUDE */
/* ===================== */

async function llamarClaude(prompt: string, modelo: string, maxTokens: number, intentos = 2): Promise<string | null> {
  const url = "https://api.anthropic.com/v1/messages";

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.status === 429) {
        const espera = Math.pow(2, intento) * 1000;
        await new Promise((r) => setTimeout(r, espera));
        continue;
      }

      const json = await response.json();

      if (!response.ok) {
        console.error(`Error HTTP ${response.status} en ${modelo}:`, json?.error?.message);
        return null;
      }

      if (json.content?.[0]?.text) return json.content[0].text;

      console.error("Respuesta inesperada de Claude:", JSON.stringify(json).slice(0, 300));
      return null;
    } catch (e) {
      console.error(`Fallo en intento ${intento} (${modelo}):`, e);
      if (intento < intentos) await new Promise((r) => setTimeout(r, Math.pow(2, intento) * 1000));
    }
  }
  return null;
}

function extraerJson<T>(texto: string): T | null {
  try {
    const clean = texto.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : clean) as T;
  } catch {
    return null;
  }
}

/* ===================== */
/* AUDITAR LLAMADA */
/* ===================== */

interface CriteriosIA {
  saludo: string;
  empatia: string;
  sonrisa: string;
  claridad: string;
  encuesta: string;
  informacion: string;
  proceso: string;
  cierre: string;
  puntaje_tuteo: string;
  tono_general: string;
  tipo_consulta: string;
}

interface TextosIA {
  observacion: string;
  hallazgos: string;
  mejora: string;
}

export interface ResultadoAuditoria {
  saludo: string; empatia: string; sonrisa: string; claridad: string;
  encuesta: string; info: string; proceso: string; cierre: string;
  observacion: string; hallazgos: string; mejora: string; tipoConsulta: string;
  puntajeTuteo: string; fechaProcesamiento: Date; tonoGeneral: string;
  nota: string; tipoNota: string;
}

function contextoPrompt(esChat: boolean): string {
  return `
REGLA FUNDAMENTAL: Solo evalúas lo que dice AGENTE. Ignora completamente lo que dice CLIENTE.
Si el CLIENTE tutea, usa "mami", o es informal — NO afecta al asesor.

CONTEXTO TRANSCRIPCIONES: El sistema de voz a texto (o transcripción de chat) distorsiona palabras.
"Cofrem" puede aparecer como Cofren, Cofre, Cofriend, Cofres, Cofret, Cofrend, o cualquier variación similar.
NUNCA penalices esto. NUNCA lo menciones como error del asesor. Es un problema del sistema, no del agente.
Nombres mal transcritos: evalúa por intención y contexto, no por ortografía exacta.

CANAL DE ESTA INTERACCIÓN: ${esChat ? "CHAT escrito" : "LLAMADA telefónica"}.
${
  esChat
    ? "- NO hables de 'tono de voz', 'sonrisa', 'volumen' — es chat escrito.\n- Habla de 'redacción', 'amabilidad en el mensaje', 'claridad en las respuestas escritas'.\n- El 'tono' aquí se refiere a cómo redacta el agente, no a su voz."
    : "- Habla de 'tono de voz', 'manejo de la llamada', 'cómo sonó el agente'.\n- Usa lenguaje de llamada telefónica."
}

DEFINICIÓN DE TUTEO (solo del AGENTE):
- Tuteo REAL = "tú", "te", "ti", "tu", "tuyo", "tuya" dirigidos al usuario.
- NO es tuteo: "usted", "su", "sus", "le", "les", "señora", "señor", "señorita", "su merced".

IMPORTANTE: Nunca uses "cliente", siempre "usuario".`;
}

async function auditarLlamada(
  transcripcionCompleta: string,
  idGestion: string,
  esChat: boolean,
  registrarError: (idGestion: string, motivo: string, respuestaCruda?: string) => Promise<void>
): Promise<ResultadoAuditoria | null> {
  const transcripcion = transcripcionCompleta.slice(0, 12000);
  const tipoInteraccion = esChat ? "chat" : "llamada";
  const contexto = contextoPrompt(esChat);

  const promptCriterios = `${contexto}

Eres un analista de calidad de Cofrem. Evalúa esta transcripción de ${tipoInteraccion}.

CRITERIOS:
SALUDO — Cumple si AGENTE: (1) saludo temporal + empresa + su nombre, (2) pregunta nombre del usuario, lo saluda y se ofrece.
EMPATÍA — Cumple si AGENTE muestra sensibilidad ante la situación del usuario.
SONRISA — ${esChat ? "Cumple si AGENTE mantiene amabilidad en la redacción del chat" : "Cumple si AGENTE mantiene tono positivo y amable toda la llamada"}.
CLARIDAD — Cumple si AGENTE es directo y el usuario entiende sin repreguntar.
ENCUESTA — Cumple si AGENTE invita a la encuesta. No aplica si la interacción se cortó.
INFORMACIÓN — Cumple si AGENTE da respuesta concreta. (NO afecta nota)
PROCESO — Cumple si AGENTE sigue proceso lógico. (NO afecta nota)
CIERRE — Cumple si AGENTE hace los 3: pregunta si hay algo más + despedida con su nombre + invita a encuesta.

PUNTAJE TUTEO: "Sin tuteo" / "Tuteo leve" / "Tuteo real" (solo del AGENTE)
TONO GENERAL: "Alto" / "Medio" / "Bajo"

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "saludo": "Cumple" o "No cumple",
  "empatia": "Cumple" o "No cumple",
  "sonrisa": "Cumple" o "No cumple",
  "claridad": "Cumple" o "No cumple",
  "encuesta": "Cumple" o "No cumple" o "No aplica",
  "informacion": "Cumple" o "No cumple",
  "proceso": "Cumple" o "No cumple",
  "cierre": "Cumple" o "No cumple",
  "puntaje_tuteo": "Sin tuteo" o "Tuteo leve" o "Tuteo real",
  "tono_general": "Alto" o "Medio" o "Bajo",
  "tipo_consulta": "Máximo 3 palabras del motivo principal"
}

TRANSCRIPCIÓN:
${transcripcion}`;

  const respuestaCriterios = await llamarClaude(promptCriterios, MODELO_CRITERIOS, 1024);
  if (!respuestaCriterios) {
    await registrarError(idGestion, "Claude (criterios) no respondió");
    return null;
  }

  const criterios = extraerJson<CriteriosIA>(respuestaCriterios);
  if (!criterios) {
    await registrarError(idGestion, "Criterios: JSON inválido", respuestaCriterios.slice(0, 500));
    return null;
  }

  const saludo = normalizar(criterios.saludo, "criterio");
  const empatia = normalizar(criterios.empatia, "criterio");
  const sonrisa = normalizar(criterios.sonrisa, "criterio");
  const claridad = normalizar(criterios.claridad, "criterio");
  const encuesta = normalizar(criterios.encuesta, "criterio");
  const info = normalizar(criterios.informacion, "criterio");
  const proceso = normalizar(criterios.proceso, "criterio");
  const cierre = normalizar(criterios.cierre, "criterio");

  const cNorm: Record<string, string | null> = { saludo, empatia, sonrisa, claridad, encuesta, info, proceso, cierre };
  const camposNulos = Object.keys(cNorm).filter((k) => cNorm[k] === null);
  if (camposNulos.length > 0) {
    camposNulos.forEach((k) => { cNorm[k] = "No cumple"; });
    await registrarError(idGestion, "Normalizados a 'No cumple': " + camposNulos.join(", "), JSON.stringify(criterios).slice(0, 500));
  }

  const criteriosEvaluados = [cNorm.saludo, cNorm.empatia, cNorm.sonrisa, cNorm.claridad, cNorm.encuesta, cNorm.cierre].filter(
    (v) => v !== "No aplica"
  );
  const todosCumplen = criteriosEvaluados.length > 0 && criteriosEvaluados.every((v) => v === "Cumple");

  const promptTextos = `${contexto}

Eres Duvan, Coordinador de Formación y Calidad de Cofrem en People BPO. Acabas de revisar esta ${tipoInteraccion} y vas a dejar tu retroalimentación al asesor. Hablas de forma directa, cercana, humana — como lo harías cara a cara con tu equipo. Conoces el contexto colombiano y los regionalismos.

Resultados de evaluación de esta ${tipoInteraccion}:
- Saludo: ${cNorm.saludo}
- Empatía: ${cNorm.empatia}
- Sonrisa: ${cNorm.sonrisa}
- Claridad: ${cNorm.claridad}
- Encuesta: ${cNorm.encuesta}
- Cierre: ${cNorm.cierre}
- Tuteo detectado: ${criterios.puntaje_tuteo}
- ¿Todo cumplió bien?: ${todosCumplen ? "SÍ — interacción muy buena" : "NO — hay aspectos a mejorar"}

Genera tres campos siguiendo EXACTAMENTE este estilo:

============================================================
OBSERVACIÓN
============================================================
Describe en tercera persona NEUTRAL qué pasó en la ${tipoInteraccion}. Cuenta:
- Qué pedía o necesitaba el usuario (con su nombre si aparece)
- Qué hizo el asesor para resolverlo
- Cómo terminó la interacción
NO te dirijas al asesor aquí. Escribe como narración de lo que ocurrió.
Específico de ESTA ${tipoInteraccion}, con detalles reales.
${esChat ? "Recuerda: es un chat escrito, no una llamada." : ""}

============================================================
HALLAZGOS
============================================================
Háblale DIRECTAMENTE al asesor en SEGUNDA PERSONA ("Mostraste...", "Manejaste...", "Te presentaste...").
Menciona con ejemplos concretos qué hiciste bien y qué falló.
- Si hubo tuteo REAL (tú/te/ti/tu/tuyo), cita la frase exacta entre comillas.
- "su merced" es trato de respeto válido — NO lo menciones.
- NO menciones distorsiones fonéticas como error.
- ${esChat ? "Habla de redacción, no de voz/tono/sonrisa." : "Habla de tono de voz cuando aplique."}

============================================================
PUNTOS DE MEJORA
============================================================
${
  todosCumplen
    ? `La interacción fue muy buena en TODOS los criterios. Tu mensaje debe:
1. Reconocer lo bien que manejaste esta ${tipoInteraccion} con un detalle concreto y específico (NO genérico)
2. Resaltar UNA fortaleza que demostraste (empatía, claridad, manejo del proceso, etc.)
3. Cerrar con un "sigue así" genuino, motivador, diferente al de plantilla

NO inventes algo que mejorar. Si todo salió bien, dilo claramente.`
    : `La interacción tuvo aspectos a mejorar. Tu mensaje debe:
1. Empezar reconociendo algo CONCRETO y ESPECÍFICO que hiciste bien en ESTA ${tipoInteraccion}
2. Indicar qué mejorar de forma directa, empática y con ejemplo
3. Cerrar con apoyo motivador

PROHIBIDO empezar con: "Hiciste un buen trabajo", "Hiciste un gran trabajo", "La forma en que explicaste".
Si hubo tuteo real: cita la frase y sugiere ajustarla — SIN mencionar "usted".
Habla en SEGUNDA persona ("Manejaste...", "Mostraste...").`
}

REGLAS ABSOLUTAS para los TRES campos:
- Nunca uses "cliente", siempre "usuario"
- Nunca menciones distorsiones fonéticas del nombre Cofrem como error
- Nunca menciones "su merced" como algo a corregir
- En MEJORA: NUNCA recomendar "usar usted", "tratar de usted", "decir usted"
- Tono: directo, humano, cercano — como si fueras Duvan hablando con su equipo
- ${esChat ? "Es un CHAT — no menciones voz, tono de voz, sonrisa audible" : "Es una LLAMADA — puedes mencionar tono de voz"}
- Máximo 4 oraciones por campo

Responde ÚNICAMENTE con JSON válido, sin texto adicional antes o después:
{
  "observacion": "...",
  "hallazgos": "...",
  "mejora": "..."
}

TRANSCRIPCIÓN:
${transcripcion}`;

  const respuestaTextos = await llamarClaude(promptTextos, MODELO_TEXTOS, 2048);
  if (!respuestaTextos) {
    await registrarError(idGestion, "Claude (textos) no respondió");
    return null;
  }

  const textos = extraerJson<TextosIA>(respuestaTextos);
  if (!textos) {
    await registrarError(idGestion, "Textos: JSON inválido", respuestaTextos.slice(0, 500));
    return null;
  }

  const puntajeTuteo = normalizar(criterios.puntaje_tuteo, "tuteo") ?? "Sin tuteo";
  const tonoGeneral = normalizar(criterios.tono_general, "tono") ?? "Medio";

  const criteriosParaNota = [cNorm.saludo, cNorm.empatia, cNorm.sonrisa, cNorm.claridad, cNorm.encuesta, cNorm.cierre].filter(
    (v) => v !== "No aplica"
  );
  const total = criteriosParaNota.length;
  const cumple = criteriosParaNota.filter((v) => v === "Cumple").length;
  const cantidadNoCumple = criteriosParaNota.filter((v) => v === "No cumple").length;

  let nota = total > 0 ? Math.round((cumple / total) * 100) : 0;
  let tipoNota = "OK";
  if (cantidadNoCumple === 0) {
    nota = 100;
    tipoNota = "OK";
  } else if (cantidadNoCumple <= 2) {
    nota = 100;
    tipoNota = "OK";
  } else {
    tipoNota = "PENC";
  }

  return {
    saludo: cNorm.saludo!, empatia: cNorm.empatia!, sonrisa: cNorm.sonrisa!, claridad: cNorm.claridad!,
    encuesta: cNorm.encuesta!, info: cNorm.info!, proceso: cNorm.proceso!, cierre: cNorm.cierre!,
    observacion: textos.observacion || "N/A", hallazgos: textos.hallazgos || "N/A", mejora: textos.mejora || "N/A",
    tipoConsulta: criterios.tipo_consulta || "N/A",
    puntajeTuteo, fechaProcesamiento: new Date(), tonoGeneral,
    nota: nota + "%", tipoNota,
  };
}

/* ===================== */
/* PROCESAR TRANSCRIPCIONES */
/* ===================== */

export interface ResultadoProcesamiento {
  procesadas: number;
  errores: number;
  detuvoPorTope: boolean;
  detuvoPorTiempo: boolean;
  resumenesCortes: number;
}

export async function procesarTranscripciones(): Promise<ResultadoProcesamiento> {
  const inicio = Date.now();
  const id = sheetId();

  await asegurarHoja(id, "Log Errores", ["Fecha", "ID Gestión", "Motivo", "Respuesta Claude"]);

  const registrarError = async (idGestion: string, motivo: string, respuestaCruda = "") => {
    await appendRows(id, "Log Errores!A:D", [[new Date().toISOString(), idGestion, motivo, respuestaCruda]]);
  };

  const [transData, consIds, funcData] = await Promise.all([
    readRange(id, "Transcripciones1", { unformatted: true }),
    readRange(id, "Consolidado!A:G", { unformatted: true }),
    readRange(id, "Funcionarios", { unformatted: true }),
  ]);

  const idsExistentes = new Set(consIds.slice(1).map((r) => texto(r, 6)).filter(Boolean));

  const mapaFuncionarios = new Map<string, unknown[]>();
  for (let i = 1; i < funcData.length; i++) {
    mapaFuncionarios.set(texto(funcData[i], 0), funcData[i]);
  }

  let filasBuffer: (string | number)[][] = [];
  let actualizacionesEstado: { fila: number; estado: string }[] = [];
  let procesadas = 0;
  let errores = 0;
  let detuvoPorTope = false;
  let detuvoPorTiempo = false;

  const guardarBuffer = async () => {
    if (filasBuffer.length > 0) {
      await appendRows(id, "Consolidado!A:AA", filasBuffer);
      filasBuffer = [];
    }
    for (const u of actualizacionesEstado) {
      await updateRange(id, `Transcripciones1!E${u.fila}`, [[u.estado]]);
    }
    actualizacionesEstado = [];
  };

  for (let i = 1; i < transData.length; i++) {
    if (procesadas >= TOPE_MAXIMO_POR_CORRIDA) {
      detuvoPorTope = true;
      break;
    }
    if (Date.now() - inicio > LIMITE_MS) {
      detuvoPorTiempo = true;
      break;
    }

    const fecha = transData[i][0];
    const idGestion = texto(transData[i], 1);
    const transcripcion = texto(transData[i], 2);
    const asesor = texto(transData[i], 3);
    const estadoActual = texto(transData[i], 4);

    if (!idGestion || !asesor || !transcripcion) continue;
    if (idsExistentes.has(idGestion)) continue;
    if (estadoActual === "Procesado" || estadoActual === "Error") continue;
    if (!esFechaDeHoyBogota(fecha)) continue;

    let intentoActual = 1;
    if (estadoActual.startsWith("Intento ")) {
      intentoActual = parseInt(estadoActual.split(" ")[1], 10) + 1;
    }

    if (intentoActual > MAX_INTENTOS) {
      actualizacionesEstado.push({ fila: i + 1, estado: "Error" });
      await registrarError(idGestion, `Máximo de intentos alcanzado (${MAX_INTENTOS})`);
      errores++;
      continue;
    }

    const funcionario = mapaFuncionarios.get(asesor);
    if (!funcionario) {
      actualizacionesEstado.push({ fila: i + 1, estado: "Error" });
      await registrarError(idGestion, "Asesor no encontrado en Funcionarios: " + asesor);
      errores++;
      continue;
    }

    const correo = texto(funcionario, 1);
    const canal = texto(funcionario, 2);
    const fechaObj = parseSheetDate(fecha) ?? new Date();
    const mes = MESES[fechaObj.getUTCMonth()];
    const esChat = canal.toLowerCase().includes("chat");

    const lineasAgente = transcripcion
      .split("|")
      .map((l) => l.trim())
      .filter((l) => l.toUpperCase().startsWith("AGENTE:"));

    if (lineasAgente.length === 0) {
      const tipoInteraccion = esChat ? "el chat" : "la llamada";
      filasBuffer.push([
        fechaCorta(fechaObj), mes, asesor, canal, "Consulta", correo, idGestion, "Calidad",
        "No cumple", "No cumple", "No cumple", "No cumple", "No cumple", "No cumple", "No cumple", "No cumple",
        "0%", "PENC",
        `El asesor no atendió ${tipoInteraccion}. Solo se registró participación del usuario sin respuesta del agente.`,
        "No se evidencia tu participación en la conversación.",
        `No atendiste ${tipoInteraccion}, y eso afecta directamente al usuario que quedó sin respuesta. Es fundamental responder todas las interacciones asignadas. Revisemos juntos qué pasó para que no vuelva a ocurrir.`,
        "Procesado", "", "Sin atención del agente", "Sin tuteo", fechaCorta(new Date()), "Bajo",
      ]);
      idsExistentes.add(idGestion);
      actualizacionesEstado.push({ fila: i + 1, estado: "Procesado" });
      procesadas++;
      if (filasBuffer.length >= BLOQUE_ESCRITURA) await guardarBuffer();
      continue;
    }

    const evaluacion = await auditarLlamada(transcripcion, idGestion, esChat, registrarError);

    if (!evaluacion) {
      const nuevoEstado = intentoActual >= MAX_INTENTOS ? "Error" : "Intento " + intentoActual;
      actualizacionesEstado.push({ fila: i + 1, estado: nuevoEstado });
      if (nuevoEstado === "Error") errores++;
      continue;
    }

    filasBuffer.push([
      fechaCorta(fechaObj), mes, asesor, canal, "Consulta", correo, idGestion, "Calidad",
      evaluacion.saludo, evaluacion.empatia, evaluacion.sonrisa, evaluacion.claridad,
      evaluacion.encuesta, evaluacion.info, evaluacion.proceso, evaluacion.cierre,
      evaluacion.nota, evaluacion.tipoNota,
      evaluacion.observacion, evaluacion.hallazgos, evaluacion.mejora,
      "Procesado", "", evaluacion.tipoConsulta,
      evaluacion.puntajeTuteo, fechaCorta(evaluacion.fechaProcesamiento), evaluacion.tonoGeneral,
    ]);
    idsExistentes.add(idGestion);
    actualizacionesEstado.push({ fila: i + 1, estado: "Procesado" });
    procesadas++;

    if (filasBuffer.length >= BLOQUE_ESCRITURA) await guardarBuffer();
  }

  await guardarBuffer();

  const resumenesCortes = await generarResumenCortes();

  return { procesadas, errores, detuvoPorTope, detuvoPorTiempo, resumenesCortes };
}

/* ===================== */
/* GENERAR RESUMEN EN Cortes_Envio */
/* ===================== */

export async function generarResumenCortes(): Promise<number> {
  const id = sheetId();
  await asegurarHoja(id, "Log Errores", ["Fecha", "ID Gestión", "Motivo", "Respuesta Claude"]);

  const registrarError = async (asesor: string, motivo: string, respuestaCruda = "") => {
    await appendRows(id, "Log Errores!A:D", [[new Date().toISOString(), asesor, motivo, respuestaCruda]]);
  };

  const [consData, cortesData] = await Promise.all([
    readRange(id, "Consolidado!A:U", { unformatted: true }),
    readRange(id, "Cortes_Envio", { unformatted: true }),
  ]);

  const mapaAsesores = new Map<string, { hallazgos: string; mejora: string }[]>();
  const mapaNotas = new Map<string, number[]>();

  for (let i = 1; i < consData.length; i++) {
    if (!esFechaDeHoyBogota(consData[i][0])) continue;

    const asesor = texto(consData[i], 2).trim();
    if (!asesor) continue;

    const nota = parseFloat(texto(consData[i], 16).replace("%", "") || "0");
    const hallazgos = texto(consData[i], 19);
    const mejora = texto(consData[i], 20);

    if (!mapaAsesores.has(asesor)) {
      mapaAsesores.set(asesor, []);
      mapaNotas.set(asesor, []);
    }
    mapaAsesores.get(asesor)!.push({ hallazgos, mejora });
    mapaNotas.get(asesor)!.push(nota);
  }

  if (mapaAsesores.size === 0) return 0;

  const mapaFilas = new Map<string, number>();
  for (let i = 1; i < cortesData.length; i++) {
    const asesorCortes = texto(cortesData[i], 1).trim();
    if (asesorCortes) mapaFilas.set(asesorCortes, i + 1);
  }

  let generados = 0;

  for (const [asesor, auditorias] of mapaAsesores) {
    const notas = mapaNotas.get(asesor) ?? [];
    const promedio = notas.length > 0 ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) + "%" : "N/A";

    const bloqueAuditorias = auditorias
      .map((a, idx) => `Auditoría ${idx + 1}:\n- Hallazgos: ${a.hallazgos || "N/A"}\n- Puntos de mejora: ${a.mejora || "N/A"}`)
      .join("\n\n");

    const prompt = `Eres Duvan, Coordinador de Formación y Calidad de Cofrem en People BPO.
Hoy auditaste ${auditorias.length} interacción(es) del asesor ${asesor}.
Promedio de nota del día: ${promedio}.

A continuación están los hallazgos y puntos de mejora de CADA auditoría individual:

${bloqueAuditorias}

Tu tarea es generar DOS campos de resumen consolidado para enviarle al asesor al cierre del día.
Habla de forma directa, cercana y humana — como si fueras Duvan hablando cara a cara con su equipo.

============================================================
HALLAZGOS CONSOLIDADOS
============================================================
- Resume en 3-5 oraciones los patrones positivos y negativos que se repitieron hoy.
- Habla en SEGUNDA PERSONA directa ("Mostraste...", "En varias interacciones...", "Mantuviste...").
- Sé específico con lo que ocurrió hoy — nada genérico.
- Si todas las auditorías salieron bien, resáltalo con entusiasmo genuino.
- Nunca uses "cliente", siempre "usuario".

============================================================
PUNTOS DE MEJORA CONSOLIDADOS
============================================================
- Si hay aspectos a mejorar: menciona los más frecuentes del día con ejemplos y cómo mejorarlos.
- Si todo salió bien: reconoce la consistencia y motiva a mantenerla con algo concreto.
- Máximo 4 oraciones. Tono directo, humano, motivador.
- NUNCA recomendar "usar usted". NUNCA decir "cliente".

Responde ÚNICAMENTE con JSON válido, sin texto antes ni después:
{
  "hallazgos_resumen": "...",
  "mejora_resumen": "..."
}`;

    const respuesta = await llamarClaude(prompt, MODELO_TEXTOS, 1024);
    if (!respuesta) {
      await registrarError(asesor, "Cortes_Envio: Claude no respondió");
      continue;
    }

    const resumen = extraerJson<{ hallazgos_resumen: string; mejora_resumen: string }>(respuesta);
    if (!resumen) {
      await registrarError(asesor, "Cortes_Envio: JSON inválido", respuesta.slice(0, 400));
      continue;
    }

    const filaReal = mapaFilas.get(asesor);
    if (filaReal) {
      await updateRange(id, `Cortes_Envio!E${filaReal}`, [[resumen.hallazgos_resumen || "N/A"]]);
      await updateRange(id, `Cortes_Envio!F${filaReal}`, [[resumen.mejora_resumen || "N/A"]]);
      generados++;
    } else {
      await registrarError(asesor, "Cortes_Envio: asesor no encontrado en hoja para escribir resumen");
    }
  }

  return generados;
}

/* ===================== */
/* ESTADO PARA LA UI ADMIN */
/* ===================== */

export interface EstadoAuditorias {
  pendientesHoy: number;
  totalTranscripciones: number;
}

export async function obtenerEstadoAuditorias(): Promise<EstadoAuditorias> {
  const id = sheetId();
  const transData = await readRange(id, "Transcripciones1", { unformatted: true });

  let pendientesHoy = 0;
  for (let i = 1; i < transData.length; i++) {
    const idGestion = texto(transData[i], 1);
    const asesor = texto(transData[i], 3);
    const transcripcion = texto(transData[i], 2);
    const estadoActual = texto(transData[i], 4);
    if (!idGestion || !asesor || !transcripcion) continue;
    if (estadoActual === "Procesado" || estadoActual === "Error") continue;
    if (!esFechaDeHoyBogota(transData[i][0])) continue;
    pendientesHoy++;
  }

  return { pendientesHoy, totalTranscripciones: Math.max(0, transData.length - 1) };
}

/* ===================== */
/* CARGA DE TRANSCRIPCIONES (CSV) */
/* ===================== */

// Equivalencias entre el login/usuario que trae el CSV y la clave de asesor
// usada en la hoja Funcionarios — copiado tal cual del Apps Script original.
const MAPA_ASESORES: Record<string, string> = {
  "angie.banda": "A.BANDA483",
  "b.cabarcas334": "B.CABARCAS334",
  "bleidis.cabarcas": "B.CABARCAS334",
  "heillen.rincon": "H.RINCON224",
  "joselyn.mendoza": "J.MENDOZA382",
  "katherine.nieto": "K.NIETO798",
  "stefania.ortega": "S.ORTEGA581",
  "valentina.murcia": "V.MURCIA638",
  "hadisha.bitar": "H.BITAR924",
  "slendy.garcia": "S.PICO465",
  "juliana.aragones": "J.ROA074",
  "ana.nustez": "A.NUSTEZ351",
  "anamaria.mahecha": "ANAMARIA.MAHECHA",
  "deisy.romero": "DEISY.ROMERO",
  "lisandro.gutierrez": "LISANDRO.GUTIERREZ",
  "paulaisabel.abellaespinosa": "PAULAISABEL.ABELLAESPINOSA",
  "francy.hernandez": "FRANCY.HERNANDEZ",
  "cesargiovanny.rivas": "CESAR.RIVAS",
  "monica.ruiz": "MONICA.RUIZ",
};

export interface ResultadoCargaCsv {
  cantidad: number;
}

export async function cargarTranscripcionesCsv(contenidoCsvRaw: string): Promise<ResultadoCargaCsv> {
  const id = sheetId();
  const contenidoCsv = contenidoCsvRaw.replace(/^﻿/, "");
  const lineas = parseCsv(contenidoCsv, ";");

  if (!lineas || lineas.length < 2) {
    throw new Error("El archivo no contiene registros válidos.");
  }

  const encabezados = lineas[0].map((h) => h.trim().toUpperCase());
  const colAgente = encabezados.indexOf("AGENTE");
  const colId = encabezados.indexOf("CONTACT_ID");
  const colTranscripcion = encabezados.indexOf("TRANSCRIPCION");

  if (colAgente === -1 || colId === -1 || colTranscripcion === -1) {
    throw new Error("El CSV no tiene las columnas esperadas: AGENTE, CONTACT_ID, TRANSCRIPCION");
  }

  const filasParaInsertar: (string | number)[][] = [];
  const fechaActual = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" });

  for (let i = 1; i < lineas.length; i++) {
    const fila = lineas[i];
    if (!fila || fila.length <= Math.max(colAgente, colId, colTranscripcion)) continue;
    if (!fila[colId] || fila[colId].trim() === "") continue;

    const nombreCsv = fila[colAgente].trim().toLowerCase();
    const asesorFinal = MAPA_ASESORES[nombreCsv] || fila[colAgente].trim().toUpperCase();
    const idGestion = fila[colId].trim();
    const transcripcion = fila[colTranscripcion].trim();

    if (!transcripcion) continue;

    filasParaInsertar.push([fechaActual, idGestion, transcripcion, asesorFinal]);
  }

  if (filasParaInsertar.length === 0) {
    throw new Error("El archivo no contiene registros válidos.");
  }

  await appendRows(id, "Transcripciones1!A:D", filasParaInsertar);

  return { cantidad: filasParaInsertar.length };
}

/* ===================== */
/* HISTORIAL DE AUDITORÍAS (CONSOLIDADO) */
/* ===================== */

// Índices de columnas en Consolidado (A=0). Coinciden con el orden en que
// procesarTranscripciones() escribe cada fila.
const COL = {
  fecha: 0,
  mes: 1,
  asesor: 2,
  canal: 3,
  tipoGestion: 4,
  correo: 5,
  idGestion: 6,
  evaluador: 7,
  saludo: 8,
  empatia: 9,
  sonrisa: 10,
  claridad: 11,
  encuesta: 12,
  informacion: 13,
  proceso: 14,
  cierre: 15,
  nota: 16,
  tipoNota: 17,
  observacion: 18,
  hallazgos: 19,
  mejora: 20,
  tipoConsulta: 23,
  puntajeTuteo: 24,
  tonoGeneral: 26,
} as const;

export interface AuditoriaHistorial {
  fecha: string;
  mes: string;
  asesor: string;
  canal: string;
  tipoGestion: string;
  correo: string;
  idGestion: string;
  evaluador: string;
  saludo: string;
  empatia: string;
  sonrisa: string;
  claridad: string;
  encuesta: string;
  informacion: string;
  proceso: string;
  cierre: string;
  nota: string;
  tipoNota: string;
  observacion: string;
  hallazgos: string;
  mejora: string;
  tipoConsulta: string;
  puntajeTuteo: string;
  tonoGeneral: string;
}

export interface HistorialAuditorias {
  auditorias: AuditoriaHistorial[];
  asesores: string[];
  meses: string[];
  total: number;
  limitado: boolean;
}

const HISTORIAL_MAX = 400;

export async function obtenerHistorialAuditorias(filtros: {
  asesor?: string;
  mes?: string;
}): Promise<HistorialAuditorias> {
  const id = sheetId();
  const data = await readRange(id, "Consolidado!A2:AA");

  const asesoresSet = new Set<string>();
  const mesesSet = new Set<string>();
  const filtroAsesor = (filtros.asesor ?? "").trim();
  const filtroMes = (filtros.mes ?? "").trim();

  // Recorremos de la fila más reciente a la más antigua (se agregan al final).
  const coincidencias: AuditoriaHistorial[] = [];
  let total = 0;

  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const idGestion = texto(row, COL.idGestion);
    const asesor = texto(row, COL.asesor).trim();
    if (!idGestion || !asesor) continue;

    if (asesor) asesoresSet.add(asesor);
    const mes = texto(row, COL.mes).trim();
    if (mes) mesesSet.add(mes);

    if (filtroAsesor && asesor !== filtroAsesor) continue;
    if (filtroMes && mes !== filtroMes) continue;

    total++;
    if (coincidencias.length >= HISTORIAL_MAX) continue;

    coincidencias.push({
      fecha: texto(row, COL.fecha),
      mes,
      asesor,
      canal: texto(row, COL.canal),
      tipoGestion: texto(row, COL.tipoGestion),
      correo: texto(row, COL.correo),
      idGestion,
      evaluador: texto(row, COL.evaluador),
      saludo: texto(row, COL.saludo),
      empatia: texto(row, COL.empatia),
      sonrisa: texto(row, COL.sonrisa),
      claridad: texto(row, COL.claridad),
      encuesta: texto(row, COL.encuesta),
      informacion: texto(row, COL.informacion),
      proceso: texto(row, COL.proceso),
      cierre: texto(row, COL.cierre),
      nota: texto(row, COL.nota),
      tipoNota: texto(row, COL.tipoNota),
      observacion: texto(row, COL.observacion),
      hallazgos: texto(row, COL.hallazgos),
      mejora: texto(row, COL.mejora),
      tipoConsulta: texto(row, COL.tipoConsulta),
      puntajeTuteo: texto(row, COL.puntajeTuteo),
      tonoGeneral: texto(row, COL.tonoGeneral),
    });
  }

  return {
    auditorias: coincidencias,
    asesores: Array.from(asesoresSet).sort((a, b) => a.localeCompare(b)),
    meses: Array.from(mesesSet),
    total,
    limitado: total > coincidencias.length,
  };
}
