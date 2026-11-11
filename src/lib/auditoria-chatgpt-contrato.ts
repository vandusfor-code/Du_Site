// ============================================================
// Contrato de datos AUDITORIA_CO_V1 (ChatGPT → Du Site) + parser local.
//
// Este módulo es CLIENTE-SEGURO y PURO: no importa `server-only`, no toca
// Google Sheets, no llama a ningún servicio externo ni modelo de IA. Su único
// trabajo es interpretar el bloque JSON que ChatGPT devuelve, validarlo contra
// el esquema real del sistema y producir un objeto tipado para la vista previa.
//
// La fórmula de nota (calcularNota) replica EXACTAMENTE la regla oficial de
// calcularNotaManual() en auditorias-admin.ts (hasta 2 incumplimientos → 100 %
// OK; ≥3 → PENC con % crudo). No introduce ninguna ponderación nueva. El
// servidor sigue siendo la autoridad: al guardar se reutiliza
// guardarAuditoriaManualAction(), que recalcula la nota con la misma regla.
//
// Sintaxis "erasable-only" a propósito (sin enums ni namespaces) para que el
// runtime nativo de TypeScript de Node pueda ejecutar las pruebas unitarias
// sin transpilación ni dependencias extra.
// ============================================================

export const FORMATO_AUDITORIA_CO = "AUDITORIA_CO_V1";
export const VERSION_AUDITORIA_CO = 1;

// Valores permitidos — tomados de las opciones reales del formulario manual
// (OPCIONES_CRITERIO / OPCIONES_TUTEO en AuditoriaManualForm.tsx).
export const VALORES_CRITERIO = ["Cumple", "No cumple", "No aplica"] as const;
export const VALORES_TUTEO = ["Sin tuteo", "Tuteo leve", "Tuteo real"] as const;

export type ValorCriterio = (typeof VALORES_CRITERIO)[number];
export type ValorTuteo = (typeof VALORES_TUTEO)[number];

// Identificadores ESTABLES de criterio (iguales a las claves del formulario y
// a las columnas de Consolidado). El parser asigna por esta clave, nunca por
// la posición en que aparezca en el JSON.
export type CriterioId =
  | "saludo" | "empatia" | "sonrisa" | "claridad"
  | "encuesta" | "informacion" | "proceso" | "cierre";

export const CRITERIOS: { id: CriterioId; label: string }[] = [
  { id: "saludo", label: "Saludo" },
  { id: "empatia", label: "Empatía" },
  { id: "sonrisa", label: "Sonrisa" },
  { id: "claridad", label: "Claridad" },
  { id: "encuesta", label: "Encuesta" },
  { id: "informacion", label: "Información" },
  { id: "proceso", label: "Proceso" },
  { id: "cierre", label: "Cierre" },
];

const IDS_CRITERIO: CriterioId[] = CRITERIOS.map((c) => c.id);

// Los 6 criterios que afectan la nota (Información y Proceso NO afectan), igual
// que en auditarLlamada() y calcularNotaManual().
const CRITERIOS_PARA_NOTA: CriterioId[] = ["saludo", "empatia", "sonrisa", "claridad", "encuesta", "cierre"];

// Objeto de salida: mismas claves que AuditoriaManualInput (de auditorias-admin.ts),
// para que el cliente lo pase tal cual a guardarAuditoriaManualAction() sin
// reinterpretar nada.
export interface DatosImportados {
  fecha: string;
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
  observacion: string;
  hallazgos: string;
  mejora: string;
  estado: string;
  grabacion: string;
  tipoConsulta: string;
  puntajeTuteo: string;
}

export type Severidad = "error" | "advertencia";

// Estados que el sistema debe poder distinguir (requisito del contrato):
// - obligatorio_ausente: falta un dato obligatorio.
// - opcional_ausente:    falta un dato opcional (informativo, no bloquea).
// - valor_no_permitido:  un valor fuera del dominio permitido.
// - criterio_desconocido: una clave de criterio que no existe en el sistema.
// - fecha_invalida:      fecha con formato o valor imposible.
// - nota_inconsistente:  la nota/clasificación propuesta por ChatGPT no coincide
//                        con la calculada por la regla oficial (informativo).
// - criterio_no_aplica:  un criterio quedó en "No aplica" (requiere revisión).
export type CodigoDiagnostico =
  | "json_malformado"
  | "json_reparado"
  | "no_es_objeto"
  | "formato_invalido"
  | "version_desconocida"
  | "obligatorio_ausente"
  | "opcional_ausente"
  | "valor_no_permitido"
  | "criterio_desconocido"
  | "fecha_invalida"
  | "nota_inconsistente"
  | "criterio_no_aplica";

export interface Diagnostico {
  severidad: Severidad;
  codigo: CodigoDiagnostico;
  campo: string;
  mensaje: string;
}

export interface ResultadoParseo {
  /** true si no hay diagnósticos de severidad "error" (puede pasar a guardado). */
  ok: boolean;
  /** Objeto mapeado "mejor esfuerzo"; null solo si el JSON no se pudo parsear. */
  datos: DatosImportados | null;
  /** Evidencia textual por criterio (clave = CriterioId). */
  evidencias: Record<string, string>;
  diagnosticos: Diagnostico[];
  /** Nota según la regla oficial (autoridad para guardar). */
  notaCalculada: { nota: number; tipoNota: string } | null;
  /** Nota propuesta por ChatGPT (solo informativa). */
  notaPropuesta: number | null;
  /** Clasificación propuesta por ChatGPT (solo informativa). */
  clasificacionPropuesta: string | null;
}

// Regla oficial de nota — réplica exacta de calcularNotaManual(). No cambiar
// sin autorización explícita.
export function calcularNota(c: {
  saludo: string; empatia: string; sonrisa: string; claridad: string; encuesta: string; cierre: string;
}): { nota: number; tipoNota: string } {
  const vals = [c.saludo, c.empatia, c.sonrisa, c.claridad, c.encuesta, c.cierre].filter((v) => v !== "No aplica");
  const total = vals.length;
  const cumple = vals.filter((v) => v === "Cumple").length;
  const noCumple = vals.filter((v) => v === "No cumple").length;
  if (noCumple > 2) {
    return { nota: total > 0 ? Math.round((cumple / total) * 100) : 0, tipoNota: "PENC" };
  }
  return { nota: 100, tipoNota: "OK" };
}

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

const DATOS_VACIOS: DatosImportados = {
  fecha: "", asesor: "", canal: "", tipoGestion: "", correo: "", idGestion: "", evaluador: "",
  saludo: "", empatia: "", sonrisa: "", claridad: "", encuesta: "", informacion: "", proceso: "", cierre: "",
  observacion: "", hallazgos: "", mejora: "", estado: "Procesado", grabacion: "", tipoConsulta: "", puntajeTuteo: "",
};

function resultadoError(codigo: CodigoDiagnostico, campo: string, mensaje: string): ResultadoParseo {
  return {
    ok: false,
    datos: null,
    evidencias: {},
    diagnosticos: [{ severidad: "error", codigo, campo, mensaje }],
    notaCalculada: null,
    notaPropuesta: null,
    clasificacionPropuesta: null,
  };
}

// ============================================================
// Reparación tolerante del bloque de ChatGPT.
//
// ChatGPT suele devolver un JSON "casi válido". Los defectos reales y
// recurrentes que rompen JSON.parse son:
//   1. Cercos Markdown (```json … ```) o texto antes/después del objeto.
//   2. Comas colgantes antes de "}" o "]".
//   3. Saltos de línea / tabulaciones CRUDOS dentro de una cadena
//      (JSON prohíbe control chars sin escapar).
//   4. Comillas dobles SIN ESCAPAR dentro del texto — la causa del error
//      "Expected ',' or '}' after property value": p. ej. una evidencia como
//      «el agente dijo "buenos días"» cierra la cadena antes de tiempo.
//
// Esta función hace UN recorrido carácter a carácter y repara esos cuatro
// casos de forma determinística. NO ejecuta nada ni adivina valores: solo
// endereza la sintaxis para que JSON.parse pueda leer el mismo contenido.
// Es un ÚLTIMO RECURSO: solo se invoca cuando el parseo directo falla.
// ============================================================
export function repararJsonChatGPT(entrada: string): string {
  let s = (entrada ?? "").replace(/^﻿/, "").trim();

  // 1. Quitar cercos Markdown ```json … ``` si envuelven el bloque.
  const cerco = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerco) s = cerco[1].trim();

  // 2. Recortar a lo que hay entre la primera "{" y la última "}".
  const ini = s.indexOf("{");
  const fin = s.lastIndexOf("}");
  if (ini !== -1 && fin > ini) s = s.slice(ini, fin + 1);

  const out: string[] = [];
  let enString = false;
  const esEspacio = (c: string) => c === " " || c === "\t" || c === "\r" || c === "\n";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (enString) {
      // Copiar el escape tal cual (\" , \\ , \n …) sin reinterpretarlo.
      if (ch === "\\") {
        out.push(ch);
        if (i + 1 < s.length) { out.push(s[i + 1]); i++; }
        continue;
      }
      if (ch === '"') {
        // ¿Es el cierre real o una comilla incrustada en el texto?
        // Cierre real: tras saltar espacios, lo siguiente es un carácter
        // estructural (: , } ]) o el fin del bloque. Si no, es texto → escapar.
        let j = i + 1;
        while (j < s.length && esEspacio(s[j])) j++;
        const sig = s[j];
        if (sig === ":" || sig === "," || sig === "}" || sig === "]" || sig === undefined) {
          out.push('"');
          enString = false;
        } else {
          out.push('\\"');
        }
        continue;
      }
      // 3. Control chars crudos dentro de la cadena → escapar/normalizar.
      if (ch === "\n") { out.push("\\n"); continue; }
      if (ch === "\t") { out.push("\\t"); continue; }
      if (ch === "\r") { continue; }
      out.push(ch);
      continue;
    }

    // Fuera de cadena:
    if (ch === '"') { enString = true; out.push('"'); continue; }
    if (ch === ",") {
      // 2. Coma colgante antes de "}" o "]" → omitir.
      let j = i + 1;
      while (j < s.length && esEspacio(s[j])) j++;
      if (s[j] === "}" || s[j] === "]") continue;
      out.push(",");
      continue;
    }
    out.push(ch);
  }

  return out.join("");
}

/**
 * Interpreta un bloque de texto AUDITORIA_CO_V1 y lo valida contra el esquema
 * real del sistema. NO escribe en ninguna fuente. Nunca ejecuta el contenido.
 */
export function parseAuditoriaChatGPT(raw: string): ResultadoParseo {
  const bruto = (raw ?? "").trim();
  if (!bruto) {
    return resultadoError("json_malformado", "(bloque)", "El campo está vacío. Pega el bloque generado por ChatGPT.");
  }

  let json: unknown;
  let reparado = false;
  try {
    json = JSON.parse(bruto);
  } catch {
    // Segundo intento: reparar los defectos típicos de ChatGPT y reintentar.
    try {
      json = JSON.parse(repararJsonChatGPT(bruto));
      reparado = true;
    } catch (e2) {
      const detalle = e2 instanceof Error ? e2.message : "formato no válido";
      return resultadoError(
        "json_malformado",
        "(bloque)",
        `No se pudo interpretar el JSON, ni siquiera tras repararlo: ${detalle}. Revisa que ChatGPT haya devuelto solo el objeto JSON.`
      );
    }
  }

  if (!esObjetoPlano(json)) {
    return resultadoError("no_es_objeto", "(bloque)", "El bloque debe ser un objeto JSON con los campos de la auditoría.");
  }

  // ── Formato y versión ──
  const formato = texto(json.formato);
  if (formato !== FORMATO_AUDITORIA_CO) {
    return resultadoError(
      "formato_invalido",
      "formato",
      `El campo "formato" debe ser "${FORMATO_AUDITORIA_CO}" (recibido: ${formato || "ausente"}).`
    );
  }
  if (json.version !== undefined && json.version !== null) {
    const ver = Number(json.version);
    if (ver !== VERSION_AUDITORIA_CO) {
      return resultadoError(
        "version_desconocida",
        "version",
        `Versión de contrato no soportada (${texto(json.version)}). Esta versión admite ${VERSION_AUDITORIA_CO}.`
      );
    }
  }

  const diagnosticos: Diagnostico[] = [];
  const datos: DatosImportados = { ...DATOS_VACIOS };
  const evidencias: Record<string, string> = {};

  if (reparado) {
    diagnosticos.push({
      severidad: "advertencia",
      codigo: "json_reparado",
      campo: "(bloque)",
      mensaje: "El JSON venía con pequeños defectos de formato (comillas o saltos de línea sin escapar) y se corrigió automáticamente. Revisa la vista previa antes de guardar.",
    });
  }

  const interaccion = esObjetoPlano(json.interaccion) ? json.interaccion : {};
  // Lee de `interaccion` y, si no está, del nivel superior (tolerante al origen).
  const leer = (...claves: string[]): string => {
    for (const k of claves) {
      const v = (interaccion as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && texto(v) !== "") return texto(v);
    }
    for (const k of claves) {
      const v = (json as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && texto(v) !== "") return texto(v);
    }
    return "";
  };

  // ── Datos de la interacción ──
  datos.asesor = leer("asesor", "advisor");
  datos.fecha = leer("fecha", "date");
  datos.idGestion = leer("id_gestion", "idGestion", "id");
  datos.canal = leer("canal", "channel");
  datos.tipoGestion = leer("tipo_gestion", "tipoGestion") || "Consulta";
  datos.correo = leer("correo_corporativo", "correo", "email");
  datos.evaluador = leer("evaluador", "evaluator");
  datos.tipoConsulta = leer("tipo_consulta", "tipoConsulta", "motivo");
  datos.grabacion = leer("grabacion", "grabación", "recording");

  // Datos ADMINISTRATIVOS controlados por el formulario, NO por el JSON:
  //  - asesor y correo  → selección manual + registro oficial de Funcionarios.
  //  - id_gestion        → campo manual de Du Site (fuente de verdad).
  //  - fecha             → fecha de registro en Du Site (por defecto hoy Bogotá).
  // Por eso ninguno es obligatorio en el JSON ni bloquea aquí: sus valores (si
  // vienen) solo se leen para detectar discrepancias y avisar. La validación real
  // de id_gestion y fecha ocurre en el formulario y en el servidor.

  // Opcionales ausentes: solo informativo.
  if (!datos.canal) diagnosticos.push({ severidad: "advertencia", codigo: "opcional_ausente", campo: "canal", mensaje: "Canal ausente (opcional)." });
  if (!datos.correo) diagnosticos.push({ severidad: "advertencia", codigo: "opcional_ausente", campo: "correo_corporativo", mensaje: "Correo corporativo ausente (opcional)." });

  // ── Criterios ──
  const critRaw = esObjetoPlano(json.criterios) ? (json.criterios as Record<string, unknown>) : null;
  if (!critRaw) {
    diagnosticos.push({ severidad: "error", codigo: "obligatorio_ausente", campo: "criterios", mensaje: "Falta el objeto \"criterios\" (obligatorio)." });
  } else {
    // Rechaza claves desconocidas (no reparar silenciosamente).
    for (const clave of Object.keys(critRaw)) {
      if (!IDS_CRITERIO.includes(clave as CriterioId)) {
        diagnosticos.push({ severidad: "error", codigo: "criterio_desconocido", campo: `criterios.${clave}`, mensaje: `Criterio desconocido: "${clave}". No corresponde a ningún criterio del sistema.` });
      }
    }
    for (const { id, label } of CRITERIOS) {
      const entrada = critRaw[id];
      if (entrada === undefined || entrada === null) {
        diagnosticos.push({ severidad: "error", codigo: "obligatorio_ausente", campo: `criterios.${id}`, mensaje: `Falta el criterio "${label}".` });
        continue;
      }
      // Admite forma objeto { resultado, evidencia } o cadena simple.
      let resultado = "";
      if (esObjetoPlano(entrada)) {
        resultado = texto((entrada as Record<string, unknown>).resultado ?? (entrada as Record<string, unknown>).valor);
        const ev = texto((entrada as Record<string, unknown>).evidencia ?? (entrada as Record<string, unknown>).evidence);
        if (ev) evidencias[id] = ev;
      } else {
        resultado = texto(entrada);
      }
      if (!(VALORES_CRITERIO as readonly string[]).includes(resultado)) {
        diagnosticos.push({ severidad: "error", codigo: "valor_no_permitido", campo: `criterios.${id}`, mensaje: `Valor no permitido para "${label}": "${resultado || "vacío"}". Use: ${VALORES_CRITERIO.join(", ")}.` });
        continue;
      }
      (datos as unknown as Record<string, string>)[id] = resultado;
      if (resultado === "No aplica") {
        diagnosticos.push({ severidad: "advertencia", codigo: "criterio_no_aplica", campo: `criterios.${id}`, mensaje: `"${label}" quedó como "No aplica" — revisa que corresponda.` });
      }
    }
  }

  // ── Tuteo ──
  const tuteo = leer("puntaje_tuteo", "puntajeTuteo", "tuteo");
  if (!tuteo) {
    datos.puntajeTuteo = "Sin tuteo";
    diagnosticos.push({ severidad: "advertencia", codigo: "opcional_ausente", campo: "puntaje_tuteo", mensaje: "Puntaje de tuteo ausente; se asume \"Sin tuteo\" (opcional)." });
  } else if (!(VALORES_TUTEO as readonly string[]).includes(tuteo)) {
    diagnosticos.push({ severidad: "error", codigo: "valor_no_permitido", campo: "puntaje_tuteo", mensaje: `Puntaje de tuteo no permitido: "${tuteo}". Use: ${VALORES_TUTEO.join(", ")}.` });
  } else {
    datos.puntajeTuteo = tuteo;
  }

  // ── Textos ──
  datos.observacion = leer("observacion", "observación", "observation");
  datos.hallazgos = leer("hallazgos", "findings");
  datos.mejora = leer("puntos_mejora", "mejora", "puntosMejora", "improvements");

  // ── Nota: oficial vs propuesta ──
  const todosCriteriosPresentes = CRITERIOS_PARA_NOTA.every((id) =>
    (VALORES_CRITERIO as readonly string[]).includes((datos as unknown as Record<string, string>)[id])
  );
  const notaCalculada = todosCriteriosPresentes
    ? calcularNota({ saludo: datos.saludo, empatia: datos.empatia, sonrisa: datos.sonrisa, claridad: datos.claridad, encuesta: datos.encuesta, cierre: datos.cierre })
    : null;

  const notaPropuesta = typeof json.nota_propuesta === "number"
    ? json.nota_propuesta
    : json.nota_propuesta !== undefined && !isNaN(Number(json.nota_propuesta))
      ? Number(json.nota_propuesta)
      : null;
  const clasificacionPropuesta = texto(json.clasificacion_propuesta) || null;

  if (notaCalculada) {
    if (notaPropuesta !== null && Math.round(notaPropuesta) !== notaCalculada.nota) {
      diagnosticos.push({ severidad: "advertencia", codigo: "nota_inconsistente", campo: "nota_propuesta", mensaje: `La nota propuesta (${notaPropuesta}%) no coincide con la calculada por la regla oficial (${notaCalculada.nota}%). Se usará la oficial.` });
    }
    if (clasificacionPropuesta && clasificacionPropuesta.toUpperCase() !== notaCalculada.tipoNota) {
      diagnosticos.push({ severidad: "advertencia", codigo: "nota_inconsistente", campo: "clasificacion_propuesta", mensaje: `La clasificación propuesta (${clasificacionPropuesta}) no coincide con la oficial (${notaCalculada.tipoNota}). Se usará la oficial.` });
    }
  }

  const ok = !diagnosticos.some((d) => d.severidad === "error");
  return { ok, datos, evidencias, diagnosticos, notaCalculada, notaPropuesta, clasificacionPropuesta };
}

// Utilidades de presentación (para el componente y las pruebas).
export function erroresDe(r: ResultadoParseo): Diagnostico[] {
  return r.diagnosticos.filter((d) => d.severidad === "error");
}
export function advertenciasDe(r: ResultadoParseo): Diagnostico[] {
  return r.diagnosticos.filter((d) => d.severidad === "advertencia");
}

// ============================================================
// Resolución oficial del asesor seleccionado.
// Fuente de verdad = la selección manual (el identificador oficial del asesor),
// nunca el nombre del JSON. Devuelve el registro OFICIAL (asesor + correo) o null
// si la selección no existe en la lista real de Funcionarios. El correo SIEMPRE
// proviene del registro, no del JSON ni del navegador. Pura y testeable; la usan
// tanto el componente (para mostrar) como el servidor (para validar y guardar).
// ============================================================
export interface AsesorOficial {
  asesor: string; // código oficial (Funcionarios!A)
  nombre: string; // nombre oficial (Funcionarios!E)
  correo: string; // correo oficial (Funcionarios!B)
  canal: string; // canal oficial (Funcionarios!C)
}

export function resolverAsesor(
  seleccion: string,
  lista: { asesor: string; nombre?: string; correo?: string; canal?: string }[]
): AsesorOficial | null {
  const clave = (seleccion ?? "").trim();
  if (!clave) return null;
  const registro = lista.find((f) => (f.asesor ?? "").trim() === clave);
  if (!registro) return null;
  return {
    asesor: registro.asesor.trim(),
    nombre: (registro.nombre ?? "").trim(),
    correo: (registro.correo ?? "").trim(),
    canal: (registro.canal ?? "").trim(),
  };
}

// ============================================================
// Prompt universal copiable (ChatGPT → AUDITORIA_CO_V1).
// Función central basada en las constantes del contrato: una sola fuente evita
// que el texto y el esquema se desincronicen entre componentes.
//
// Las definiciones sustantivas de cada criterio provienen del auditor con IA ya
// en producción (promptCriterios en src/lib/auditorias-admin.ts): son las reglas
// de calidad "oficiales" documentadas en el proyecto. NO se inventan reglas nuevas.
// La nota/clasificación que proponga ChatGPT es informativa; la nota oficial la
// calcula Du Site (hasta 2 incumplimientos de los 6 criterios que puntúan = 100 %
// OK; ≥3 = PENC). Información y Proceso no afectan la nota.
// ============================================================
export function construirPromptUniversal(): string {
  const criteriosDef: Record<CriterioId, string> = {
    saludo: "Cumple si el AGENTE: (1) hace saludo temporal + nombre de la empresa + su propio nombre, y (2) pregunta el nombre del usuario, lo saluda y se ofrece a ayudar.",
    empatia: "Cumple si el AGENTE muestra sensibilidad ante la situación del usuario.",
    sonrisa: "En llamada: Cumple si el AGENTE mantiene un tono positivo y amable durante toda la interacción. En chat: Cumple si mantiene amabilidad en la redacción.",
    claridad: "Cumple si el AGENTE es directo y el usuario entiende sin tener que repreguntar.",
    encuesta: "La invitación a la encuesta es OBLIGATORIA cuando la interacción llega a su cierre. PRIMERO valida en la transcripción si la interacción se desarrolló y llegó a esa instancia (la asesora atendió la gestión y alcanzó a despedirse, o al menos llegó el momento de cerrar). Si SÍ llegó al cierre: marca 'Cumple' solo si el AGENTE invitó EXPLÍCITAMENTE a la encuesta; si no la mencionó, 'No cumple'. Si la interacción NO llegó al cierre (llamada corta, se cortó, o el usuario colgó/se fue antes de que la asesora pudiera cerrar): marca 'No aplica' — nunca 'No cumple', porque no hubo oportunidad. OJO: NO uses 'No aplica' si la asesora sí se despidió pero simplemente olvidó la encuesta; eso es 'No cumple'.",
    informacion: "Cumple si el AGENTE da una respuesta concreta a lo solicitado. (No afecta la nota oficial.)",
    proceso: "Cumple si el AGENTE sigue un proceso lógico y ordenado. (No afecta la nota oficial.)",
    cierre: "Evalúa el cierre SOLO si la interacción llegó a esa instancia. Cumple si el AGENTE hace las 3 cosas al cerrar: (1) pregunta si necesita algo más / alguna otra duda, (2) se despide con su nombre, (3) invita a la encuesta. Si llegó al cierre pero falta alguna de las 3, 'No cumple'. Si la interacción NO llegó al cierre (llamada corta, se cortó, o el usuario colgó antes de que la asesora pudiera despedirse): marca 'No aplica' — no se penaliza un cierre que no tuvo oportunidad de darse.",
  };

  const listaCriterios = CRITERIOS
    .map(({ id, label }) => `- "${id}" (${label}): ${criteriosDef[id]}`)
    .join("\n");

  const ejemploCriterios = CRITERIOS
    .map(({ id }) => `    "${id}": { "resultado": "Cumple", "evidencia": "cita breve con comillas simples, p. ej. el agente dijo 'buenos días'" }`)
    .join(",\n");

  return `Eres un auditor experto en calidad de atención al usuario de COFREM (operación de People BPO). Tu tarea es analizar la transcripción de una interacción (llamada o chat) que te enviará el usuario y devolver ÚNICAMENTE un objeto JSON válido con el formato ${FORMATO_AUDITORIA_CO} (versión ${VERSION_AUDITORIA_CO}), listo para pegar en Du Site.

════════ 1. REGLAS SOBRE LA TRANSCRIPCIÓN (IMPORTANTE) ════════
Las transcripciones provienen de un sistema de voz a texto de AWS y pueden tener errores de reconocimiento, sobre todo en llamadas.
- Interpreta los errores evidentes con el contexto cuando el sentido sea inequívoco (p. ej. "Cofrem" transcrito como "Cofren", "Cofre", etc. — NUNCA lo penalices).
- NO penalices al asesor por palabras deformadas, fragmentos incompletos o errores que probablemente vengan de AWS.
- NO inventes frases, acciones ni evidencias que no estén en la transcripción.
- Distingue lo que realmente se puede atribuir al AGENTE de lo que es incierto.
- Señala en los campos de texto cualquier ambigüedad que afecte materialmente la evaluación.
- Ten en cuenta las diferencias entre llamada (tono de voz) y chat (redacción).
- Evalúa SOLO lo que dice el AGENTE. Lo que diga el usuario/cliente no afecta la calificación del asesor.
- No infieras hechos que la transcripción no permita comprobar.

════════ 2. CRITERIOS DE EVALUACIÓN ════════
Evalúa estos 8 criterios, usando EXACTAMENTE estas claves. Cada uno debe tener un "resultado" y una "evidencia" breve y concreta tomada de la transcripción:
${listaCriterios}

Valores permitidos para "resultado": ${VALORES_CRITERIO.map((v) => `"${v}"`).join(", ")}.
Regla de evidencia: marca "Cumple" SOLO si hay evidencia textual explícita de que el AGENTE lo hizo. Ante la duda o ausencia de evidencia, marca "No cumple". NO uses "No aplica" por falta de evidencia: "No aplica" es solo para casos en que el criterio realmente no corresponde (p. ej. encuesta cuando la interacción se cortó).
Regla de criterios compuestos (saludo y cierre): exigen VARIAS partes a la vez. Marca "Cumple" solo si están TODAS las partes; si falta aunque sea una, es "No cumple". No lo marques "Cumple" por cumplir la mayoría.
Regla de evidencia obligatoria: cada "evidencia" debe ser una cita real tomada de la transcripción. Si marcas "No cumple", la evidencia explica brevemente qué faltó. Nunca dejes la evidencia vacía ni inventada.

REGLA CRÍTICA — interacciones que NO se desarrollan o se cortan:
Algunas llamadas/chats son muy cortos o se cortan y el usuario cuelga o se va ANTES de que la asesora pueda cerrar la interacción. En esos casos NUNCA marques "No cumple" en "encuesta" ni en "cierre": marca "No aplica", porque la asesora no tuvo oportunidad de invitar a la encuesta ni de despedirse. No se puede calificar mal algo que no llegó a corresponder.
Procedimiento obligatorio antes de evaluar "encuesta" y "cierre":
1) Lee la transcripción y determina si la interacción LLEGÓ a la etapa de cierre: ¿la asesora alcanzó a atender/resolver la gestión y a despedirse, o al menos llegó el momento natural de cerrar?
2) Si SÍ llegó al cierre → la encuesta es OBLIGATORIA: "Cumple" solo si la invitó; si no, "No cumple". Y evalúa las 3 partes del cierre.
3) Si NO llegó al cierre (se cortó, llamada corta, el usuario colgó/se fue) → "encuesta" = "No aplica" y "cierre" = "No aplica". En la evidencia explica por qué (p. ej. 'la llamada se cortó antes del cierre, el usuario colgó').

Puntaje de tuteo (campo "puntaje_tuteo"), valores permitidos: ${VALORES_TUTEO.map((v) => `"${v}"`).join(", ")}. Tuteo real = uso de "tú/te/ti/tu/tuyo" dirigido al usuario; "usted/su/le" NO es tuteo.

════════ 3. DATOS ADMINISTRATIVOS — NO LOS INVENTES ════════
NO inventes ni supongas estos datos; Du Site los resuelve de sus fuentes oficiales y puedes OMITIRLOS del JSON:
- Código del asesor, nombre del asesor, correo corporativo y canal (los toma de su directorio oficial).
- ID de gestión (lo escribe el usuario en Du Site).
- Fecha de registro (la fija Du Site con la fecha actual de Colombia).
Si incluyes alguno de estos campos, Du Site lo ignorará para la identidad/persistencia y conservará el oficial.

════════ 4. NOTA Y CLASIFICACIÓN ════════
Puedes incluir "nota_propuesta" y "clasificacion_propuesta" como valores INFORMATIVOS. La nota oficial la calcula Du Site con su propia regla; no presentes tu propuesta como resultado oficial ni inventes una fórmula.

════════ 5. SALIDA (ESTRICTA) — JSON VÁLIDO ════════
Devuelve UN ÚNICO objeto JSON válido, sin texto antes ni después, sin explicaciones ni bloques Markdown (no uses \`\`\`). No agregues claves desconocidas ni cambies los nombres de las claves.

REGLAS DE FORMATO PARA QUE EL JSON NO SE ROMPA (muy importante):
- Dentro de cualquier texto (evidencia, observacion, hallazgos, puntos_mejora) NO uses comillas dobles ( " ). Para citar algo del agente usa comillas simples ( ' ): por ejemplo "evidencia": "el agente dijo 'buenos días, habla con Ana'".
- No pongas saltos de línea dentro de un texto: escribe cada valor en una sola línea.
- No dejes comas colgantes antes de } o ].
- Usa exactamente las comillas dobles rectas ( " ) como delimitadores del JSON, no comillas curvas.

Estructura:

{
  "formato": "${FORMATO_AUDITORIA_CO}",
  "version": ${VERSION_AUDITORIA_CO},
  "criterios": {
${ejemploCriterios}
  },
  "puntaje_tuteo": "Sin tuteo",
  "observacion": "qué pasó en la interacción, en tercera persona neutral",
  "hallazgos": "qué hizo bien y qué falló, con ejemplos concretos",
  "puntos_mejora": "recomendaciones accionables",
  "nota_propuesta": 100,
  "clasificacion_propuesta": "OK"
}

════════ 6. USO REPETIDO ════════
Después de estas instrucciones, CADA transcripción que te envíe el usuario es una auditoría nueva: responde solo con el JSON correspondiente, sin volver a pedir las instrucciones. Pide información adicional únicamente cuando sea indispensable para evaluar y no haya forma segura de representar la incertidumbre dentro del contrato. El resultado debe poder copiarse directamente en la pantalla de importación de Du Site.`;
}
