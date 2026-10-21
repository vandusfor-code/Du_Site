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
  try {
    json = JSON.parse(bruto);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "formato no válido";
    return resultadoError("json_malformado", "(bloque)", `No se pudo interpretar el JSON: ${detalle}`);
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
    encuesta: "Cumple si el AGENTE invita a la encuesta. Marca \"No aplica\" SOLO si la interacción se cortó y no hubo oportunidad de invitarla.",
    informacion: "Cumple si el AGENTE da una respuesta concreta a lo solicitado. (No afecta la nota oficial.)",
    proceso: "Cumple si el AGENTE sigue un proceso lógico y ordenado. (No afecta la nota oficial.)",
    cierre: "Cumple si el AGENTE hace las 3 cosas: pregunta si necesita algo más + se despide con su nombre + invita a la encuesta.",
  };

  const listaCriterios = CRITERIOS
    .map(({ id, label }) => `- "${id}" (${label}): ${criteriosDef[id]}`)
    .join("\n");

  const ejemploCriterios = CRITERIOS
    .map(({ id }) => `    "${id}": { "resultado": "Cumple", "evidencia": "cita breve de la transcripción" }`)
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

Puntaje de tuteo (campo "puntaje_tuteo"), valores permitidos: ${VALORES_TUTEO.map((v) => `"${v}"`).join(", ")}. Tuteo real = uso de "tú/te/ti/tu/tuyo" dirigido al usuario; "usted/su/le" NO es tuteo.

════════ 3. DATOS ADMINISTRATIVOS — NO LOS INVENTES ════════
NO inventes ni supongas estos datos; Du Site los resuelve de sus fuentes oficiales y puedes OMITIRLOS del JSON:
- Código del asesor, nombre del asesor, correo corporativo y canal (los toma de su directorio oficial).
- ID de gestión (lo escribe el usuario en Du Site).
- Fecha de registro (la fija Du Site con la fecha actual de Colombia).
Si incluyes alguno de estos campos, Du Site lo ignorará para la identidad/persistencia y conservará el oficial.

════════ 4. NOTA Y CLASIFICACIÓN ════════
Puedes incluir "nota_propuesta" y "clasificacion_propuesta" como valores INFORMATIVOS. La nota oficial la calcula Du Site con su propia regla; no presentes tu propuesta como resultado oficial ni inventes una fórmula.

════════ 5. SALIDA (ESTRICTA) ════════
Devuelve UN ÚNICO objeto JSON válido, sin texto antes ni después, sin explicaciones ni bloques Markdown. No agregues claves desconocidas ni cambies los nombres de las claves. Estructura:

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
