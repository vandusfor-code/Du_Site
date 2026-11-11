// Pruebas unitarias del contrato AUDITORIA_CO_V1 y su parser.
// Se ejecutan con el runtime nativo de TypeScript de Node (sin dependencias):
//   node --test src/lib/auditoria-chatgpt-contrato.test.mjs
// Datos completamente FICTICIOS. No tocan Google Sheets ni servicios externos.

import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAuditoriaChatGPT,
  repararJsonChatGPT,
  calcularNota,
  erroresDe,
  advertenciasDe,
  resolverAsesor,
  construirPromptUniversal,
  FORMATO_AUDITORIA_CO,
  VERSION_AUDITORIA_CO,
  CRITERIOS,
  VALORES_CRITERIO,
} from "./auditoria-chatgpt-contrato.ts";

// ── Fábrica de un bloque válido de ejemplo (ficticio) ──
function bloqueValido(extra = {}) {
  return JSON.stringify({
    formato: FORMATO_AUDITORIA_CO,
    version: 1,
    interaccion: {
      asesor: "PRUEBA.ASESOR",
      canal: "Llamada",
      fecha: "2026-03-15",
      id_gestion: "TEST-0001",
      tipo_gestion: "Consulta",
      correo_corporativo: "prueba@ejemplo.com",
      evaluador: "Evaluador Ficticio",
      tipo_consulta: "Afiliación",
    },
    criterios: {
      saludo: { resultado: "Cumple", evidencia: "Buenos días, habla con..." },
      empatia: { resultado: "Cumple", evidencia: "Entiendo su situación" },
      sonrisa: { resultado: "Cumple" },
      claridad: { resultado: "Cumple" },
      encuesta: { resultado: "Cumple" },
      informacion: { resultado: "Cumple" },
      proceso: { resultado: "Cumple" },
      cierre: { resultado: "Cumple" },
    },
    puntaje_tuteo: "Sin tuteo",
    observacion: "El usuario consultó por su afiliación.",
    hallazgos: "Te presentaste correctamente.",
    puntos_mejora: "Sigue así.",
    nota_propuesta: 100,
    clasificacion_propuesta: "OK",
    ...extra,
  });
}

test("1. Importación válida → ok, datos mapeados, nota oficial 100/OK", () => {
  const r = parseAuditoriaChatGPT(bloqueValido());
  assert.equal(r.ok, true);
  assert.equal(erroresDe(r).length, 0);
  assert.ok(r.datos);
  assert.equal(r.datos.asesor, "PRUEBA.ASESOR");
  assert.equal(r.datos.idGestion, "TEST-0001");
  assert.equal(r.datos.saludo, "Cumple");
  assert.deepEqual(r.notaCalculada, { nota: 100, tipoNota: "OK" });
  assert.equal(r.evidencias.saludo, "Buenos días, habla con...");
});

test("2. JSON irreparable (sintaxis sin arreglo posible) → error json_malformado, datos null", () => {
  // Dos puntos seguidos no es un defecto que la reparación invente valores para arreglar.
  const r = parseAuditoriaChatGPT('{ "formato": "AUDITORIA_CO_V1" : : }');
  assert.equal(r.ok, false);
  assert.equal(r.datos, null);
  assert.equal(erroresDe(r)[0].codigo, "json_malformado");
});

test("3. Versión desconocida → error version_desconocida", () => {
  const r = parseAuditoriaChatGPT(bloqueValido({ version: 2 }));
  assert.equal(r.ok, false);
  assert.equal(erroresDe(r)[0].codigo, "version_desconocida");
});

test("3b. Formato inválido → error formato_invalido", () => {
  const r = parseAuditoriaChatGPT(JSON.stringify({ formato: "OTRO", version: 1 }));
  assert.equal(r.ok, false);
  assert.equal(erroresDe(r)[0].codigo, "formato_invalido");
});

test("4. Criterio ausente → error obligatorio_ausente por criterio", () => {
  const data = JSON.parse(bloqueValido());
  delete data.criterios.cierre;
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, false);
  assert.ok(erroresDe(r).some((d) => d.codigo === "obligatorio_ausente" && d.campo === "criterios.cierre"));
});

test("5. Criterio desconocido → error criterio_desconocido", () => {
  const data = JSON.parse(bloqueValido());
  data.criterios.inventado = { resultado: "Cumple" };
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, false);
  assert.ok(erroresDe(r).some((d) => d.codigo === "criterio_desconocido" && d.campo === "criterios.inventado"));
});

test("6. Valor de cumplimiento inválido → error valor_no_permitido", () => {
  const data = JSON.parse(bloqueValido());
  data.criterios.saludo = { resultado: "Más o menos" };
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, false);
  assert.ok(erroresDe(r).some((d) => d.codigo === "valor_no_permitido" && d.campo === "criterios.saludo"));
});

test("7. id_gestion del JSON es OPCIONAL (lo controla el formulario)", () => {
  const data = JSON.parse(bloqueValido());
  delete data.interaccion.id_gestion;
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true); // no bloquea: el ID real lo escribe el usuario en Du Site
  assert.equal(erroresDe(r).some((d) => d.campo === "id_gestion"), false);
});

test("8. Fecha del JSON NO bloquea (la fecha la fija Du Site)", () => {
  const data = JSON.parse(bloqueValido());
  data.interaccion.fecha = "2026-13-40"; // valor absurdo en el JSON
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true); // el parser no valida la fecha del JSON; Du Site la controla
  assert.equal(erroresDe(r).length, 0);
});

test("9. Nota propuesta inconsistente → advertencia (no bloquea), usa oficial", () => {
  const data = JSON.parse(bloqueValido());
  data.nota_propuesta = 42; // incoherente con 8/8 Cumple
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true); // advertencia no bloquea
  assert.ok(advertenciasDe(r).some((d) => d.codigo === "nota_inconsistente"));
  assert.equal(r.notaCalculada.nota, 100);
});

test("10. Criterio No aplica → permitido, con advertencia y excluido de la nota", () => {
  const data = JSON.parse(bloqueValido());
  data.criterios.encuesta = { resultado: "No aplica" };
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true);
  assert.ok(advertenciasDe(r).some((d) => d.codigo === "criterio_no_aplica" && d.campo === "criterios.encuesta"));
  // 5 criterios Cumple (encuesta excluida) → sigue 100/OK.
  assert.deepEqual(r.notaCalculada, { nota: 100, tipoNota: "OK" });
});

test("11. Regla oficial: 3 incumplimientos → PENC; 2 → 100 OK", () => {
  // Réplica exacta de calcularNotaManual: hasta 2 "No cumple" => 100/OK.
  assert.deepEqual(
    calcularNota({ saludo: "No cumple", empatia: "No cumple", sonrisa: "Cumple", claridad: "Cumple", encuesta: "Cumple", cierre: "Cumple" }),
    { nota: 100, tipoNota: "OK" }
  );
  const tres = calcularNota({ saludo: "No cumple", empatia: "No cumple", sonrisa: "No cumple", claridad: "Cumple", encuesta: "Cumple", cierre: "Cumple" });
  assert.equal(tres.tipoNota, "PENC");
  assert.equal(tres.nota, 50); // 3 de 6 cumplen
});

test("12. Bloque vacío → error json_malformado y datos conservables", () => {
  const r = parseAuditoriaChatGPT("   ");
  assert.equal(r.ok, false);
  assert.equal(r.datos, null);
  assert.equal(erroresDe(r)[0].codigo, "json_malformado");
});

test("13. No es objeto (array) → error no_es_objeto", () => {
  const r = parseAuditoriaChatGPT("[1,2,3]");
  assert.equal(r.ok, false);
  assert.equal(erroresDe(r)[0].codigo, "no_es_objeto");
});

test("14. Orden de propiedades irrelevante: criterios por clave, no por posición", () => {
  const data = JSON.parse(bloqueValido());
  // Reordenar las claves de criterios no cambia la asignación.
  const reordenado = {
    cierre: data.criterios.cierre,
    saludo: { resultado: "No cumple" },
    proceso: data.criterios.proceso,
    informacion: data.criterios.informacion,
    encuesta: data.criterios.encuesta,
    claridad: data.criterios.claridad,
    sonrisa: data.criterios.sonrisa,
    empatia: data.criterios.empatia,
  };
  const r = parseAuditoriaChatGPT(JSON.stringify({ ...data, criterios: reordenado }));
  assert.equal(r.datos.saludo, "No cumple");
  assert.equal(r.datos.cierre, "Cumple");
});

test("15. Criterio como cadena simple (sin objeto) también se acepta", () => {
  const data = JSON.parse(bloqueValido());
  data.criterios.sonrisa = "No cumple";
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true);
  assert.equal(r.datos.sonrisa, "No cumple");
});

test("16. El asesor del JSON es OPCIONAL (su ausencia no es error)", () => {
  const data = JSON.parse(bloqueValido());
  delete data.interaccion.asesor;
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true);
  assert.equal(erroresDe(r).some((d) => d.campo === "asesor"), false);
});

// ── resolverAsesor: la selección manual es la fuente de verdad ──
const LISTA = [
  { asesor: "J.PEREZ123", correo: "jperez@ejemplo.com", canal: "Llamada", nombre: "Juan Pérez" },
  { asesor: "M.GOMEZ456", correo: "mgomez@ejemplo.com", canal: "Chat", nombre: "María Gómez" },
];

test("17. resolverAsesor resuelve código, nombre, correo y canal OFICIALES", () => {
  assert.deepEqual(resolverAsesor("J.PEREZ123", LISTA), {
    asesor: "J.PEREZ123", nombre: "Juan Pérez", correo: "jperez@ejemplo.com", canal: "Llamada",
  });
});

test("18. resolverAsesor devuelve null si el asesor no existe o está vacío", () => {
  assert.equal(resolverAsesor("NO.EXISTE999", LISTA), null);
  assert.equal(resolverAsesor("", LISTA), null);
});

test("19. Precedencia: el seleccionado prevalece; correo/canal nunca vienen del JSON", () => {
  const oficial = resolverAsesor("M.GOMEZ456", LISTA);
  assert.deepEqual(oficial, { asesor: "M.GOMEZ456", nombre: "María Gómez", correo: "mgomez@ejemplo.com", canal: "Chat" });
  assert.notEqual(oficial.correo, "jperez@ejemplo.com");
});

test("20. Asesores de distintos canales se resuelven correctamente", () => {
  assert.equal(resolverAsesor("J.PEREZ123", LISTA).canal, "Llamada");
  assert.equal(resolverAsesor("M.GOMEZ456", LISTA).canal, "Chat");
});

test("21. resolverAsesor no inventa datos: registro incompleto deja campos vacíos", () => {
  const lista = [{ asesor: "X.INCOMPLETO", correo: "", canal: "", nombre: "" }];
  assert.deepEqual(resolverAsesor("X.INCOMPLETO", lista), { asesor: "X.INCOMPLETO", nombre: "", correo: "", canal: "" });
});

// ── Prompt universal ──
test("22. El prompt universal incluye formato, versión y los 8 criterios", () => {
  const p = construirPromptUniversal();
  assert.ok(p.includes(FORMATO_AUDITORIA_CO));
  assert.ok(p.includes(String(VERSION_AUDITORIA_CO)));
  for (const { id } of CRITERIOS) assert.ok(p.includes(`"${id}"`), `falta criterio ${id}`);
});

test("23. El prompt incluye los valores permitidos y las precauciones de AWS", () => {
  const p = construirPromptUniversal();
  for (const v of VALORES_CRITERIO) assert.ok(p.includes(`"${v}"`), `falta valor ${v}`);
  assert.ok(/AWS/.test(p));
  assert.ok(/no inventes/i.test(p));
});

test("24. El prompt NO exige inventar datos administrativos", () => {
  const p = construirPromptUniversal();
  assert.ok(/NO inventes/i.test(p));
  assert.ok(/ID de gestión/i.test(p) && /[Ff]echa de registro/.test(p));
});

test("25. El prompt NO contiene secretos ni datos sensibles", () => {
  const p = construirPromptUniversal().toLowerCase();
  for (const secreto of ["contraseña", "password", "token", "api_key", "api key", "private_key"]) {
    assert.equal(p.includes(secreto), false, `el prompt no debe mencionar "${secreto}"`);
  }
});

// ── Reparación tolerante del JSON de ChatGPT ──
test("26. Comilla doble SIN escapar dentro de la evidencia (el error reportado) → se repara y es ok", () => {
  // Evidencia con comillas dobles incrustadas: rompe JSON.parse directo.
  const roto = `{
    "formato": "AUDITORIA_CO_V1",
    "version": 1,
    "criterios": {
      "saludo": { "resultado": "Cumple", "evidencia": "el agente dijo "buenos días, habla con Ana" al usuario" },
      "empatia": { "resultado": "Cumple" },
      "sonrisa": { "resultado": "Cumple" },
      "claridad": { "resultado": "Cumple" },
      "encuesta": { "resultado": "Cumple" },
      "informacion": { "resultado": "Cumple" },
      "proceso": { "resultado": "Cumple" },
      "cierre": { "resultado": "Cumple" }
    },
    "puntaje_tuteo": "Sin tuteo"
  }`;
  // Falla directo…
  assert.throws(() => JSON.parse(roto));
  // …pero el parser lo repara y lo acepta.
  const r = parseAuditoriaChatGPT(roto);
  assert.equal(r.ok, true, JSON.stringify(erroresDe(r)));
  assert.equal(r.datos.saludo, "Cumple");
  assert.match(r.evidencias.saludo, /buenos días/);
  assert.ok(advertenciasDe(r).some((d) => d.codigo === "json_reparado"));
});

test("27. Cercos Markdown + coma colgante → se reparan", () => {
  const roto = "```json\n{\n  \"formato\": \"AUDITORIA_CO_V1\",\n  \"version\": 1,\n  \"criterios\": {\n    \"saludo\": { \"resultado\": \"Cumple\" },\n    \"empatia\": { \"resultado\": \"Cumple\" },\n    \"sonrisa\": { \"resultado\": \"Cumple\" },\n    \"claridad\": { \"resultado\": \"Cumple\" },\n    \"encuesta\": { \"resultado\": \"Cumple\" },\n    \"informacion\": { \"resultado\": \"Cumple\" },\n    \"proceso\": { \"resultado\": \"Cumple\" },\n    \"cierre\": { \"resultado\": \"Cumple\" },\n  },\n  \"puntaje_tuteo\": \"Sin tuteo\",\n}\n```";
  const r = parseAuditoriaChatGPT(roto);
  assert.equal(r.ok, true, JSON.stringify(erroresDe(r)));
  assert.equal(r.datos.cierre, "Cumple");
});

test("28. Salto de línea CRUDO dentro de una cadena → se escapa y se repara", () => {
  const roto = `{
    "formato": "AUDITORIA_CO_V1",
    "version": 1,
    "criterios": {
      "saludo": { "resultado": "Cumple" },
      "empatia": { "resultado": "Cumple" },
      "sonrisa": { "resultado": "Cumple" },
      "claridad": { "resultado": "Cumple" },
      "encuesta": { "resultado": "Cumple" },
      "informacion": { "resultado": "Cumple" },
      "proceso": { "resultado": "Cumple" },
      "cierre": { "resultado": "Cumple" }
    },
    "puntaje_tuteo": "Sin tuteo",
    "observacion": "El usuario consultó
por su afiliación."
  }`;
  const r = parseAuditoriaChatGPT(roto);
  assert.equal(r.ok, true, JSON.stringify(erroresDe(r)));
  assert.match(r.datos.observacion, /afiliación/);
});

test("29. JSON válido NO se marca como reparado (no hay falso positivo)", () => {
  const r = parseAuditoriaChatGPT(bloqueValido());
  assert.equal(advertenciasDe(r).some((d) => d.codigo === "json_reparado"), false);
});

test("30. repararJsonChatGPT es idempotente sobre un JSON ya válido", () => {
  const valido = bloqueValido();
  assert.deepEqual(JSON.parse(repararJsonChatGPT(valido)), JSON.parse(valido));
});

test("31. Irreparable (sin cierre) → sigue fallando como json_malformado", () => {
  const r = parseAuditoriaChatGPT('{ "formato": "AUDITORIA_CO_V1", "criterios": ');
  assert.equal(r.ok, false);
  assert.equal(erroresDe(r)[0].codigo, "json_malformado");
});

test("32. El prompt exige comillas simples dentro del texto (evita el error de JSON)", () => {
  const p = construirPromptUniversal();
  assert.match(p, /comillas simples/i);
  assert.match(p, /NO uses comillas dobles/i);
});

test("33. El prompt deja claro el 'No aplica' para llamadas cortas/cortadas (encuesta y cierre)", () => {
  const p = construirPromptUniversal();
  // La encuesta es obligatoria cuando sí llega al cierre…
  assert.match(p, /encuesta es OBLIGATORIA/i);
  // …pero no se penaliza cuando la interacción no llegó al cierre.
  assert.match(p, /interacciones que NO se desarrollan|se cortan/i);
  assert.match(p, /el usuario colg/i);
  assert.match(p, /No aplica/);
});

test("33b. Bloque TRUNCADO sin la } final (caso real) → se cierra y se interpreta", () => {
  // Réplica del defecto real: ChatGPT cortó la salida sin cerrar el objeto raíz.
  // Evidencias con comillas simples (como pide el prompt), sin } final.
  const truncado = `{
  "formato": "AUDITORIA_CO_V1",
  "version": 1,
  "criterios": {
    "saludo": { "resultado": "No cumple", "evidencia": "no pregunta el nombre" },
    "empatia": { "resultado": "No cumple", "evidencia": "no reconoce la urgencia" },
    "sonrisa": { "resultado": "Cumple", "evidencia": "dice 'con mucho gusto le colaboro'" },
    "claridad": { "resultado": "No cumple", "evidencia": "explicacion confusa" },
    "encuesta": { "resultado": "Cumple", "evidencia": "dice 'le dejo una breve encuesta'" },
    "informacion": { "resultado": "Cumple", "evidencia": "indica el formato y los tiempos" },
    "proceso": { "resultado": "Cumple", "evidencia": "orienta el tramite paso a paso" },
    "cierre": { "resultado": "No cumple", "evidencia": "no menciona su nombre al despedirse" }
  },
  "puntaje_tuteo": "Tuteo real",
  "observacion": "orienta sobre la actualizacion de datos",
  "hallazgos": "falta empatia y claridad; usa tuteo",
  "puntos_mejora": "mantener el usted y despedirse con el nombre",
  "nota_propuesta": 75,
  "clasificacion_propuesta": "Requiere mejora"`;
  assert.throws(() => JSON.parse(truncado)); // sin la } final, falla directo
  const r = parseAuditoriaChatGPT(truncado);
  assert.equal(r.ok, true, JSON.stringify(erroresDe(r)));
  assert.equal(r.datos.saludo, "No cumple");
  assert.equal(r.datos.encuesta, "Cumple");
  assert.equal(r.datos.cierre, "No cumple");
  // 2 Cumple de 6 que puntúan (sonrisa, encuesta) → 4 incumplimientos → PENC.
  assert.equal(r.notaCalculada.tipoNota, "PENC");
  assert.ok(advertenciasDe(r).some((d) => d.codigo === "json_reparado"));
});

test("34. 'No aplica' en encuesta Y cierre por llamada cortada → ok, se excluyen de la nota", () => {
  const data = JSON.parse(bloqueValido());
  data.criterios.encuesta = { resultado: "No aplica", evidencia: "la llamada se cortó antes del cierre" };
  data.criterios.cierre = { resultado: "No aplica", evidencia: "el usuario colgó, no hubo despedida" };
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, true, JSON.stringify(erroresDe(r)));
  // saludo, empatia, sonrisa, claridad "Cumple" (4 que puntúan) → 100/OK.
  assert.deepEqual(r.notaCalculada, { nota: 100, tipoNota: "OK" });
});
