// Prueba de la calculadora de días hábiles/festivos colombianos (módulo
// Calidad), sin tocar Sheets ni Supabase. Ejecutar con:
// node scripts/test-dias-habiles-colombia.ts

import assert from "node:assert/strict";
import { festivosColombia, esDiaHabilColombia, sumarDiasHabiles } from "../src/lib/dias-habiles-colombia.ts";

let pasadas = 0;
function caso(nombre: string, fn: () => void) {
  fn();
  pasadas++;
  console.log(`OK  - ${nombre}`);
}

const claveFecha = (f: Date) => `${f.getUTCFullYear()}-${f.getUTCMonth()}-${f.getUTCDate()}`;
const utc = (a: number, m1: number, d: number) => new Date(Date.UTC(a, m1 - 1, d));

caso("Festivos fijos de 2026 están presentes", () => {
  const claves = new Set(festivosColombia(2026).map(claveFecha));
  assert.ok(claves.has(claveFecha(utc(2026, 1, 1)))); // Año Nuevo
  assert.ok(claves.has(claveFecha(utc(2026, 5, 1)))); // Trabajo
  assert.ok(claves.has(claveFecha(utc(2026, 7, 20)))); // Independencia
  assert.ok(claves.has(claveFecha(utc(2026, 8, 7)))); // Boyacá
  assert.ok(claves.has(claveFecha(utc(2026, 12, 8)))); // Inmaculada
  assert.ok(claves.has(claveFecha(utc(2026, 12, 25)))); // Navidad
});

caso("Domingo de Pascua 2026 = 5 de abril -> Jueves y Viernes Santo no se trasladan", () => {
  const claves = new Set(festivosColombia(2026).map(claveFecha));
  assert.ok(claves.has(claveFecha(utc(2026, 4, 2)))); // Jueves Santo
  assert.ok(claves.has(claveFecha(utc(2026, 4, 3)))); // Viernes Santo
});

caso("Ley Emiliani: si el festivo YA cae en lunes, no se traslada (Reyes 2025)", () => {
  // 6 de enero de 2025 es lunes.
  const claves = new Set(festivosColombia(2025).map(claveFecha));
  assert.ok(claves.has(claveFecha(utc(2025, 1, 6))));
});

caso("Ley Emiliani: si el festivo NO cae en lunes, se traslada (Reyes 2026)", () => {
  // 6 de enero de 2026 es martes -> se traslada al lunes 12.
  const claves = new Set(festivosColombia(2026).map(claveFecha));
  assert.ok(!claves.has(claveFecha(utc(2026, 1, 6))), "el 6 de enero NO debe quedar como festivo cuando es martes");
  assert.ok(claves.has(claveFecha(utc(2026, 1, 12))), "debe trasladarse al lunes 12");
});

caso("esDiaHabilColombia: fin de semana es false", () => {
  assert.equal(esDiaHabilColombia(utc(2026, 8, 22)), false); // sábado
  assert.equal(esDiaHabilColombia(utc(2026, 8, 23)), false); // domingo
});

caso("esDiaHabilColombia: festivo entre semana es false", () => {
  assert.equal(esDiaHabilColombia(utc(2026, 12, 25)), false); // viernes, Navidad
});

caso("esDiaHabilColombia: día normal entre semana es true", () => {
  assert.equal(esDiaHabilColombia(utc(2026, 8, 25)), true); // martes común
});

caso("sumarDiasHabiles: ejemplo exacto del diseño (lunes 24 ago 2026, n=2)", () => {
  const base = utc(2026, 8, 24); // lunes
  const resultado = sumarDiasHabiles(base, 2);
  assert.equal(claveFecha(resultado), claveFecha(utc(2026, 8, 26))); // miércoles 26
});

caso("sumarDiasHabiles: n=0 devuelve la misma fecha base sin cambios", () => {
  const base = utc(2026, 8, 24);
  const resultado = sumarDiasHabiles(base, 0);
  assert.equal(claveFecha(resultado), claveFecha(base));
});

caso("sumarDiasHabiles: salta un fin de semana completo", () => {
  // Viernes 21 ago 2026 + 1 día hábil = lunes 24 ago 2026 (salta sáb/dom).
  const base = utc(2026, 8, 21); // viernes
  const resultado = sumarDiasHabiles(base, 1);
  assert.equal(claveFecha(resultado), claveFecha(utc(2026, 8, 24)));
});

console.log(`\n${pasadas}/${pasadas} pruebas de días hábiles colombianos pasaron.`);
