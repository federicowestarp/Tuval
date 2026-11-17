import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirReparto, type PedidoListo, type Vehiculo } from "../src/lib/sugerir-rutas.ts";

const O = { lat: 19.04, lng: -98.2 };
const p = (id: string, dlat: number, dlng: number, piezas = 2, soloCamioneta = false): PedidoListo => ({ id, folio: id, punto: { lat: O.lat + dlat, lng: O.lng + dlng }, piezas, soloCamioneta, limite: null });
const cam: Vehiculo = { id: "c", nombre: "Camioneta", tipo: "camioneta", capacidad: null };
const moto: Vehiculo = { id: "m", nombre: "Moto", tipo: "moto", capacidad: 20 };

test("agrupa por zona: norte con norte, sur con sur", () => {
  const r = sugerirReparto(O, [p("n1", 0.05, 0), p("s1", -0.05, 0.001), p("n2", 0.06, 0.005), p("s2", -0.06, 0)], [cam, { ...cam, id: "c2" }], 2);
  const zonas = r.grupos.map((g) => g.pedidos.map((x) => x.id[0]).sort().join(""));
  assert.deepEqual(zonas.sort(), ["nn", "ss"]);
});

test("la tubería en tramos no va en moto y la moto respeta capacidad", () => {
  const r = sugerirReparto(O, [p("tubo", 0.01, 0, 4, true), p("a", 0.011, 0, 15), p("b", 0.012, 0, 15)], [moto, cam], 2);
  const enMoto = r.grupos.find((g) => g.vehiculo.tipo === "moto")?.pedidos.map((x) => x.id) ?? [];
  assert.ok(!enMoto.includes("tubo"));
  assert.ok((r.grupos.find((g) => g.vehiculo.tipo === "moto")?.piezas ?? 0) <= 20);
  assert.equal(r.sinAsignar.length, 0);
});

test("sin ubicación queda fuera con su motivo", () => {
  const r = sugerirReparto(O, [{ ...p("x", 0, 0), punto: null }], [cam], 1);
  assert.equal(r.sinAsignar[0].motivo, "Sin ubicación en el mapa");
});
