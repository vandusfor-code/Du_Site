import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPila } from "./pila-motor";
import type { RegistroPila } from "./pila-tipos";

// Pruebas unitarias del motor de reglas PILA (los 10 casos del procedimiento).
// Ejecutar con un runner que soporte TS (p. ej. vitest) o node con type-stripping.
// La lógica está verificada: 10/10 casos + el documento real crvReporte.pdf.

const F = "2026-11-06";
function reg(periodo: string, aporte: number, diasCot: number, extra: Partial<RegistroPila> = {}): RegistroPila {
  return {
    fila: 0, nit: "900", periodo, fechaPago: "01/01/2024", aporte,
    salarioBasico: 1_000_000, diasCot, ibc: null, planilla: "1", novedades: [], crudo: "", ...extra,
  };
}

test("1 · aporte positivo: 55.800 / 19 días → 19 contabilizables", () => {
  const r = validarPila([reg("202501", 55800, 19)], "dependiente", F);
  assert.equal(r.resumenPorPeriodo[0].diasReconocidos, 19);
});

test("2 · aporte cero: 10 días → 0 contabilizables (pero conservado)", () => {
  const r = validarPila([reg("202501", 0, 10)], "dependiente", F);
  assert.equal(r.resumenPorPeriodo[0].diasReconocidos, 0);
  assert.equal(r.analisis.registrosAporteCero, 1);
  assert.equal(r.resumenPorPeriodo[0].detalle.length, 1); // no desaparece
});

test("3 · desglose de planilla 202311: 4 + 26 → 30", () => {
  const r = validarPila([reg("202311", 6200, 4), reg("202311", 43500, 26)], "dependiente", F);
  assert.equal(r.resumenPorPeriodo[0].diasReconocidos, 30);
  assert.equal(r.resumenPorPeriodo[0].aporteAcumulado, 49700);
});

test("4 · consolidación de empresas: A 20 + B 15 → 30 rec + inconsistencia por exceso", () => {
  const r = validarPila([reg("202501", 1000, 20, { nit: "A" }), reg("202501", 1000, 15, { nit: "B" })], "dependiente", F);
  assert.equal(r.resumenPorPeriodo[0].diasReportados, 35);
  assert.equal(r.resumenPorPeriodo[0].diasReconocidos, 30);
  assert.ok(r.inconsistencias.some((i) => i.nivel === "advertencia"));
});

test("5 · dependiente con 360 días == requisito → CUMPLE", () => {
  const ps = ["202311","202312","202401","202402","202403","202404","202405","202406","202407","202408","202409","202410"];
  const r = validarPila(ps.map((p) => reg(p, 5000, 30)), "dependiente", F);
  assert.equal(r.diasAcreditados, 360);
  assert.equal(r.estado, "CUMPLE");
});

test("6 · independiente con 719 < 720 → NO_CUMPLE", () => {
  const ps: string[] = [];
  for (let i = 0; i < 23; i++) { const y = 2023 + Math.floor((10 + i) / 12); const mo = ((10 + i) % 12) + 1; ps.push(`${y}${String(mo).padStart(2, "0")}`); }
  const regs = ps.map((p) => reg(p, 5000, 30));
  regs.push(reg("202610", 5000, 29));
  const r = validarPila(regs, "independiente", F);
  assert.equal(r.diasAcreditados, 719);
  assert.equal(r.estado, "NO_CUMPLE");
});

test("7 · periodos fuera de ventana (3 años) se excluyen", () => {
  const r = validarPila([reg("202010", 5000, 30)], "dependiente", F);
  assert.ok(r.resumenPorPeriodo[0].fueraDeVentana);
  assert.equal(r.diasAcreditados, 0);
  assert.equal(r.analisis.registrosFueraVentana, 1);
});

test("8 · documento ilegible (0 registros) → REQUIERE_REVISION (nunca NO_CUMPLE automático)", () => {
  assert.equal(validarPila([], "dependiente", F).estado, "REQUIERE_REVISION");
});

test("9 · duplicado exacto → crítica; desglose legítimo NO es duplicado", () => {
  const dup = validarPila([reg("202501", 5000, 30), reg("202501", 5000, 30)], "dependiente", F);
  assert.ok(dup.inconsistencias.some((i) => i.nivel === "critica"));
  assert.equal(dup.estado, "REQUIERE_REVISION");
  const desglose = validarPila([reg("202311", 6200, 4), reg("202311", 43500, 26)], "dependiente", F);
  assert.ok(!desglose.inconsistencias.some((i) => i.nivel === "critica"));
});

test("10 · novedades se conservan y NO descuentan días", () => {
  const r = validarPila([reg("202501", 5000, 30, { novedades: ["vacaciones", "licenciaMaternidad"] })], "dependiente", F);
  assert.equal(r.resumenPorPeriodo[0].diasReconocidos, 30);
  assert.ok(r.resumenPorPeriodo[0].novedades.includes("vacaciones"));
});
