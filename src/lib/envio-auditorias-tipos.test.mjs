// Pruebas de la lógica pura de agrupación/envío por asesora.
//   node --test src/lib/envio-auditorias-tipos.test.mjs
// Datos ficticios; sin red, sin Supabase, sin correos.

import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparAuditorias,
  transicionValida,
  estadoTrasAcuse,
} from "./envio-auditorias-tipos.ts";

const DIRECTORIO = new Map([
  ["J.PEREZ123", { nombre: "Juan Pérez", correo: "jperez@ejemplo.com", canal: "Llamada" }],
  ["M.GOMEZ456", { nombre: "María Gómez", correo: "mgomez@ejemplo.com", canal: "Chat" }],
  ["S.VACIO000", { nombre: "Sin Correo", correo: "", canal: "Llamada" }],
]);

const FILAS = [
  { idGestion: "A1", asesorCodigo: "J.PEREZ123", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "OK" },
  { idGestion: "A2", asesorCodigo: "J.PEREZ123", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "PENC" },
  { idGestion: "A3", asesorCodigo: "J.PEREZ123", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "OK" },
  { idGestion: "B1", asesorCodigo: "M.GOMEZ456", fecha: "2026-10-20", canalConsolidado: "Chat", resultado: "OK" },
  { idGestion: "C1", asesorCodigo: "S.VACIO000", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "OK" },
  { idGestion: "X9", asesorCodigo: "J.PEREZ123", fecha: "2026-10-19", canalConsolidado: "Llamada", resultado: "OK" }, // otro día
];

const CICLOS = new Map([
  ["A1", { estado: "CREADA", requiereCompromiso: true }],
  ["A2", { estado: "CREADA", requiereCompromiso: false }],
  ["A3", { estado: "NOTIFICADA", requiereCompromiso: true }], // ya enviada
  ["B1", { estado: "CREADA", requiereCompromiso: true }],
  ["C1", { estado: "CREADA", requiereCompromiso: true }], // sin correo → no elegible
  // X9 sin ciclo
]);

test("1. Agrupa por asesora y filtra por fecha de registro exacta", () => {
  const r = agruparAuditorias(FILAS, CICLOS, DIRECTORIO, { fecha: "2026-10-20" });
  assert.equal(r.totalAsesoras, 3);
  const perez = r.grupos.find((g) => g.asesorCodigo === "J.PEREZ123");
  // X9 es del 19 → excluida; Pérez tiene 3 del día 20.
  assert.equal(perez.total, 3);
  assert.equal(perez.nombre, "Juan Pérez");
  assert.equal(perez.correo, "jperez@ejemplo.com");
});

test("2. Pendientes (CREADA) vs enviadas (NOTIFICADA+) por grupo", () => {
  const r = agruparAuditorias(FILAS, CICLOS, DIRECTORIO, { fecha: "2026-10-20" });
  const perez = r.grupos.find((g) => g.asesorCodigo === "J.PEREZ123");
  assert.equal(perez.pendientes, 2); // A1, A2
  assert.equal(perez.enviadas, 1); // A3
  assert.deepEqual(perez.idsPendientesElegibles.sort(), ["A1", "A2"]);
});

test("3. Sin correo oficial → no elegible (no entra al envío)", () => {
  const r = agruparAuditorias(FILAS, CICLOS, DIRECTORIO, { fecha: "2026-10-20" });
  const vacio = r.grupos.find((g) => g.asesorCodigo === "S.VACIO000");
  assert.equal(vacio.pendientes, 1);
  assert.equal(vacio.idsPendientesElegibles.length, 0); // sin correo → no elegible
  assert.equal(vacio.noElegibles, 1);
});

test("4. El correo SIEMPRE sale del directorio, nunca de las filas", () => {
  const r = agruparAuditorias(FILAS, CICLOS, DIRECTORIO, { fecha: "2026-10-20" });
  const gomez = r.grupos.find((g) => g.asesorCodigo === "M.GOMEZ456");
  assert.equal(gomez.correo, "mgomez@ejemplo.com");
});

test("5. Filtro por asesora específica", () => {
  const r = agruparAuditorias(FILAS, CICLOS, DIRECTORIO, { fecha: "2026-10-20", asesora: "M.GOMEZ456" });
  assert.equal(r.totalAsesoras, 1);
  assert.equal(r.grupos[0].asesorCodigo, "M.GOMEZ456");
});

test("6. soloPendientes excluye grupos sin pendientes", () => {
  const ciclos = new Map(CICLOS);
  ciclos.set("B1", { estado: "CERRADA", requiereCompromiso: true }); // Gómez ya cerrada
  const r = agruparAuditorias(FILAS, ciclos, DIRECTORIO, { fecha: "2026-10-20", soloPendientes: true });
  assert.equal(r.grupos.some((g) => g.asesorCodigo === "M.GOMEZ456"), false);
});

test("7. Auditoría recién guardada sin ciclo (SIN_CICLO) con correo → pendiente y elegible", () => {
  const r = agruparAuditorias(
    [{ idGestion: "Z1", asesorCodigo: "J.PEREZ123", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "OK" }],
    new Map(),
    DIRECTORIO,
    { fecha: "2026-10-20" }
  );
  const g = r.grupos[0];
  assert.equal(g.auditorias[0].estadoCiclo, "SIN_CICLO");
  assert.equal(g.pendientes, 1);
  assert.deepEqual(g.idsPendientesElegibles, ["Z1"]); // el envío creará su ciclo (adopción)
});

test("7b. SIN_CICLO sin correo oficial → pendiente pero NO elegible", () => {
  const r = agruparAuditorias(
    [{ idGestion: "Z2", asesorCodigo: "S.VACIO000", fecha: "2026-10-20", canalConsolidado: "Llamada", resultado: "OK" }],
    new Map(),
    DIRECTORIO,
    { fecha: "2026-10-20" }
  );
  const g = r.grupos[0];
  assert.equal(g.idsPendientesElegibles.length, 0);
  assert.equal(g.noElegibles, 1);
});

test("8. Transiciones válidas del ciclo", () => {
  assert.equal(transicionValida("CREADA", "NOTIFICADA"), true);
  assert.equal(transicionValida("NOTIFICADA", "COMPROMISO_PENDIENTE"), true);
  assert.equal(transicionValida("NOTIFICADA", "ACUSADA"), true);
  assert.equal(transicionValida("COMPROMISO_PENDIENTE", "EN_SEGUIMIENTO"), true);
  assert.equal(transicionValida("EN_SEGUIMIENTO", "CERRADA"), true);
  // inválidas
  assert.equal(transicionValida("CREADA", "CERRADA"), false);
  assert.equal(transicionValida("NOTIFICADA", "EN_SEGUIMIENTO"), false);
  assert.equal(transicionValida("CERRADA", "NOTIFICADA"), false);
});

test("9. Estado tras acuse según requiere compromiso", () => {
  assert.equal(estadoTrasAcuse(true), "COMPROMISO_PENDIENTE");
  assert.equal(estadoTrasAcuse(false), "ACUSADA");
});
