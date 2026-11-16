import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPromesa } from "../src/lib/corte.ts";

// México no tiene horario de verano desde 2022: UTC-6 todo el año.
const mx = (fechaHora: string) => new Date(`${fechaHora}-06:00`);

test("Puebla lunes 7:30 → hoy en la mañana", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-16T07:30")), { fecha: "2026-11-16", ventana: "manana" });
});
test("Puebla lunes 11:59 → hoy en la tarde", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-16T11:59")), { fecha: "2026-11-16", ventana: "tarde" });
});
test("Puebla lunes 12:00 → martes en la mañana", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-16T12:00")), { fecha: "2026-11-17", ventana: "manana" });
});
test("Puebla sábado 9:00 → mismo sábado", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-21T09:00")), { fecha: "2026-11-21", ventana: "manana" });
});
test("Puebla sábado 11:00 → lunes", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-21T11:00")), { fecha: "2026-11-23", ventana: "manana" });
});
test("Puebla domingo → lunes", () => {
  assert.deepEqual(calcularPromesa("puebla", mx("2026-11-22T15:00")), { fecha: "2026-11-23", ventana: "manana" });
});
test("Atlixco lunes 16:59 → martes en la mañana", () => {
  assert.deepEqual(calcularPromesa("atlixco", mx("2026-11-16T16:59")), { fecha: "2026-11-17", ventana: "manana" });
});
test("Tlaxcala lunes 17:00 → miércoles en la mañana", () => {
  assert.deepEqual(calcularPromesa("tlaxcala", mx("2026-11-16T17:00")), { fecha: "2026-11-18", ventana: "manana" });
});
test("Tlaxcala viernes 15:00 → sábado en la mañana", () => {
  assert.deepEqual(calcularPromesa("tlaxcala", mx("2026-11-20T15:00")), { fecha: "2026-11-21", ventana: "manana" });
});
test("Atlixco sábado 18:00 → martes (lunes hábil + 1)", () => {
  assert.deepEqual(calcularPromesa("atlixco", mx("2026-11-21T18:00")), { fecha: "2026-11-24", ventana: "manana" });
});
test("Atlixco domingo → martes", () => {
  assert.deepEqual(calcularPromesa("atlixco", mx("2026-11-22T10:00")), { fecha: "2026-11-24", ventana: "manana" });
});
test("Atlixco sábado 11:00 → lunes", () => {
  assert.deepEqual(calcularPromesa("atlixco", mx("2026-11-21T11:00")), { fecha: "2026-11-23", ventana: "manana" });
});
test("Atlixco sábado 13:00 → martes", () => {
  assert.deepEqual(calcularPromesa("atlixco", mx("2026-11-21T13:00")), { fecha: "2026-11-24", ventana: "manana" });
});
import { zonaDe } from "../src/lib/corte.ts";
test("zona por estado y municipio", () => {
  assert.equal(zonaDe("Puebla", "Puebla"), "puebla");
  assert.equal(zonaDe("Puebla", "San Andrés Cholula"), "puebla");
  assert.equal(zonaDe("Puebla", "Atlixco"), "atlixco");
  assert.equal(zonaDe("Tlaxcala", "Tlaxcala"), "tlaxcala");
  assert.equal(zonaDe("Puebla", "Tehuacán"), "otro");
  assert.equal(zonaDe("Jalisco", "Guadalajara"), "otro");
  assert.equal(calcularPromesa("otro"), null);
});
