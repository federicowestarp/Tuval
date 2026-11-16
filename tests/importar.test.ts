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

test("'null' de Supabase cuenta como vacío y el código sirve de SKU", () => {
  const [r] = leerCsv("sku,codigo,nombre,marca,modelo,categoria,unidad,proveedor,costo,precio,existencia,sat_clave,sat_unidad\nnull,P-03593,Boquilla de barredora,Hayward,null,Accesorios de alberca,pza,null,0.00,0.00,-1.000,null,H87\n");
  const p = normalizarRenglon(r)!;
  assert.equal(p.sku, "P-03593");
  assert.deepEqual(p.atributos, { Marca: "Hayward" });
  assert.equal(p.proveedor, null);
  assert.equal(p.precio, null); // precio 0 = por confirmar
  assert.equal(p.satClave, null);
});
test("servicios no se importan y m² se respeta", () => {
  const f = leerCsv("nombre,categoria,unidad\nMano de obra,Servicios,servicio\nInstalación de lámpara,Iluminación,pza\nMosaico chukum 5*5,Acabados y recubrimientos,m²\n");
  const ps = f.map(normalizarRenglon).filter(Boolean);
  assert.equal(ps.length, 1);
  assert.equal(ps[0]!.unidad, "m²");
});
test("casos de PurAqua", () => {
  assert.equal(categoriaTuval("Cuadro eléctrico universal sumergible", "Accesorios de alberca"), "electrico");
  assert.equal(categoriaTuval("Desnatador 3400 tapa cuadrada", "Accesorios de alberca"), "equipos");
  const [r] = leerCsv("nombre,proveedor,costo\nBomba X,Sin proveedor,10\n");
  assert.equal(normalizarRenglon(r)!.proveedor, null);
});
