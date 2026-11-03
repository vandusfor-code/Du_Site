import test from "node:test";
import assert from "node:assert/strict";
import {
  diasHabilesTranscurridos,
  evaluarSla,
  diasRestantes,
  normalizarEstadoSNC,
  PLAZO_HABILES_SNC,
} from "./radicaciones-snc-tipos.ts";

// 2026-11-02 es lunes, 11-03 martes, ... 11-06 viernes, 11-07 sábado, 11-08 domingo, 11-09 lunes.

test("mismo día: 0 hábiles", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-02", "2026-11-02"), 0);
});

test("día hábil siguiente: 1", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-02", "2026-11-03"), 1);
});

test("dos días hábiles: 2", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-02", "2026-11-04"), 2);
});

test("el fin de semana no cuenta: viernes→lunes = 1", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-06", "2026-11-09"), 1);
});

test("viernes→martes = 2 hábiles (salta sáb y dom)", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-06", "2026-11-10"), 2);
});

test("fecha futura o inválida → 0", () => {
  assert.equal(diasHabilesTranscurridos("2026-11-05", "2026-11-02"), 0);
  assert.equal(diasHabilesTranscurridos("", "2026-11-02"), 0);
});

test("semáforo: <2 a tiempo, =2 vence hoy, >2 vencida", () => {
  assert.equal(evaluarSla(0), "a_tiempo");
  assert.equal(evaluarSla(1), "a_tiempo");
  assert.equal(evaluarSla(PLAZO_HABILES_SNC), "vence_hoy");
  assert.equal(evaluarSla(3), "vencida");
});

test("días restantes nunca negativo", () => {
  assert.equal(diasRestantes(0), 2);
  assert.equal(diasRestantes(2), 0);
  assert.equal(diasRestantes(5), 0);
});

test("normalizar estado", () => {
  assert.equal(normalizarEstadoSNC("Solucionada"), "Solucionada");
  assert.equal(normalizarEstadoSNC("solucionado"), "Solucionada");
  assert.equal(normalizarEstadoSNC("Pendiente"), "Pendiente");
  assert.equal(normalizarEstadoSNC(""), "Pendiente");
  assert.equal(normalizarEstadoSNC(undefined), "Pendiente");
});
