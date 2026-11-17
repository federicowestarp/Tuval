import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCoordenadas, ligasGoogleMaps, planearRuta } from "../src/lib/planear-ruta.ts";

const cfg = { velocidadKmh: 25, factorCalle: 1.35, minutosParada: 15 };
const origen = { lat: 19.04, lng: -98.2 };
const salida = new Date("2026-11-18T15:00:00Z");

test("entrega con hora límite más temprana va primero aunque esté más lejos", () => {
  const manana = new Date("2026-11-18T20:00:00Z"), tarde = new Date("2026-11-19T01:00:00Z");
  const r = planearRuta(origen, salida, [
    { id: "cerca-tarde", punto: { lat: 19.041, lng: -98.201 }, limite: tarde },
    { id: "lejos-manana", punto: { lat: 19.1, lng: -98.3 }, limite: manana },
  ], cfg);
  assert.deepEqual(r.paradas.map((p) => p.id), ["lejos-manana", "cerca-tarde"]);
});

test("dentro de la misma ventana ordena por cercanía", () => {
  const lim = new Date("2026-11-18T20:00:00Z");
  const r = planearRuta(origen, salida, [
    { id: "c", punto: { lat: 19.07, lng: -98.2 }, limite: lim },
    { id: "a", punto: { lat: 19.05, lng: -98.2 }, limite: lim },
    { id: "b", punto: { lat: 19.06, lng: -98.2 }, limite: lim },
  ], cfg);
  assert.deepEqual(r.paradas.map((p) => p.id), ["a", "b", "c"]);
  assert.ok(r.km > 0 && r.minutos > 45);
});

test("marca tarde y sin ubicación", () => {
  const r = planearRuta(origen, salida, [
    { id: "x", punto: { lat: 19.5, lng: -98.2 }, limite: new Date(salida.getTime() + 10 * 60_000) },
    { id: "y", punto: null, limite: null },
  ], cfg);
  assert.equal(r.paradas[0].tarde, true);
  assert.equal(r.paradas[1].sinUbicacion, true);
});

test("ligas de Google Maps en tramos encadenados", () => {
  const puntos = Array.from({ length: 15 }, (_, i) => ({ lat: 19 + i / 100, lng: -98.2 }));
  const ligas = ligasGoogleMaps(origen, puntos);
  assert.equal(ligas.length, 2);
  assert.ok(ligas[0].includes("waypoints=") && ligas[0].includes("origin=19.040000,-98.200000"));
});

test("lee coordenadas de texto o liga de Google Maps", () => {
  assert.deepEqual(leerCoordenadas("19.0414, -98.2063"), { lat: 19.0414, lng: -98.2063 });
  assert.deepEqual(leerCoordenadas("https://www.google.com/maps/@19.0414,-98.2063,17z"), { lat: 19.0414, lng: -98.2063 });
  assert.equal(leerCoordenadas("hola"), null);
});
