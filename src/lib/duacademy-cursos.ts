import "server-only";
import { parsearPreguntasTSV, calificar, type Letra } from "@/lib/evaluaciones-tipos";
import { listarAsesorasActivas } from "@/lib/evaluaciones";
import {
  listarCursosStore,
  obtenerCursoStore,
  idsCursosStore,
  insertarCursoStore,
  insertarPreguntasStore,
  activarCursoStore,
  eliminarCursoStore,
  leerPreguntasStore,
  obtenerProgresoUsuarioStore,
  obtenerProgresoCursoStore,
  obtenerProgresoUnoStore,
  todoElProgresoStore,
  guardarProgresoStore,
  listarBaseStore,
  crearBaseStore,
  eliminarBaseStore,
  type PreguntaRow,
  type BaseRow,
} from "@/lib/duacademy-store";

// ============================================================
// DuAcademy NATIVO — lógica de negocio. Cursos (lección + examen), progreso,
// leaderboard y base de conocimiento, todo sobre Supabase (duacademy-store).
// Reutiliza el parseo de preguntas y la calificación de Evaluaciones.
// ============================================================

const UMBRAL_POR_DEFECTO = 60;

function formatFecha(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function slugId(titulo: string, usados: Set<string>): string {
  const base = titulo
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "CURSO";
  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}_${n++}`;
  return id;
}

/* ===================== ADMIN ===================== */

export interface CursoResumen {
  id: string;
  titulo: string;
  descripcion: string;
  umbral: number;
  numPreguntas: number;
  activo: boolean;
  creadoPor: string;
  creadoEn: string;
}

export interface CrearCursoInput {
  titulo: string;
  descripcion: string;
  contenido: string;
  umbral: number;
  preguntasTexto: string;
  creadoPor: string;
}

export async function crearCurso(input: CrearCursoInput): Promise<{ ok: true; id: string; numPreguntas: number } | { ok: false; error: string }> {
  const titulo = (input.titulo ?? "").trim();
  if (!titulo) return { ok: false, error: "El título del curso es obligatorio." };

  const parseado = parsearPreguntasTSV(input.preguntasTexto ?? "");
  if (parseado.errores.length > 0) {
    return { ok: false, error: "Hay preguntas con errores:\n" + parseado.errores.slice(0, 8).join("\n") };
  }
  if (parseado.preguntas.length === 0) {
    return { ok: false, error: "No se detectaron preguntas válidas para el examen." };
  }

  const usados = await idsCursosStore();
  const cursoId = slugId(titulo, usados);
  const umbral = input.umbral > 0 && input.umbral <= 100 ? input.umbral : UMBRAL_POR_DEFECTO;

  await insertarCursoStore({
    id: cursoId, titulo, descripcion: (input.descripcion ?? "").trim(),
    contenido: input.contenido ?? "", umbral, numPreguntas: parseado.preguntas.length,
    creadoPor: input.creadoPor,
  });

  const filas: PreguntaRow[] = parseado.preguntas.map((p, idx) => {
    const op = (l: string) => p.opciones.find((o) => o.letra === l)?.texto ?? "";
    return {
      num: idx + 1, idPregunta: p.id, pregunta: p.pregunta,
      opcionA: op("A"), opcionB: op("B"), opcionC: op("C"), opcionD: op("D"),
      correcta: p.correcta as Letra, explicacion: p.explicacion,
    };
  });
  await insertarPreguntasStore(cursoId, filas);

  return { ok: true, id: cursoId, numPreguntas: parseado.preguntas.length };
}

export async function listarCursos(): Promise<CursoResumen[]> {
  const cursos = await listarCursosStore();
  return cursos.map((c) => ({
    id: c.id, titulo: c.titulo, descripcion: c.descripcion, umbral: c.umbral,
    numPreguntas: c.numPreguntas, activo: c.activo, creadoPor: c.creadoPor, creadoEn: formatFecha(c.creadoEn),
  }));
}

export async function activarCurso(cursoId: string, activo: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const existe = await activarCursoStore(cursoId, activo);
  if (!existe) return { ok: false, error: "No existe el curso." };
  return { ok: true };
}

export async function eliminarCurso(cursoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await eliminarCursoStore(cursoId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo eliminar" };
  }
}

export interface FilaResultadoCurso {
  usuario: string;
  nombre: string;
  hizo: boolean;
  nota: number | null;
  aprobado: boolean;
  fecha: string;
}

export async function obtenerResultadosCurso(cursoId: string): Promise<FilaResultadoCurso[]> {
  const [asesoras, progreso] = await Promise.all([
    listarAsesorasActivas(),
    obtenerProgresoCursoStore(cursoId),
  ]);
  const porUsuario = new Map<string, { nota: number; aprobado: boolean; fecha: string }>();
  for (const p of progreso) {
    porUsuario.set(p.usuario.trim().toUpperCase(), { nota: p.nota, aprobado: p.aprobado, fecha: formatFecha(p.fecha) });
  }
  return asesoras.map((a) => {
    const r = porUsuario.get(a.usuario.trim().toUpperCase());
    return {
      usuario: a.usuario, nombre: a.nombre, hizo: !!r,
      nota: r ? r.nota : null, aprobado: r ? r.aprobado : false, fecha: r ? r.fecha : "",
    };
  });
}

/* ── Base de conocimiento ── */

export type TemaBase = BaseRow;

export async function listarBase(): Promise<TemaBase[]> {
  return listarBaseStore();
}
export async function crearTemaBase(tema: string, info: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tema.trim()) return { ok: false, error: "El tema es obligatorio." };
  try { await crearBaseStore(tema.trim(), info.trim()); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error" }; }
}
export async function eliminarTemaBase(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try { await eliminarBaseStore(id); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error" }; }
}

/* ── Progreso / leaderboard (admin) ── */

export interface LeaderboardEntry { usuario: string; nombre: string; completados: number; aprobados: number; promedio: number }

export async function obtenerLeaderboard(): Promise<LeaderboardEntry[]> {
  const [asesoras, progreso] = await Promise.all([listarAsesorasActivas(), todoElProgresoStore()]);
  const nombre = new Map(asesoras.map((a) => [a.usuario.trim().toUpperCase(), a.nombre]));
  const acc = new Map<string, { completados: number; aprobados: number; suma: number }>();
  for (const p of progreso) {
    const u = p.usuario.trim().toUpperCase();
    const e = acc.get(u) ?? { completados: 0, aprobados: 0, suma: 0 };
    e.completados += 1;
    if (p.aprobado) e.aprobados += 1;
    e.suma += p.nota;
    acc.set(u, e);
  }
  const out: LeaderboardEntry[] = [];
  for (const [u, e] of acc) {
    out.push({
      usuario: u, nombre: nombre.get(u) ?? u, completados: e.completados,
      aprobados: e.aprobados, promedio: e.completados ? Math.round(e.suma / e.completados) : 0,
    });
  }
  out.sort((a, b) => b.aprobados - a.aprobados || b.promedio - a.promedio);
  return out;
}

/* ===================== ASESORA ===================== */

export interface PanelCursos {
  pendientes: { id: string; titulo: string; descripcion: string; numPreguntas: number }[];
  realizados: { id: string; titulo: string; nota: number; aprobado: boolean; fecha: string }[];
  racha: number;
}

export async function obtenerPanelCursos(usuario: string): Promise<PanelCursos> {
  const [cursos, progreso] = await Promise.all([
    listarCursos(),
    obtenerProgresoUsuarioStore(usuario),
  ]);
  const activos = cursos.filter((c) => c.activo);
  const hechoPorId = new Map(progreso.map((p) => [p.cursoId, p]));
  const pendientes: PanelCursos["pendientes"] = [];
  const realizados: PanelCursos["realizados"] = [];
  for (const c of activos) {
    const p = hechoPorId.get(c.id);
    if (p) realizados.push({ id: c.id, titulo: c.titulo, nota: p.nota, aprobado: p.aprobado, fecha: formatFecha(p.fecha) });
    else pendientes.push({ id: c.id, titulo: c.titulo, descripcion: c.descripcion, numPreguntas: c.numPreguntas });
  }
  // Racha simple: días distintos con al menos un curso presentado.
  const dias = new Set(progreso.map((p) => (p.fecha || "").slice(0, 10)).filter(Boolean));
  return { pendientes, realizados, racha: dias.size };
}

export interface CursoDetalle {
  id: string;
  titulo: string;
  descripcion: string;
  contenido: string;
  umbral: number;
  numPreguntas: number;
  yaPresentado: boolean;
}

export async function abrirCurso(usuario: string, cursoId: string): Promise<{ ok: true; data: CursoDetalle } | { ok: false; error: string }> {
  const c = await obtenerCursoStore(cursoId);
  if (!c || !c.activo) return { ok: false, error: "Este curso no está disponible." };
  const prog = await obtenerProgresoUnoStore(usuario, cursoId);
  return {
    ok: true,
    data: {
      id: c.id, titulo: c.titulo, descripcion: c.descripcion, contenido: c.contenido,
      umbral: c.umbral, numPreguntas: c.numPreguntas, yaPresentado: !!prog,
    },
  };
}

interface PreguntaConClave {
  num: number;
  id: string;
  pregunta: string;
  opciones: { letra: Letra; texto: string }[];
  correcta: Letra;
  explicacion: string;
}

async function leerPreguntas(cursoId: string): Promise<PreguntaConClave[]> {
  const filas = await leerPreguntasStore(cursoId);
  const out = filas.map((r, idx) => {
    const vals: Record<Letra, string> = { A: r.opcionA, B: r.opcionB, C: r.opcionC, D: r.opcionD } as Record<Letra, string>;
    const opciones: { letra: Letra; texto: string }[] = [];
    (["A", "B", "C", "D"] as Letra[]).forEach((l) => {
      const t = (vals[l] ?? "").trim();
      if (t) opciones.push({ letra: l, texto: t });
    });
    return { num: r.num || idx + 1, id: r.idPregunta, pregunta: r.pregunta, opciones, correcta: r.correcta, explicacion: r.explicacion };
  });
  out.sort((a, b) => a.num - b.num);
  return out;
}

export interface ExamenParaPresentar {
  curso: { id: string; titulo: string };
  preguntas: { id: string; pregunta: string; opciones: { letra: Letra; texto: string }[] }[];
}

export async function iniciarExamen(usuario: string, cursoId: string): Promise<{ ok: true; data: ExamenParaPresentar } | { ok: false; error: string }> {
  const c = await obtenerCursoStore(cursoId);
  if (!c || !c.activo) return { ok: false, error: "Este curso no está disponible." };
  if (await obtenerProgresoUnoStore(usuario, cursoId)) return { ok: false, error: "Ya presentaste el examen de este curso." };
  const preguntas = await leerPreguntas(cursoId);
  if (preguntas.length === 0) return { ok: false, error: "Este curso no tiene examen." };
  return { ok: true, data: { curso: { id: c.id, titulo: c.titulo }, preguntas: preguntas.map((p) => ({ id: p.id, pregunta: p.pregunta, opciones: p.opciones })) } };
}

export async function verificarRespuesta(cursoId: string, idPregunta: string, letra: Letra): Promise<{ ok: true; correcta: boolean; letraCorrecta: Letra } | { ok: false; error: string }> {
  const preguntas = await leerPreguntas(cursoId);
  const p = preguntas.find((x) => x.id === idPregunta);
  if (!p) return { ok: false, error: "Pregunta no válida." };
  return { ok: true, correcta: letra === p.correcta, letraCorrecta: p.correcta };
}

export interface ResultadoExamen {
  aciertos: number;
  total: number;
  porcentaje: number;
  resultado: "APROBADO" | "NO APROBADO";
  errores: number;
}

export async function finalizarExamen(usuario: string, cursoId: string, respuestas: Record<string, Letra>): Promise<{ ok: true; data: ResultadoExamen } | { ok: false; error: string }> {
  const c = await obtenerCursoStore(cursoId);
  if (!c) return { ok: false, error: "Este curso no existe." };

  const previo = await obtenerProgresoUnoStore(usuario, cursoId);
  if (previo) {
    return { ok: true, data: { aciertos: 0, total: c.numPreguntas, porcentaje: previo.nota, resultado: previo.aprobado ? "APROBADO" : "NO APROBADO", errores: 0 } };
  }

  const preguntas = await leerPreguntas(cursoId);
  if (preguntas.length === 0) return { ok: false, error: "Este curso no tiene examen." };

  const respuestasPorNum: Record<number, Letra | ""> = {};
  const correctasPorNum: { correcta: Letra }[] = [];
  preguntas.forEach((p, idx) => {
    respuestasPorNum[idx + 1] = (respuestas[p.id] ?? "") as Letra | "";
    correctasPorNum.push({ correcta: p.correcta });
  });
  const cal = calificar(correctasPorNum, respuestasPorNum, c.umbral);

  await guardarProgresoStore({ usuario, cursoId, nota: cal.porcentaje, aprobado: cal.resultado === "APROBADO" });

  return { ok: true, data: { aciertos: cal.aciertos, total: cal.total, porcentaje: cal.porcentaje, resultado: cal.resultado, errores: cal.total - cal.aciertos } };
}

export async function obtenerMiProgreso(usuario: string): Promise<{ completados: number; aprobados: number; promedio: number; racha: number }> {
  const progreso = await obtenerProgresoUsuarioStore(usuario);
  const completados = progreso.length;
  const aprobados = progreso.filter((p) => p.aprobado).length;
  const promedio = completados ? Math.round(progreso.reduce((s, p) => s + p.nota, 0) / completados) : 0;
  const dias = new Set(progreso.map((p) => (p.fecha || "").slice(0, 10)).filter(Boolean));
  return { completados, aprobados, promedio, racha: dias.size };
}
