// Pruebas del intérprete de preguntas y la calificación.
//   node --test src/lib/evaluaciones-tipos.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parsearPreguntasTSV, calificar } from "./evaluaciones-tipos.ts";

// Dos filas como se copian desde Sheets (columnas separadas por TAB), con encabezado.
const TSV_CON_ENCABEZADO = [
  "ID\tPregunta\tOpción A\tOpción B\tOpción C\tOpción D\tRespuesta Correcta\tExplicación",
  "1\t¿Obligación principal de la empresa?\tAfiliar únicamente\tGestionar la afiliación y aportes\tAfiliarse solo cuando sobre\tRealizar aportes cuando Cofrem\tB\tSegún el material, el empleador...",
  "2\t¿Documentos básicos para afiliar?\tSolo registro civil\tEl RUT y renta\tFormulario y fotocopia de cédula\tCertificado de paz y salvo\tC\tSe debe diligenciar el formulario...",
].join("\n");

test("1. Interpreta filas TSV, omite el encabezado y mapea columnas", () => {
  const r = parsearPreguntasTSV(TSV_CON_ENCABEZADO);
  assert.equal(r.errores.length, 0);
  assert.equal(r.preguntas.length, 2);
  assert.equal(r.preguntas[0].pregunta, "¿Obligación principal de la empresa?");
  assert.equal(r.preguntas[0].correcta, "B");
  assert.equal(r.preguntas[0].opciones.length, 4);
  assert.equal(r.preguntas[1].correcta, "C");
  assert.ok(r.preguntas[0].explicacion.startsWith("Según el material"));
});

test("2. Acepta 'Opción B' / 'b.' como respuesta correcta", () => {
  const r = parsearPreguntasTSV("1\t¿X?\tuno\tdos\ttres\tcuatro\tOpción B\t");
  assert.equal(r.errores.length, 0);
  assert.equal(r.preguntas[0].correcta, "B");
  const r2 = parsearPreguntasTSV("1\t¿X?\tuno\tdos\ttres\tcuatro\tb.\t");
  assert.equal(r2.preguntas[0].correcta, "B");
});

test("3. Respuesta correcta inválida → error", () => {
  const r = parsearPreguntasTSV("1\t¿X?\tuno\tdos\ttres\tcuatro\tZ\t");
  assert.equal(r.preguntas.length, 0);
  assert.ok(r.errores.some((e) => /respuesta correcta/i.test(e)));
});

test("4. Correcta apunta a opción vacía → error", () => {
  const r = parsearPreguntasTSV("1\t¿X?\tuno\tdos\t\t\tC\t");
  assert.ok(r.errores.some((e) => /opción está vacía/i.test(e)));
});

test("5. Menos de 2 opciones → error", () => {
  const r = parsearPreguntasTSV("1\t¿X?\tsolo una\t\t\t\tA\t");
  assert.ok(r.errores.some((e) => /2 opciones/.test(e)));
});

test("6. Falta texto de pregunta → error de esa fila", () => {
  const r = parsearPreguntasTSV("1\t\tuno\tdos\ttres\tcuatro\tA\t");
  assert.ok(r.errores.some((e) => /falta el texto/i.test(e)));
});

test("7. Sin TAB (una sola columna) → error claro", () => {
  const r = parsearPreguntasTSV("¿Pregunta sin columnas?");
  assert.ok(r.errores.some((e) => /columnas/i.test(e)));
});

test("8. IDs repetidos → se renombran con advertencia", () => {
  const r = parsearPreguntasTSV(["1\t¿A?\tx\ty\t\t\tA\t", "1\t¿B?\tx\ty\t\t\tB\t"].join("\n"));
  assert.equal(r.preguntas.length, 2);
  assert.notEqual(r.preguntas[0].id, r.preguntas[1].id);
  assert.ok(r.advertencias.some((a) => /repetido/i.test(a)));
});

test("9. Vacío → error", () => {
  const r = parsearPreguntasTSV("   ");
  assert.equal(r.preguntas.length, 0);
  assert.ok(r.errores.length > 0);
});

test("10. Calificación: 7/10 con umbral 60 → APROBADO 70%", () => {
  const preguntas = Array.from({ length: 10 }, () => ({ correcta: "A" }));
  const respuestas = {};
  for (let n = 1; n <= 7; n++) respuestas[n] = "A"; // 7 correctas
  respuestas[8] = "B"; respuestas[9] = "B"; // 2 malas
  // 10 sin responder
  const res = calificar(preguntas, respuestas, 60);
  assert.equal(res.aciertos, 7);
  assert.equal(res.total, 10);
  assert.equal(res.porcentaje, 70);
  assert.equal(res.resultado, "APROBADO");
  assert.deepEqual(res.falladas, [8, 9, 10]);
});

test("11. Calificación: 5/10 umbral 60 → NO APROBADO", () => {
  const preguntas = Array.from({ length: 10 }, () => ({ correcta: "A" }));
  const respuestas = {};
  for (let n = 1; n <= 5; n++) respuestas[n] = "A";
  const res = calificar(preguntas, respuestas, 60);
  assert.equal(res.porcentaje, 50);
  assert.equal(res.resultado, "NO APROBADO");
});
