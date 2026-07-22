import "server-only";
import { readRange, appendRow, updateRange, formatSheetDate } from "@/lib/sheets";
import { enviarCorreoMasivo } from "@/lib/mailer";
import { correoRecordatorioModulos } from "@/lib/emailTemplates";

function sheetId(): string {
  const id = process.env.SHEET_ID_QUIZ;
  if (!id) throw new Error("Falta la variable SHEET_ID_QUIZ");
  return id;
}

function texto(row: unknown[], idx: number): string {
  return (row[idx] ?? "").toString();
}

export type FilaObjeto = Record<string, string>;

function filasAObjetos(data: unknown[][]): FilaObjeto[] {
  const [headers, ...rows] = data;
  if (!headers) return [];
  return rows.map((row) => {
    const obj: FilaObjeto = {};
    headers.forEach((h, i) => {
      const clave = texto([h], 0);
      obj[clave] = i === 0 ? texto(row, i).trim() : texto(row, i);
    });
    return obj;
  });
}

function numeroONaN(valor: unknown): number {
  if (typeof valor === "number") return valor;
  return parseFloat((valor ?? "").toString());
}

/* ===================== */
/* PERFIL */
/* ===================== */

export interface Perfil {
  nombre: string;
  email: string;
  rol: string;
}

export async function obtenerPerfil(usuario: string): Promise<Perfil | null> {
  const id = sheetId();
  const data = await readRange(id, "USUARIOS");
  const uNorm = usuario.trim().toLowerCase();
  const row = data.slice(1).find((r) => texto(r, 2).trim().toLowerCase() === uNorm);
  if (!row) return null;
  return { nombre: texto(row, 1), email: texto(row, 2), rol: texto(row, 4) };
}

/* ===================== */
/* DATOS DEL ASESOR */
/* ===================== */

export interface HistorialItem {
  idItem: string;
  fecha: string;
  nota: number;
}

export interface DatosCompletos {
  nombre: string;
  email: string;
  asignadosCursos: string[];
  asignadosSims: string[];
  historial: HistorialItem[];
  todosLosCursos: FilaObjeto[];
  todasLasSims: FilaObjeto[];
}

export async function obtenerDatosCompletos(email: string): Promise<DatosCompletos | null> {
  const id = sheetId();
  const [usuarios, cursosRaw, simsRaw, progresoRaw] = await Promise.all([
    readRange(id, "USUARIOS"),
    readRange(id, "CURSOS"),
    readRange(id, "SIMULACIONES"),
    readRange(id, "PROGRESO", { unformatted: true }),
  ]);

  const eNorm = email.trim().toLowerCase();
  const user = usuarios.slice(1).find((r) => texto(r, 2).trim().toLowerCase() === eNorm);
  if (!user) return null;

  const asignadosCursos = texto(user, 6)
    ? texto(user, 6).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const asignadosSims = texto(user, 7)
    ? texto(user, 7).split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const todosLosCursos = filasAObjetos(cursosRaw);
  const todasLasSims = filasAObjetos(simsRaw);

  const historial: HistorialItem[] = progresoRaw
    .slice(1)
    .filter((r) => texto(r, 1).trim().toLowerCase() === eNorm)
    .map((h) => {
      const notaExamen = numeroONaN(h[4]);
      const notaIA = numeroONaN(h[6]);
      const valorNota = !isNaN(notaExamen) ? notaExamen : !isNaN(notaIA) ? notaIA : 0;
      const notaFinal = valorNota > 1 ? valorNota / 100 : valorNota;
      return {
        idItem: texto(h, 2),
        fecha: formatSheetDate(h[3], "dd/MM/yyyy HH:mm:ss"),
        nota: notaFinal,
      };
    });

  return {
    nombre: texto(user, 1),
    email: texto(user, 2),
    asignadosCursos,
    asignadosSims,
    historial,
    todosLosCursos,
    todasLasSims,
  };
}

/* ===================== */
/* EXÁMENES */
/* ===================== */

export type Pregunta = Record<string, string>;

export async function obtenerPreguntas(idCurso: string): Promise<Pregunta[]> {
  const id = sheetId();
  const data = await readRange(id, "EXAMENES");
  const [headers, ...rows] = data;
  if (!headers) return [];

  return rows
    .filter((r) => texto(r, 1).trim() === idCurso.trim())
    .map((row) => {
      const obj: Pregunta = {};
      headers.forEach((h, i) => {
        obj[texto([h], 0)] = texto(row, i);
      });
      return obj;
    });
}

export async function guardarResultado(
  email: string,
  idItem: string,
  nota: number,
  errores = ""
): Promise<void> {
  const id = sheetId();
  const cleanId = idItem.trim();
  await appendRow(id, "PROGRESO!A:H", [
    Date.now(),
    email,
    cleanId,
    new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }),
    nota / 100,
    1,
    "",
    errores,
  ]);
}

/* ===================== */
/* SIMULACIONES / IA */
/* ===================== */

async function obtenerBasePorMensaje(mensajeUsuario: string): Promise<string> {
  const id = sheetId();
  const data = await readRange(id, "BASE-CONOCIMIENTO");
  const rows = data.slice(1);
  const msg = (mensajeUsuario || "").toLowerCase();

  let resultados = rows.filter(
    (f) => texto(f, 0).toLowerCase().includes(msg) || texto(f, 1).toLowerCase().includes(msg)
  );
  if (resultados.length === 0) resultados = rows.slice(0, 2);

  return resultados.map((f) => `TEMA: ${texto(f, 0)}\nINFO: ${texto(f, 1)}`).join("\n\n");
}

async function guardarNotaIA(email: string, idSimulacion: string, notaIA: number): Promise<void> {
  const id = sheetId();
  const cleanId = idSimulacion.trim();
  await appendRow(id, "PROGRESO!A:H", [
    Date.now(),
    email,
    cleanId,
    new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }),
    "",
    1,
    notaIA / 100,
  ]);
}

export interface MensajeIA {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function hablarConIA(
  mensajeUsuario: string,
  idSimulacion: string,
  historialAnterior: MensajeIA[],
  emailUsuario?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "Error: API Key de OpenAI no configurada";

  const msg = mensajeUsuario && mensajeUsuario.trim() !== "" ? mensajeUsuario : "inicia la conversación como usuario afiliado";

  const id = sheetId();
  const data = await readRange(id, "SIMULACIONES");
  const fila = data.find((r) => texto(r, 0).trim() === idSimulacion.trim());
  if (!fila) return "Error: No se encontró la simulación.";

  const promptBase = texto(fila, 3);
  const criterios = texto(fila, 4);

  let base = "";
  try {
    base = await obtenerBasePorMensaje(msg);
  } catch {
    base = "";
  }

  const promptSistema = `
${promptBase}

Eres un usuario afiliado a COFREM.

COMPORTAMIENTO:
- Haces preguntas sobre servicios, subsidios y beneficios
- Puedes hacer varias preguntas en una misma intervención
- Eres exigente, quieres respuestas claras
- Si el asesor responde mal, cuestionas
- No respondes como asesor

BASE DE CONOCIMIENTO:
${base}

REGLAS:
- Usa la base solo como referencia para preguntar
- No copies la base
- No expliques como asesor
`;

  let mensajes: MensajeIA[] = [{ role: "system", content: promptSistema }];

  if (!historialAnterior || historialAnterior.length === 0) {
    mensajes.push({
      role: "user",
      content:
        "Inicia como usuario afiliado a COFREM. Preséntate como Juan y haz una pregunta directa. Ejemplo: 'Hola, soy Juan. Me gustaría saber si puedo recibir cuota monetaria y qué requisitos debo cumplir.'",
    });
  }

  if (historialAnterior && historialAnterior.length > 0) {
    mensajes = mensajes.concat(historialAnterior);
  }

  const esEvaluacion = msg.toLowerCase().includes("evaluar");

  if (esEvaluacion) {
    mensajes.push({
      role: "system",
      content: `
Evalúa al asesor con base en:

${criterios}

Formato:

Resultado:
- ✅ / ❌ Mantiene la calma
- ✅ / ❌ Claridad
- ✅ / ❌ Precisión
- ✅ / ❌ Empatía
- ✅ / ❌ Cierre

Calificación final: (0 a 100)

Retroalimentación:
(máximo 5 líneas)
`,
    });
  } else {
    mensajes.push({ role: "user", content: msg });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: mensajes, temperature: 0.7 }),
    });
    const json = await response.json();
    const textoIA = json.choices?.[0]?.message?.content;
    if (!textoIA) return "Error de conexión con IA";

    if (esEvaluacion) {
      const match = textoIA.match(/Calificación final:\s*(\d+)/i);
      const nota = match ? parseInt(match[1], 10) : null;
      if (nota !== null) {
        await guardarNotaIA(emailUsuario || "test@correo.com", idSimulacion, nota);
      }
    }

    return textoIA;
  } catch {
    return "Error de conexión con IA";
  }
}

/* ===================== */
/* PRESENCIA / PING */
/* ===================== */

export async function actualizarPingConexion(email: string): Promise<void> {
  const id = sheetId();
  const data = await readRange(id, "USUARIOS");
  const eNorm = email.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (texto(data[i], 2).trim().toLowerCase() === eNorm) {
      await updateRange(id, `USUARIOS!I${i + 1}`, [
        [new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" })],
      ]);
      return;
    }
  }
}

/* ===================== */
/* ADMIN */
/* ===================== */

export interface AsesorAdmin {
  nombre: string;
  email: string;
  rol: string;
  modulos: string;
  simulaciones: string;
  ultimaConexion: string | null;
}

export interface ProgresoAdmin {
  email: string;
  idItem: string;
  fecha: string;
  nota: number;
  errores: string;
}

export interface DatosAdmin {
  stats: { totalAsesores: number; promedioGeneral: string; totalCompletados: number };
  asesores: AsesorAdmin[];
  progreso: ProgresoAdmin[];
}

export async function obtenerDatosAdmin(): Promise<DatosAdmin> {
  const id = sheetId();
  const [usuarios, progreso] = await Promise.all([
    readRange(id, "USUARIOS", { unformatted: true }),
    readRange(id, "PROGRESO", { unformatted: true }),
  ]);

  const listaAsesores: AsesorAdmin[] = usuarios
    .slice(1)
    .filter((u) => texto(u, 4).trim().toLowerCase() === "asesor")
    .map((u) => ({
      nombre: texto(u, 1),
      email: texto(u, 2),
      rol: texto(u, 4),
      modulos: texto(u, 6),
      simulaciones: texto(u, 7),
      ultimaConexion: u[8] ? formatSheetDate(u[8], "dd/MM/yyyy HH:mm:ss") : null,
    }));

  const historialProgreso: ProgresoAdmin[] = progreso.slice(1).map((p) => {
    const notaExamen = numeroONaN(p[4]);
    const notaIA = numeroONaN(p[6]);
    const valorNota = !isNaN(notaExamen) ? notaExamen : !isNaN(notaIA) ? notaIA : 0;
    return {
      email: texto(p, 1),
      idItem: texto(p, 2),
      fecha: formatSheetDate(p[3], "dd/MM/yyyy HH:mm:ss"),
      nota: valorNota,
      errores: texto(p, 7),
    };
  });

  const totalAsesores = listaAsesores.length;
  const notas = historialProgreso.map((p) => p.nota).filter((n) => !isNaN(n));
  const promedioGeneral = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
  const totalCompletados = historialProgreso.length;

  return {
    stats: {
      totalAsesores,
      promedioGeneral: (promedioGeneral * 100).toFixed(1) + "%",
      totalCompletados,
    },
    asesores: listaAsesores,
    progreso: historialProgreso,
  };
}

export async function asignarModulosUsuario(
  email: string,
  cursos: string,
  sims: string
): Promise<boolean> {
  const id = sheetId();
  const data = await readRange(id, "USUARIOS");
  const eNorm = email.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (texto(data[i], 2).trim().toLowerCase() === eNorm) {
      await Promise.all([
        updateRange(id, `USUARIOS!G${i + 1}`, [[cursos]]),
        updateRange(id, `USUARIOS!H${i + 1}`, [[sims]]),
      ]);
      return true;
    }
  }
  return false;
}

export async function enviarCorreoGeneral(): Promise<{ enviados: number }> {
  const id = sheetId();
  const data = await readRange(id, "USUARIOS");
  const headers = data[0];
  if (!headers) throw new Error("La hoja USUARIOS está vacía");

  const colEmail = headers.findIndex((h) => (h ?? "").toString() === "EMAIL");
  const colModulos = headers.findIndex((h) => (h ?? "").toString() === "MODULOS_ASIGNADOS");
  const colEstado = headers.findIndex((h) => (h ?? "").toString() === "ESTADO");

  if (colEmail === -1 || colModulos === -1 || colEstado === -1) {
    throw new Error("Faltan columnas EMAIL, MODULOS_ASIGNADOS o ESTADO en la hoja USUARIOS");
  }

  const correos: string[] = [];
  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const email = texto(fila, colEmail);
    const modulos = texto(fila, colModulos);
    const estado = texto(fila, colEstado);
    if (email && modulos && estado === "Activo") correos.push(email);
  }

  if (correos.length === 0) return { enviados: 0 };

  await enviarCorreoMasivo(
    correos,
    "Recordatorio de módulos pendientes - Du AcademyPro",
    correoRecordatorioModulos()
  );

  return { enviados: correos.length };
}
