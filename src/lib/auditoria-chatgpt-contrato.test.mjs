// Pruebas unitarias del contrato AUDITORIA_CO_V1 y su parser.
// Se ejecutan con el runtime nativo de TypeScript de Node (sin dependencias):
//   node --test src/lib/auditoria-chatgpt-contrato.test.mjs
// Datos completamente FICTICIOS. No tocan Google Sheets ni servicios externos.

import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAuditoriaChatGPT,
  calcularNota,
  erroresDe,
  advertenciasDe,
  resolverAsesor,
  FORMATO_AUDITORIA_CO,
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

test("2. JSON mal formado → error json_malformado, datos null", () => {
  const r = parseAuditoriaChatGPT('{ "formato": "AUDITORIA_CO_V1", ');
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

test("7. Campo obligatorio ausente (id_gestion) → error obligatorio_ausente", () => {
  const data = JSON.parse(bloqueValido());
  delete data.interaccion.id_gestion;
  const r = parseAuditoriaChatGPT(JSON.stringify(data));
  assert.equal(r.ok, false);
  assert.ok(erroresDe(r).some((d) => d.codigo === "obligatorio_ausente" && d.campo === "id_gestion"));
});

test("8. Fecha inválida → error fecha_invalida", () => {
  const r = parseAuditoriaChatGPT(bloqueValido({ interaccion: {
    asesor: "X", canal: "Chat", fecha: "2026-13-40", id_gestion: "T-8",
  } }));
  // Faltan criterios/otros, pero debe incluir fecha_invalida.
  assert.ok(erroresDe(r).some((d) => d.codigo === "fecha_invalida"));
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
  { asesor: "J.PEREZ123", correo: "jperez@ejemplo.com", canal: "Llamada" },
  { asesor: "M.GOMEZ456", correo: "mgomez@ejemplo.com", canal: "Chat" },
];

test("17. resolverAsesor resuelve el correo OFICIAL del registro", () => {
  assert.deepEqual(resolverAsesor("J.PEREZ123", LISTA), { asesor: "J.PEREZ123", correo: "jperez@ejemplo.com" });
});

test("18. resolverAsesor devuelve null si el asesor no existe o está vacío", () => {
  assert.equal(resolverAsesor("NO.EXISTE999", LISTA), null);
  assert.equal(resolverAsesor("", LISTA), null);
});

test("19. Precedencia: el asesor seleccionado prevalece sobre el nombre del JSON", () => {
  // El JSON trae otro asesor, pero la identidad final es la selección manual:
  // resolverAsesor ignora el JSON y devuelve el correo del seleccionado.
  const oficial = resolverAsesor("M.GOMEZ456", LISTA);
  assert.deepEqual(oficial, { asesor: "M.GOMEZ456", correo: "mgomez@ejemplo.com" });
  // El correo NO proviene del JSON aunque éste incluyera uno distinto.
  assert.notEqual(oficial.correo, "jperez@ejemplo.com");
});
