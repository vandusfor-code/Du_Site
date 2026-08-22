// Prueba de la lógica pura de identidad (Fase 1), sin tocar Sheets ni
// Supabase. Ejecutar con: node scripts/test-identidad-ciclo.ts
//
// Cubre los casos 6, 7 y 8 del plan de pruebas de Fase 1 (AMBIGUO,
// SIN_CORREO, SIN_ASESOR_ASOCIADO), más ELEGIBLE y variantes de
// mayúsculas/espacios, con datos sintéticos — nunca datos reales de
// Consolidado, que no debe tocarse.

import assert from "node:assert/strict";
import { resolverIdentidadAsesor } from "../src/lib/identidad-ciclo.ts";

let pasadas = 0;
function caso(nombre: string, fn: () => void) {
  fn();
  pasadas++;
  console.log(`OK  - ${nombre}`);
}

caso("ELEGIBLE: coincidencia exacta con correo", () => {
  const r = resolverIdentidadAsesor(
    "V.MURCIA638",
    ["V.MURCIA638", "A.BANDA483"],
    [{ codigo: "V.MURCIA638", correo: "valentina.murcia@cofrembpo.com" }]
  );
  assert.equal(r.estado, "ELEGIBLE");
  if (r.estado === "ELEGIBLE") {
    assert.equal(r.asesorCodigo, "V.MURCIA638");
    assert.equal(r.correo, "valentina.murcia@cofrembpo.com");
  }
});

caso("ELEGIBLE: normaliza mayúsculas/espacios (caso real de Consolidado)", () => {
  const r = resolverIdentidadAsesor(
    "  anamaria.mahecha  ".toUpperCase(), // simula session.user.usuario con distinta forma
    ["ANAMARIA.MAHECHA", "anamaria.mahecha"], // ambas variantes reales encontradas en Fase 0
    [{ codigo: "ANAMARIA.MAHECHA", correo: "anamaria.mahecha@cofrembpo.com" }]
  );
  assert.equal(r.estado, "ELEGIBLE");
});

caso("SIN_ASESOR_ASOCIADO: el usuario no aparece nunca como Asesor en Consolidado", () => {
  const r = resolverIdentidadAsesor("LISANDRO.GUTIERREZ", ["A.BANDA483", "V.MURCIA638"], [
    { codigo: "LISANDRO.GUTIERREZ", correo: "empleogranada@cofrem.com" },
  ]);
  assert.equal(r.estado, "SIN_ASESOR_ASOCIADO");
});

caso("SIN_ASESOR_ASOCIADO: usuario vacío", () => {
  const r = resolverIdentidadAsesor("   ", ["A.BANDA483"], []);
  assert.equal(r.estado, "SIN_ASESOR_ASOCIADO");
});

caso("SIN_CORREO: existe en Consolidado y en Funcionarios, pero sin correo", () => {
  const r = resolverIdentidadAsesor("X.PRUEBA001", ["X.PRUEBA001"], [{ codigo: "X.PRUEBA001", correo: "" }]);
  assert.equal(r.estado, "SIN_CORREO");
  if (r.estado === "SIN_CORREO") assert.equal(r.asesorCodigo, "X.PRUEBA001");
});

caso("SIN_CORREO: existe en Consolidado pero no tiene ninguna fila en Funcionarios", () => {
  const r = resolverIdentidadAsesor("Y.PRUEBA002", ["Y.PRUEBA002"], []);
  assert.equal(r.estado, "SIN_CORREO");
});

caso("AMBIGUO: dos filas de Funcionarios para el mismo código, con correos distintos", () => {
  const r = resolverIdentidadAsesor("Z.PRUEBA003", ["Z.PRUEBA003"], [
    { codigo: "Z.PRUEBA003", correo: "correo.viejo@cofrembpo.com" },
    { codigo: "z.prueba003", correo: "correo.nuevo@cofrembpo.com" },
  ]);
  assert.equal(r.estado, "AMBIGUO");
  if (r.estado === "AMBIGUO") {
    assert.deepEqual(new Set(r.correosEnConflicto), new Set(["correo.viejo@cofrembpo.com", "correo.nuevo@cofrembpo.com"]));
  }
});

caso("NO ambiguo: dos filas de Funcionarios para el mismo código pero con el MISMO correo", () => {
  const r = resolverIdentidadAsesor("Z.PRUEBA004", ["Z.PRUEBA004"], [
    { codigo: "Z.PRUEBA004", correo: "mismo@cofrembpo.com" },
    { codigo: "Z.PRUEBA004", correo: " Mismo@Cofrembpo.com " },
  ]);
  assert.equal(r.estado, "ELEGIBLE");
});

console.log(`\n${pasadas}/${pasadas} pruebas de identidad pasaron.`);
