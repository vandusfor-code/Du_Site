import "server-only";
import { readRange, appendRows, updateRange, asegurarHoja } from "@/lib/sheets";
import { parseArchivoPqrsf } from "@/lib/documental-parse";
import type { DashboardDocumental, RegistroDoc } from "@/app/admin/documental/tipos";

// Columnas de resultado IA/auditoría que deben existir en la hoja destino
// (se agregan al final del encabezado si faltan; no duplican las del usuario).
const COLUMNAS_EXTRA = [
  "ID Auditoría", "Fecha de carga", "Origen respuesta", "Puntaje ortografía", "Puntaje redacción",
  "Puntaje claridad", "Puntaje coherencia", "Puntaje general", "Cantidad errores", "Errores detectados",
  "Corrección sugerida", "Explicación", "Puntaje correspondencia", "Estado correspondencia",
  "Hallazgo correspondencia", "Estado auditoría",
];

// ============================================================
// Auditoría Documental — pipeline de importación PQRSF.
// Parsea el archivo (.xls HTML), valida columnas, evita duplicados por
// Radicado, analiza con IA (ortografía + correspondencia, separando origen
// People/Cofrem) y guarda en la hoja AUDITORIAS_DOCUMENTALES + un registro
// de historial de importación. No toca ninguna otra fuente.
// ============================================================

function sheetId(): string {
  return process.env.SHEET_ID_AUDITORIAS_DOC || "18CFznINyzUOoQYUm9Hmh5chFP91Ej2TEtImUVqQQ03g";
}
function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Falta la variable GEMINI_API_KEY para el análisis con IA (Gemini 2.5 Flash).");
  return k;
}

const TAB_REGISTROS = "Audtoria_documental"; // pestaña real (nombre tal cual en la hoja)
const TAB_HISTORIAL = "Historial_importaciones";
const MODELO = "gemini-2.5-flash";
const TOPE_REGISTROS = 120; // máximo por carga (protección de tiempo/costo)
const CONCURRENCIA = 6; // análisis IA en paralelo por lote (para caber en el límite de tiempo)

// Columnas que deben venir en el archivo para poder auditar.
const COLUMNAS_CRITICAS = [
  "Radicado", "Fecha de Recibido", "Tipo de Solicitud", "Estado",
  "Doc. Trabajador", "Trabajador", "Medio de Presentacion",
  "Radicador", "Comunicador", "Descripcion", "Respuesta",
];

function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function col(fila: Record<string, string>, nombre: string): string {
  return (fila[nombre] ?? "").trim();
}

export interface ResultadoAnalisis {
  origen: "PEOPLE" | "COFREM" | "OTRO";
  ortografia: number; redaccion: number; claridad: number; coherencia: number; general: number;
  cantidadErrores: number; erroresDetectados: string; correccion: string; explicacion: string;
  correspondencia: number; estadoCorrespondencia: string; hallazgo: string;
}

// Análisis con Google Gemini 2.5 Flash (REST). Se pide salida JSON directa y se
// desactiva el "thinking" (thinkingBudget 0) para minimizar latencia/costo por
// registro, ya que se procesan varios PQR por carga.
async function llamarGemini(prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey() },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (res.status === 429 || res.status === 503) { await new Promise((r) => setTimeout(r, intento * 1500)); continue; }
      if (!res.ok) return null;
      const json = await res.json();
      const parts = json?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return null;
      return parts.map((p: { text?: string }) => p?.text ?? "").join("") || null;
    } catch { if (intento < 3) await new Promise((r) => setTimeout(r, intento * 1200)); }
  }
  return null;
}

function extraerJson<T>(texto: string): T | null {
  try {
    const limpio = texto.replace(/```json|```/g, "").trim();
    const m = limpio.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : limpio) as T;
  } catch { return null; }
}

async function analizar(fila: Record<string, string>): Promise<ResultadoAnalisis> {
  const descripcion = col(fila, "Descripcion");
  const respuesta = col(fila, "Respuesta");
  const prompt = `Eres analista de calidad documental de People BPO (gestión de PQRSF para Cofrem).

Contexto del radicado:
- Radicador: ${col(fila, "Radicador") || "N/D"}
- Comunicador: ${col(fila, "Comunicador") || "N/D"}
- Medio de presentación: ${col(fila, "Medio de Presentacion") || "N/D"}
- Dirigido a: ${col(fila, "Dirigido a") || "N/D"}
- Estado: ${col(fila, "Estado") || "N/D"}

TEXTO DE LA SOLICITUD (redactado por el usuario, NO por People):
"""${descripcion.slice(0, 3000)}"""

TEXTO DE LA RESPUESTA (puede haber sido redactado por People, por Cofrem u otro):
"""${respuesta.slice(0, 3000)}"""

TAREAS:
1) Determina el ORIGEN de la RESPUESTA (quién la redactó): "PEOPLE", "COFREM" u "OTRO". Usa el contexto (radicador/comunicador/medio). No atribuyas a People un texto que claramente no gestionó People.
2) Evalúa la calidad ORTOGRÁFICA y de REDACCIÓN de la RESPUESTA (ortografía, gramática, tildes, puntuación, redacción, claridad, coherencia, tipográficos, palabras unidas). Puntajes 0-100.
3) Compara semánticamente la SOLICITUD vs la RESPUESTA: ¿la respuesta atiende realmente lo solicitado? Da puntaje 0-100 y estado CORRESPONDE / CORRESPONDE_PARCIALMENTE / NO_CORRESPONDE / NO_EVALUABLE.

Reglas: nunca inventes errores. Si la respuesta está vacía o es "NO_EVALUABLE", refléjalo. No penalices distorsiones del sistema.

Responde ÚNICAMENTE con JSON válido:
{
 "origen_respuesta": "PEOPLE|COFREM|OTRO",
 "puntaje_ortografia": 0-100,
 "puntaje_redaccion": 0-100,
 "puntaje_claridad": 0-100,
 "puntaje_coherencia": 0-100,
 "cantidad_errores": entero,
 "errores_detectados": "texto breve con los errores, o 'Ninguno'",
 "correccion_sugerida": "versión corregida de la respuesta, o '' si no aplica",
 "explicacion": "explicación lingüística breve, o ''",
 "puntaje_correspondencia": 0-100,
 "estado_correspondencia": "CORRESPONDE|CORRESPONDE_PARCIALMENTE|NO_CORRESPONDE|NO_EVALUABLE",
 "hallazgo_correspondencia": "hallazgo breve"
}`;

  const fallback: ResultadoAnalisis = {
    origen: "OTRO", ortografia: 0, redaccion: 0, claridad: 0, coherencia: 0, general: 0,
    cantidadErrores: 0, erroresDetectados: "Análisis no disponible", correccion: "", explicacion: "",
    correspondencia: 0, estadoCorrespondencia: "NO_EVALUABLE", hallazgo: "",
  };
  if (!respuesta) return { ...fallback, estadoCorrespondencia: "NO_EVALUABLE", erroresDetectados: "Sin respuesta registrada" };

  const raw = await llamarGemini(prompt);
  if (!raw) return fallback;
  const j = extraerJson<Record<string, unknown>>(raw);
  if (!j) return fallback;

  const num = (v: unknown) => { const n = parseFloat(String(v)); return isNaN(n) ? 0 : Math.round(n); };
  const ortografia = num(j.puntaje_ortografia);
  const redaccion = num(j.puntaje_redaccion);
  const claridad = num(j.puntaje_claridad);
  const coherencia = num(j.puntaje_coherencia);
  const general = Math.round((ortografia + redaccion + claridad + coherencia) / 4);
  const origenRaw = String(j.origen_respuesta ?? "OTRO").toUpperCase();
  const origen: ResultadoAnalisis["origen"] = origenRaw.includes("PEOPLE") ? "PEOPLE" : origenRaw.includes("COFREM") ? "COFREM" : "OTRO";

  return {
    origen, ortografia, redaccion, claridad, coherencia, general,
    cantidadErrores: num(j.cantidad_errores),
    erroresDetectados: String(j.errores_detectados ?? ""),
    correccion: String(j.correccion_sugerida ?? ""),
    explicacion: String(j.explicacion ?? ""),
    correspondencia: num(j.puntaje_correspondencia),
    estadoCorrespondencia: String(j.estado_correspondencia ?? "NO_EVALUABLE").toUpperCase(),
    hallazgo: String(j.hallazgo_correspondencia ?? ""),
  };
}

/* ── Mapa de valores por registro (claves normalizadas) para escribir según
   los encabezados REALES de la hoja destino, sin asumir su orden. ── */
function valoresRegistro(fila: Record<string, string>, a: ResultadoAnalisis, audId: string, fechaCarga: string): Map<string, string> {
  const estadoAud = a.cantidadErrores > 0 || a.estadoCorrespondencia === "NO_CORRESPONDE" ? "Revisar" : "Sin novedades";
  const pares: [string, string][] = [
    ["id auditoria", audId],
    ["radicado", col(fila, "Radicado")],
    ["fecha de carga", fechaCarga], ["fecha carga", fechaCarga],
    ["fecha de recibido", col(fila, "Fecha de Recibido")], ["fecha recibido", col(fila, "Fecha de Recibido")],
    ["fecha respuesta programada", col(fila, "Fecha Respuesta Programada")],
    ["fecha de respuesta", col(fila, "Fecha de Respuesta")], ["fecha respuesta", col(fila, "Fecha de Respuesta")],
    ["fecha de reparto", col(fila, "Fecha de reparto")], ["fecha reparto", col(fila, "Fecha de reparto")],
    ["fecha de comunicacion", col(fila, "Fecha de comunicacion")], ["fecha comunicacion", col(fila, "Fecha de comunicacion")],
    ["tipo de solicitud", col(fila, "Tipo de Solicitud")], ["tipo solicitud", col(fila, "Tipo de Solicitud")],
    ["dirigido a", col(fila, "Dirigido a")],
    ["estado", col(fila, "Estado")], ["estado pqr", col(fila, "Estado")],
    ["clasificacion", col(fila, "Clasificacion")],
    ["doc trabajador", col(fila, "Doc. Trabajador")], ["documento trabajador", col(fila, "Doc. Trabajador")],
    ["trabajador", col(fila, "Trabajador")],
    ["empresa", col(fila, "Empresa")],
    ["medio de presentacion", col(fila, "Medio de Presentacion")], ["medio presentacion", col(fila, "Medio de Presentacion")],
    ["doc recibe", col(fila, "Doc. Recibe")],
    ["radicador", col(fila, "Radicador")],
    ["comunicador", col(fila, "Comunicador")],
    ["descripcion", col(fila, "Descripcion")], ["solicitud original", col(fila, "Descripcion")],
    ["respuesta", col(fila, "Respuesta")], ["respuesta original", col(fila, "Respuesta")],
    ["comunicacion", col(fila, "Comunicacion")], ["comunicación", col(fila, "Comunicacion")],
    ["telefono", col(fila, "Telefono")], ["direccion", col(fila, "Direccion")],
    ["correo electronico", col(fila, "Correo electronico")], ["barrio", col(fila, "Barrio")], ["municipio", col(fila, "Municipio")],
    // Resultados IA
    ["origen respuesta", a.origen],
    ["puntaje ortografia", String(a.ortografia)], ["puntaje redaccion", String(a.redaccion)],
    ["puntaje claridad", String(a.claridad)], ["puntaje coherencia", String(a.coherencia)],
    ["puntaje general", String(a.general)], ["calidad", String(a.general)], ["puntaje", String(a.general)],
    ["cantidad errores", String(a.cantidadErrores)], ["errores", String(a.cantidadErrores)],
    ["errores detectados", a.erroresDetectados], ["correccion sugerida", a.correccion], ["explicacion", a.explicacion],
    ["puntaje correspondencia", String(a.correspondencia)], ["estado correspondencia", a.estadoCorrespondencia],
    ["hallazgo correspondencia", a.hallazgo],
    ["estado auditoria", estadoAud], ["estado documental", estadoAud], ["novedad", estadoAud],
  ];
  return new Map(pares.map(([k, v]) => [norm(k), v]));
}

export interface ResultadoImportacion {
  audId: string;
  archivo: string;
  encontrados: number;
  nuevos: number;
  duplicados: number;
  procesados: number;
  conErrores: number;
  sinNovedades: number;
  requierenRevision: number;
  promedioCalidad: number;
  asesoras: number;
  columnasFaltantes: string[];
  camposNoGuardados: string[];
}

export async function procesarArchivoPqrsf(contenido: string, nombreArchivo: string, usuario: string): Promise<ResultadoImportacion> {
  const parseado = parseArchivoPqrsf(contenido);

  // Validación de columnas críticas.
  const headersNorm = new Set(parseado.headers.map(norm));
  const faltantes = COLUMNAS_CRITICAS.filter((c) => !headersNorm.has(norm(c)));
  if (faltantes.length > 0) {
    throw new Error(`Faltan columnas críticas en el archivo: ${faltantes.join(", ")}.`);
  }

  const id = sheetId();
  await asegurarHoja(id, TAB_HISTORIAL, [
    "ID auditoría", "Fecha/hora carga", "Archivo", "Usuario", "Registros encontrados", "Nuevos",
    "Duplicados", "Procesados", "Con errores", "Sin novedades", "Requieren revisión",
    "Promedio calidad", "Asesoras", "Estado",
  ]);

  // Asegura la pestaña de registros y sus encabezados base (si está vacía).
  await asegurarHoja(id, TAB_REGISTROS, ["Radicado"]);
  const registrosExistentes = await readRange(id, `${TAB_REGISTROS}!A:BZ`);
  let headersHoja: string[] = (registrosExistentes[0] ?? []).map((h) => String(h ?? "")).filter((h) => h.trim() !== "");

  // Garantiza que existan las columnas de resultado IA/auditoría.
  const faltantesExtra = COLUMNAS_EXTRA.filter((c) => !headersHoja.some((h) => norm(h) === norm(c)));
  if (faltantesExtra.length > 0) {
    headersHoja = [...headersHoja, ...faltantesExtra];
    await updateRange(id, `${TAB_REGISTROS}!1:1`, [headersHoja]);
  }
  const headersHojaNorm = headersHoja.map(norm);
  const idxRadicadoHoja = headersHojaNorm.findIndex((h) => h === "radicado");

  const radicadosExistentes = new Set<string>();
  if (idxRadicadoHoja >= 0) {
    for (let i = 1; i < registrosExistentes.length; i++) {
      const r = String(registrosExistentes[i]?.[idxRadicadoHoja] ?? "").trim();
      if (r) radicadosExistentes.add(r);
    }
  }

  const fechaCarga = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" });
  const audId = `AUD-${fechaCarga.slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;

  // Filas nuevas (dedupe por Radicado) con tope de seguridad.
  const nuevasFilas = parseado.filas.filter((f) => {
    const rad = col(f, "Radicado");
    return rad && !radicadosExistentes.has(rad);
  });
  const duplicados = parseado.filas.length - nuevasFilas.length;
  const aProcesar = nuevasFilas.slice(0, TOPE_REGISTROS);

  let conErrores = 0, sinNovedades = 0, sumaCalidad = 0, calidadCount = 0;
  const asesorasSet = new Set<string>();
  const camposNoGuardados = new Set<string>();
  const filasParaHoja: string[][] = [];

  // Análisis IA en lotes concurrentes (mantiene el orden de aProcesar).
  const analisis: ResultadoAnalisis[] = [];
  for (let i = 0; i < aProcesar.length; i += CONCURRENCIA) {
    const lote = aProcesar.slice(i, i + CONCURRENCIA);
    const res = await Promise.all(lote.map((f) => analizar(f)));
    analisis.push(...res);
  }

  for (let i = 0; i < aProcesar.length; i++) {
    const fila = aProcesar[i];
    const a = analisis[i];
    if (a.cantidadErrores > 0 || a.estadoCorrespondencia === "NO_CORRESPONDE") conErrores++;
    else sinNovedades++;
    if (a.general > 0) { sumaCalidad += a.general; calidadCount++; }
    const rad = col(fila, "Radicador"); if (rad) asesorasSet.add(rad);

    const valores = valoresRegistro(fila, a, audId, fechaCarga);
    filasParaHoja.push(headersHojaNorm.map((h) => valores.get(h) ?? ""));
  }

  if (filasParaHoja.length > 0) {
    await appendRows(id, `${TAB_REGISTROS}!A:BZ`, filasParaHoja);
  }

  const promedioCalidad = calidadCount > 0 ? Math.round(sumaCalidad / calidadCount) : 0;

  await appendRows(id, `${TAB_HISTORIAL}!A:N`, [[
    audId, fechaCarga, nombreArchivo, usuario, String(parseado.filas.length), String(nuevasFilas.length),
    String(duplicados), String(aProcesar.length), String(conErrores), String(sinNovedades), String(conErrores),
    String(promedioCalidad), String(asesorasSet.size), headersHoja.length > 0 ? "Completado" : "Sin encabezados en la hoja",
  ]]);

  return {
    audId, archivo: nombreArchivo,
    encontrados: parseado.filas.length, nuevos: nuevasFilas.length, duplicados,
    procesados: aProcesar.length, conErrores, sinNovedades, requierenRevision: conErrores,
    promedioCalidad, asesoras: asesorasSet.size,
    columnasFaltantes: [], camposNoGuardados: Array.from(camposNoGuardados),
  };
}

/* ── Lecturas para la UI ── */
export interface HistorialImportacion {
  audId: string; fecha: string; archivo: string; usuario: string;
  encontrados: string; nuevos: string; duplicados: string; procesados: string;
  conErrores: string; sinNovedades: string; promedioCalidad: string; asesoras: string; estado: string;
}

export async function obtenerDashboardDocumental(): Promise<DashboardDocumental> {
  const id = sheetId();
  const historial = await obtenerHistorialImportaciones();

  let data: unknown[][] = [];
  try {
    data = await readRange(id, `${TAB_REGISTROS}!A:BZ`);
  } catch {
    return { resumen: vacioResumen(), registros: [], historial };
  }
  const headers = (data[0] ?? []).map((h) => norm(String(h ?? "")));
  const idxDe = (aliases: string[]) => {
    for (const a of aliases) { const i = headers.indexOf(norm(a)); if (i >= 0) return i; }
    return -1;
  };
  const I = {
    audId: idxDe(["id auditoria"]), radicado: idxDe(["radicado"]),
    asesora: idxDe(["radicador"]), usuario: idxDe(["trabajador"]),
    tipo: idxDe(["tipo de solicitud", "tipo solicitud"]), fecha: idxDe(["fecha de recibido", "fecha recibido"]),
    fechaCarga: idxDe(["fecha de carga", "fecha carga"]), origen: idxDe(["origen respuesta"]),
    general: idxDe(["puntaje general", "calidad", "puntaje"]), errores: idxDe(["cantidad errores", "errores"]),
    estado: idxDe(["estado auditoria", "estado documental"]),
    solicitud: idxDe(["descripcion", "solicitud original"]), respuesta: idxDe(["respuesta", "respuesta original"]),
    correccion: idxDe(["correccion sugerida"]), erroresDet: idxDe(["errores detectados"]), explic: idxDe(["explicacion"]),
    orto: idxDe(["puntaje ortografia"]), redac: idxDe(["puntaje redaccion"]), clar: idxDe(["puntaje claridad"]), coher: idxDe(["puntaje coherencia"]),
    corr: idxDe(["puntaje correspondencia"]), estadoCorr: idxDe(["estado correspondencia"]), hallazgo: idxDe(["hallazgo correspondencia"]),
  };
  const cel = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  const n = (r: unknown[], i: number) => { const v = parseFloat(cel(r, i)); return isNaN(v) ? 0 : Math.round(v); };

  const registros: RegistroDoc[] = [];
  for (let k = 1; k < data.length; k++) {
    const r = data[k];
    const radicado = cel(r, I.radicado);
    if (!radicado) continue;
    const general = n(r, I.general);
    const errores = n(r, I.errores);
    const estado = cel(r, I.estado) || (errores > 0 ? "Revisar" : "Sin novedades");
    registros.push({
      audId: cel(r, I.audId), radicado,
      asesora: cel(r, I.asesora) || "Sin radicador", usuario: cel(r, I.usuario),
      tipoSolicitud: cel(r, I.tipo), fecha: cel(r, I.fecha), fechaCarga: cel(r, I.fechaCarga),
      origen: cel(r, I.origen) || "OTRO", puntaje: general, errores, estado,
      solicitudOriginal: cel(r, I.solicitud), respuestaOriginal: cel(r, I.respuesta), respuestaCorregida: cel(r, I.correccion),
      erroresDetectados: cel(r, I.erroresDet), explicacion: cel(r, I.explic),
      calidad: { ortografia: n(r, I.orto), redaccion: n(r, I.redac), claridad: n(r, I.clar), coherencia: n(r, I.coher), general },
      correspondencia: n(r, I.corr), estadoCorrespondencia: cel(r, I.estadoCorr) || "NO_EVALUABLE", hallazgo: cel(r, I.hallazgo),
    });
  }
  registros.reverse(); // más recientes primero

  const conErrores = registros.filter((x) => x.estado === "Revisar" || x.errores > 0).length;
  const sinNovedades = registros.filter((x) => x.estado === "Sin novedades" && x.errores === 0).length;
  const puntajes = registros.map((x) => x.puntaje).filter((p) => p > 0);
  const promedio = puntajes.length ? Math.round(puntajes.reduce((s, p) => s + p, 0) / puntajes.length) : 0;
  const asesoras = new Set(registros.map((x) => x.asesora).filter((a) => a && a !== "Sin radicador")).size;

  return {
    resumen: { documentosAuditados: registros.length, conErrores, promedioCalidad: promedio, sinNovedades, asesorasEvaluadas: asesoras },
    registros,
    historial,
  };
}

function vacioResumen() {
  return { documentosAuditados: 0, conErrores: 0, promedioCalidad: 0, sinNovedades: 0, asesorasEvaluadas: 0 };
}

export async function obtenerHistorialImportaciones(): Promise<HistorialImportacion[]> {
  const id = sheetId();
  try {
    const data = await readRange(id, `${TAB_HISTORIAL}!A2:N`);
    return data
      .filter((r) => String(r[0] ?? "").trim())
      .reverse()
      .map((r) => ({
        audId: String(r[0] ?? ""), fecha: String(r[1] ?? ""), archivo: String(r[2] ?? ""), usuario: String(r[3] ?? ""),
        encontrados: String(r[4] ?? ""), nuevos: String(r[5] ?? ""), duplicados: String(r[6] ?? ""), procesados: String(r[7] ?? ""),
        conErrores: String(r[8] ?? ""), sinNovedades: String(r[9] ?? ""), promedioCalidad: String(r[11] ?? ""),
        asesoras: String(r[12] ?? ""), estado: String(r[13] ?? ""),
      }));
  } catch {
    return [];
  }
}
