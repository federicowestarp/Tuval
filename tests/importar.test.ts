import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCsv } from "../src/lib/csv.ts";
import { categoriaTuval, normalizarRenglon } from "../src/lib/importar.ts";

test("CSV con comillas y comas", () => {
  const f = leerCsv('sku,nombre,precio\r\nA-1,"Válvula de esfera 1/2"", PVC",123.40\r\n');
  assert.deepEqual(f, [{ sku: "A-1", nombre: 'Válvula de esfera 1/2", PVC', precio: "123.40" }]);
});
test("encabezados de PurAqua", () => {
  const [r] = leerCsv("sku,codigo,nombre,marca,modelo,categoria,unidad,proveedor,costo,precio,existencia\nX9,,Bomba 1 HP,Pentair,SuperFlo,Equipo de bombeo,pza,Hidrotec,5000,7142.86,3\n");
  const p = normalizarRenglon(r)!;
  assert.equal(p.categoria, "equipos");
  assert.equal(p.precio, 7142.86);
  assert.equal(p.existencia, 3);
  assert.deepEqual(p.atributos, { Marca: "Pentair", Modelo: "SuperFlo" });
});
test("categorías por nombre", () => {
  assert.equal(categoriaTuval("Codo 90 PVC 1/2", "Tubería y conexiones"), "conexiones");
  assert.equal(categoriaTuval("Tubo PVC hidráulico 1/2 tramo 6 m"), "tuberia");
  assert.equal(categoriaTuval("Válvula check 2", "Refacciones"), "valvulas");
  assert.equal(categoriaTuval("Cable THW cal 12"), "electrico");
  assert.equal(categoriaTuval("Cloro granulado 20 kg", "Químicos"), "por_clasificar");
  assert.equal(categoriaTuval("Tubo conduit 3/4"), "electrico");
});
test("sin nombre se descarta", () => assert.equal(normalizarRenglon({ sku: "X" }), null));
