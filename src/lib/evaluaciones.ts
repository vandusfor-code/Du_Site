import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja } from "@/lib/sheets";
import { parsearPreguntasTSV } from "@/lib/evaluaciones-tipos";
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
    const modulos = texto(r, 3).toLowerCase();
    // Asesoras activas (rol Asesora = ni admin ni coordinadora) con el módulo asignado.
    if (!activo) continue;
    if (rol === "admin" || rol === "coordinadora") continue;
    if (!modulos.includes("evaluaciones")) continue;
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
