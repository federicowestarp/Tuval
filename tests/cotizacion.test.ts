import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCotizacion } from "../src/lib/cotizacion.ts";

test("pegado de Excel con encabezado", () => {
  const r = leerCotizacion("Código\tDescripción\tCant\tPrecio\tDisp\tEntrega\nA-1\tCople PVC 1/2\t10\t$1,234.50\tSí\tInmediata\nB-2\tVálvula esfera 3/4\t2\t89.9\tno\t3 días");
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { codigo: "A-1", descripcion: "Cople PVC 1/2", cantidad: 10, precio: 1234.5, disponible: true, tiempo: "Inmediata" });
  assert.equal(r[1].disponible, false);
  assert.equal(r[1].precio, 89.9);
});
test("punto y coma y existencia numérica", () => {
  const [r] = leerCotizacion("X9;Tubo conduit;5;12,50;0;");
  assert.equal(r.precio, 12.5);
  assert.equal(r.disponible, false);
});
test("renglones incompletos se ignoran", () => {
  assert.equal(leerCotizacion("solo texto\nA\tB").length, 0);
});
