import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja } from "@/lib/sheets";
import { parsearPreguntasTSV, calificar, type Letra } from "@/lib/evaluaciones-tipos";
import { enviarCorreoMasivo } from "@/lib/mailer";
import { correoEvaluacionesPendientes } from "@/lib/emailTemplates";

// ============================================================
// Evaluaciones (quizzes) — capa de datos (lado coordinación/admin).
//
// Reutiliza la hoja de DuAcademy (SHEET_ID_QUIZ) con pestañas DEDICADAS que no
// tocan las existentes: EVAL_QUIZZES, EVAL_PREGUNTAS, EVAL_RESULTADOS. Se
// autocrean. (Si algún día se usa una hoja aparte, basta definir
// SHEET_ID_EVALUACIONES.)
// ============================================================

const TAB_QUIZZES = "EVAL_QUIZZES";
const TAB_PREGUNTAS = "EVAL_PREGUNTAS";
const TAB_RESULTADOS = "EVAL_RESULTADOS";

const HEADERS_QUIZZES = ["ID", "NOMBRE", "DESCRIPCION", "DURACION_MIN", "UMBRAL", "NUM_PREGUNTAS", "ACTIVO", "CREADO_POR", "CREADO_EN"];
const HEADERS_PREGUNTAS = ["QUIZ_ID", "NUM", "ID_PREGUNTA", "PREGUNTA", "OPCION_A", "OPCION_B", "OPCION_C", "OPCION_D", "CORRECTA", "EXPLICACION"];
const HEADERS_RESULTADOS = ["FECHA", "USUARIO", "QUIZ_ID", "ACIERTOS", "TOTAL", "PUNTAJE", "RESULTADO", "RESPUESTAS_JSON", "FALLADAS"];

const UMBRAL_POR_DEFECTO = 60;
const DURACION_POR_DEFECTO = 5;

function sheetId(): string {
  const id = process.env.SHEET_ID_EVALUACIONES || process.env.SHEET_ID_QUIZ;
  if (!id) throw new Error("Falta la variable SHEET_ID_EVALUACIONES (o SHEET_ID_QUIZ).");
  return id;
}
function usuariosSheetId(): string {
  const id = process.env.SHEET_ID_USUARIOS;
  if (!id) throw new Error("Falta la variable SHEET_ID_USUARIOS");
  return id;
}
function texto(row: unknown[], i: number): string {
  return (row[i] ?? "").toString();
}
function esActivo(v: string): boolean {
  return ["si", "sí", "true", "1", "x", "activo"].includes(v.trim().toLowerCase());
}
function ahoraBogota(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" });
}

export interface QuizResumen {
  id: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  umbral: number;
  numPreguntas: number;
  activo: boolean;
  creadoPor: string;
  creadoEn: string;
}

function slugId(nombre: string, usados: Set<string>): string {
  const base = nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "QUIZ";
  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}_${n++}`;
  return id;
}

export interface CrearQuizInput {
  nombre: string;
  descripcion: string;
  duracionMin: number;
  umbral: number;
  preguntasTexto: string; // texto pegado (TSV); se re-parsea en el servidor
  creadoPor: string;
}

export async function crearQuiz(input: CrearQuizInput): Promise<{ ok: true; id: string; numPreguntas: number } | { ok: false; error: string }> {
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre del módulo es obligatorio." };

  // Re-parsea en el servidor (no confía en el cliente).
  const parseado = parsearPreguntasTSV(input.preguntasTexto ?? "");
  if (parseado.errores.length > 0) {
    return { ok: false, error: "Hay preguntas con errores:\n" + parseado.errores.slice(0, 8).join("\n") };
  }
  if (parseado.preguntas.length === 0) {
    return { ok: false, error: "No se detectaron preguntas válidas." };
  }

  const id = sheetId();
  await asegurarHoja(id, TAB_QUIZZES, HEADERS_QUIZZES);
  await asegurarHoja(id, TAB_PREGUNTAS, HEADERS_PREGUNTAS);
  await asegurarHoja(id, TAB_RESULTADOS, HEADERS_RESULTADOS);

  const quizzesRaw = await readRange(id, `${TAB_QUIZZES}!A2:A`);
  const usados = new Set(quizzesRaw.map((r) => texto(r, 0).trim()).filter(Boolean));
  const quizId = slugId(nombre, usados);

  const duracion = input.duracionMin > 0 ? input.duracionMin : DURACION_POR_DEFECTO;
  const umbral = input.umbral > 0 && input.umbral <= 100 ? input.umbral : UMBRAL_POR_DEFECTO;

  // Nace INACTIVO: la coordinadora lo activa cuando corresponda.
  await appendRows(id, `${TAB_QUIZZES}!A:I`, [[
    quizId, nombre, (input.descripcion ?? "").trim(), String(duracion), String(umbral),
    String(parseado.preguntas.length), "NO", input.creadoPor, ahoraBogota(),
  ]]);

  const filas = parseado.preguntas.map((p, idx) => {
    const op = (l: string) => p.opciones.find((o) => o.letra === l)?.texto ?? "";
    return [quizId, String(idx + 1), p.id, p.pregunta, op("A"), op("B"), op("C"), op("D"), p.correcta, p.explicacion];
  });
  await appendRows(id, `${TAB_PREGUNTAS}!A:J`, filas);

  return { ok: true, id: quizId, numPreguntas: parseado.preguntas.length };
}

export async function listarQuizzes(): Promise<QuizResumen[]> {
  const id = sheetId();
  let data: unknown[][] = [];
  try {
    data = await readRange(id, `${TAB_QUIZZES}!A2:I`);
  } catch {
    return [];
  }
  const out: QuizResumen[] = [];
  for (const r of data) {
    const qid = texto(r, 0).trim();
    if (!qid) continue;
    out.push({
      id: qid,
      nombre: texto(r, 1).trim() || qid,
      descripcion: texto(r, 2).trim(),
      duracionMin: parseInt(texto(r, 3), 10) || DURACION_POR_DEFECTO,
      umbral: parseInt(texto(r, 4), 10) || UMBRAL_POR_DEFECTO,
      numPreguntas: parseInt(texto(r, 5), 10) || 0,
      activo: esActivo(texto(r, 6)),
      creadoPor: texto(r, 7).trim(),
      creadoEn: texto(r, 8).trim(),
    });
  }
  return out;
}

async function filaDeQuiz(quizId: string): Promise<number> {
  const col = await readRange(sheetId(), `${TAB_QUIZZES}!A2:A`);
  const objetivo = quizId.trim();
  for (let i = 0; i < col.length; i++) if (texto(col[i], 0).trim() === objetivo) return i + 2;
  return -1;
}

export async function activarQuiz(quizId: string, activo: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const fila = await filaDeQuiz(quizId);
  if (fila === -1) return { ok: false, error: "No existe el módulo." };
  await updateRange(sheetId(), `${TAB_QUIZZES}!G${fila}`, [[activo ? "SI" : "NO"]]);
  return { ok: true };
}

// ── Matriz de calificaciones de un quiz: quién lo hizo, con su nota, y quién no. ──
export interface FilaResultado {
  usuario: string;
  nombre: string;
  hizo: boolean;
  porcentaje: number | null;
  resultado: string;
  fecha: string;
}

export async function listarAsesorasActivas(): Promise<{ usuario: string; nombre: string }[]> {
  const data = await readRange(usuariosSheetId(), "Usuarios!A2:F");
  const out: { usuario: string; nombre: string }[] = [];
  for (const r of data) {
    const usuario = texto(r, 0).trim();
    if (!usuario) continue;
    const activo = texto(r, 4).trim().toUpperCase() !== "NO";
    const rol = texto(r, 5).trim().toLowerCase();
    // Evaluaciones es universal: toda asesora activa (rol Asesora = ni admin ni
    // coordinadora) entra en resultados y avisos, sin exigir el módulo asignado.
    if (!activo) continue;
    if (rol === "admin" || rol === "coordinadora") continue;
    out.push({ usuario, nombre: texto(r, 2).trim() || usuario });
  }
  return out;
}

export async function obtenerResultadosQuiz(quizId: string): Promise<FilaResultado[]> {
  const id = sheetId();
  const [asesoras, resultadosRaw] = await Promise.all([
    listarAsesorasActivas(),
    readRange(id, `${TAB_RESULTADOS}!A2:G`).catch(() => [] as unknown[][]),
  ]);

  // Último resultado por usuario para este quiz.
  const porUsuario = new Map<string, { porcentaje: number; resultado: string; fecha: string }>();
  for (const r of resultadosRaw) {
    if (texto(r, 2).trim() !== quizId) continue;
    const usuario = texto(r, 1).trim().toUpperCase();
    porUsuario.set(usuario, {
      porcentaje: parseInt(texto(r, 5), 10) || 0,
      resultado: texto(r, 6).trim(),
      fecha: texto(r, 0).trim(),
    });
  }

  return asesoras.map((a) => {
    const res = porUsuario.get(a.usuario.trim().toUpperCase());
    return {
      usuario: a.usuario,
      nombre: a.nombre,
      hizo: !!res,
      porcentaje: res ? res.porcentaje : null,
      resultado: res ? res.resultado : "",
      fecha: res ? res.fecha : "",
    };
  });
}

// ── Avisar por correo a las asesoras con el módulo Evaluaciones ──
// El correo de cada asesora se resuelve del directorio oficial Funcionarios
// (código = login de la asesora). Nunca de un valor sin validar.
export async function avisarEvaluaciones(): Promise<{ enviados: number }> {
  const base = process.env.APP_URL;
  if (!base) throw new Error("Falta la variable APP_URL");
  const url = `${base.replace(/\/$/, "")}/modulos/evaluaciones`;

  const asesoras = await listarAsesorasActivas();
  if (asesoras.length === 0) return { enviados: 0 };

  // Mapa código→correo desde Funcionarios (misma hoja de métricas/auditorías).
  const funcSheet = process.env.SHEET_ID_METRICAS;
  if (!funcSheet) throw new Error("Falta la variable SHEET_ID_METRICAS");
  const funcRaw = await readRange(funcSheet, "Funcionarios", { unformatted: true });
  const correoPorCodigo = new Map<string, string>();
  for (let i = 1; i < funcRaw.length; i++) {
    const cod = texto(funcRaw[i], 0).trim().toUpperCase();
    const correo = texto(funcRaw[i], 1).trim();
    if (cod && correo) correoPorCodigo.set(cod, correo);
  }

  const destinatarios = asesoras
    .map((a) => correoPorCodigo.get(a.usuario.trim().toUpperCase()))
    .filter((c): c is string => !!c);

  const unicos = [...new Set(destinatarios)];
  if (unicos.length === 0) return { enviados: 0 };

  await enviarCorreoMasivo(unicos, "Tienes evaluaciones de conocimiento pendientes", correoEvaluacionesPendientes(url));
  return { enviados: unicos.length };
}

// ============================================================
// LADO ASESORA — presentar evaluaciones
//
// Seguridad: la RESPUESTA CORRECTA nunca se envía al navegador por adelantado.
// El feedback por pregunta se resuelve en el servidor (verificarRespuesta) y la
// nota final SIEMPRE se recalcula en el servidor (finalizar). Un intento por
// asesora, controlado por EVAL_RESULTADOS.
// ============================================================

interface PreguntaConClave {
  num: number;
  id: string;
  pregunta: string;
  opciones: { letra: Letra; texto: string }[];
  correcta: Letra;
  explicacion: string;
}

async function leerPreguntasQuiz(quizId: string): Promise<PreguntaConClave[]> {
  const data = await readRange(sheetId(), `${TAB_PREGUNTAS}!A2:J`);
  const out: PreguntaConClave[] = [];
  for (const r of data) {
    if (texto(r, 0).trim() !== quizId) continue;
    const opciones: { letra: Letra; texto: string }[] = [];
    (["A", "B", "C", "D"] as Letra[]).forEach((l, i) => {
      const t = texto(r, 4 + i).trim();
      if (t) opciones.push({ letra: l, texto: t });
    });
    out.push({
      num: parseInt(texto(r, 1), 10) || out.length + 1,
      id: texto(r, 2).trim(),
      pregunta: texto(r, 3),
      opciones,
      correcta: (texto(r, 8).trim().toUpperCase() as Letra),
      explicacion: texto(r, 9),
    });
  }
  out.sort((a, b) => a.num - b.num);
  return out;
}

// Último resultado de una asesora en un quiz (o null).
async function resultadoDe(usuario: string, quizId: string): Promise<{ fecha: string; porcentaje: number; resultado: string; aciertos: number; total: number; respuestas: Record<string, Letra>; falladas: string } | null> {
  const data = await readRange(sheetId(), `${TAB_RESULTADOS}!A2:I`).catch(() => [] as unknown[][]);
  const u = usuario.trim().toUpperCase();
  for (let i = data.length - 1; i >= 0; i--) {
    const r = data[i];
    if (texto(r, 1).trim().toUpperCase() !== u || texto(r, 2).trim() !== quizId) continue;
    let respuestas: Record<string, Letra> = {};
    try { respuestas = JSON.parse(texto(r, 7) || "{}"); } catch { respuestas = {}; }
    return {
      fecha: texto(r, 0).trim(),
      aciertos: parseInt(texto(r, 3), 10) || 0,
      total: parseInt(texto(r, 4), 10) || 0,
      porcentaje: parseInt(texto(r, 5), 10) || 0,
      resultado: texto(r, 6).trim(),
      respuestas,
      falladas: texto(r, 8),
    };
  }
  return null;
}

export interface PanelAsesora {
  pendientes: { id: string; nombre: string; descripcion: string; numPreguntas: number; duracionMin: number }[];
  realizados: { id: string; nombre: string; porcentaje: number; resultado: string; fecha: string }[];
}

export async function obtenerPanelAsesora(usuario: string): Promise<PanelAsesora> {
  const quizzes = (await listarQuizzes()).filter((q) => q.activo);
  const pendientes: PanelAsesora["pendientes"] = [];
  const realizados: PanelAsesora["realizados"] = [];
  for (const q of quizzes) {
    const res = await resultadoDe(usuario, q.id);
    if (res) {
      realizados.push({ id: q.id, nombre: q.nombre, porcentaje: res.porcentaje, resultado: res.resultado, fecha: res.fecha });
    } else {
      pendientes.push({ id: q.id, nombre: q.nombre, descripcion: q.descripcion, numPreguntas: q.numPreguntas, duracionMin: q.duracionMin });
    }
  }
  return { pendientes, realizados };
}

function mezclar<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface QuizParaPresentar {
  quiz: { id: string; nombre: string; duracionSegundos: number };
  preguntas: { id: string; pregunta: string; opciones: { letra: Letra; texto: string }[] }[];
}

export async function iniciarQuizAsesora(usuario: string, quizId: string): Promise<{ ok: true; data: QuizParaPresentar } | { ok: false; error: string }> {
  const quiz = (await listarQuizzes()).find((q) => q.id === quizId);
  if (!quiz) return { ok: false, error: "Esta evaluación no existe." };
  if (!quiz.activo) return { ok: false, error: "Esta evaluación no está disponible." };
  if (await resultadoDe(usuario, quizId)) return { ok: false, error: "Ya presentaste esta evaluación." };

  const preguntas = await leerPreguntasQuiz(quizId);
  if (preguntas.length === 0) return { ok: false, error: "Esta evaluación no tiene preguntas." };

  // Orden de preguntas aleatorio; las opciones se mantienen A–D (no se envía la correcta).
  const publicas = mezclar(preguntas).map((p) => ({ id: p.id, pregunta: p.pregunta, opciones: p.opciones }));
  return { ok: true, data: { quiz: { id: quiz.id, nombre: quiz.nombre, duracionSegundos: quiz.duracionMin * 60 }, preguntas: publicas } };
}

export async function verificarRespuestaAsesora(quizId: string, idPregunta: string, letra: Letra): Promise<{ ok: true; correcta: boolean; letraCorrecta: Letra } | { ok: false; error: string }> {
  const preguntas = await leerPreguntasQuiz(quizId);
  const p = preguntas.find((x) => x.id === idPregunta);
  if (!p) return { ok: false, error: "Pregunta no válida." };
  return { ok: true, correcta: letra === p.correcta, letraCorrecta: p.correcta };
}

export interface ResultadoPresentacion {
  aciertos: number;
  total: number;
  porcentaje: number;
  resultado: "APROBADO" | "NO APROBADO";
  errores: number;
}

export async function finalizarQuizAsesora(usuario: string, quizId: string, respuestas: Record<string, Letra>): Promise<{ ok: true; data: ResultadoPresentacion } | { ok: false; error: string }> {
  const quiz = (await listarQuizzes()).find((q) => q.id === quizId);
  if (!quiz) return { ok: false, error: "Esta evaluación no existe." };

  // Idempotente: si ya hay resultado, se devuelve ese (no se duplica).
  const previo = await resultadoDe(usuario, quizId);
  if (previo) {
    return { ok: true, data: { aciertos: previo.aciertos, total: previo.total, porcentaje: previo.porcentaje, resultado: (previo.resultado === "APROBADO" ? "APROBADO" : "NO APROBADO"), errores: previo.total - previo.aciertos } };
  }

  const preguntas = await leerPreguntasQuiz(quizId);
  if (preguntas.length === 0) return { ok: false, error: "Esta evaluación no tiene preguntas." };

  // Califica en el servidor (nunca confía en la nota del cliente).
  const respuestasPorNum: Record<number, Letra | ""> = {};
  const correctasPorNum: { correcta: Letra }[] = [];
  const respuestasPorId: Record<string, Letra> = {};
  preguntas.forEach((p, idx) => {
    const elegida = (respuestas[p.id] ?? "") as Letra | "";
    respuestasPorNum[idx + 1] = elegida;
    correctasPorNum.push({ correcta: p.correcta });
    if (elegida) respuestasPorId[p.id] = elegida;
  });
  const cal = calificar(correctasPorNum, respuestasPorNum, quiz.umbral);

  await appendRows(sheetId(), `${TAB_RESULTADOS}!A:I`, [[
    ahoraBogota(), usuario, quizId, String(cal.aciertos), String(cal.total),
    String(cal.porcentaje), cal.resultado, JSON.stringify(respuestasPorId),
    cal.falladas.length ? cal.falladas.join(", ") : "Ninguna",
  ]]);

  return { ok: true, data: { aciertos: cal.aciertos, total: cal.total, porcentaje: cal.porcentaje, resultado: cal.resultado, errores: cal.total - cal.aciertos } };
}

export interface RevisionAsesora {
  quiz: { id: string; nombre: string };
  resumen: { fecha: string; porcentaje: number; aciertos: number; total: number; resultado: string };
  preguntas: { numero: number; pregunta: string; opciones: { letra: Letra; texto: string }[]; elegida: Letra | ""; correcta: Letra; acierto: boolean; explicacion: string }[];
}

export async function obtenerRevisionAsesora(usuario: string, quizId: string): Promise<{ ok: true; data: RevisionAsesora } | { ok: false; error: string }> {
  const quiz = (await listarQuizzes()).find((q) => q.id === quizId);
  if (!quiz) return { ok: false, error: "Esta evaluación no existe." };
  const res = await resultadoDe(usuario, quizId);
  if (!res) return { ok: false, error: "Aún no has presentado esta evaluación." };

  const preguntas = await leerPreguntasQuiz(quizId);
  const items = preguntas.map((p, idx) => {
    const elegida = (res.respuestas[p.id] ?? "") as Letra | "";
    return { numero: idx + 1, pregunta: p.pregunta, opciones: p.opciones, elegida, correcta: p.correcta, acierto: elegida === p.correcta, explicacion: p.explicacion };
  });

  return {
    ok: true,
    data: {
      quiz: { id: quiz.id, nombre: quiz.nombre },
      resumen: { fecha: res.fecha, porcentaje: res.porcentaje, aciertos: res.aciertos, total: res.total, resultado: res.resultado },
      preguntas: items,
    },
  };
}
