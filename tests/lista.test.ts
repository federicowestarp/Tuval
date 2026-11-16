import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretarLinea } from "../src/lib/lista.ts";

test("cantidad al inicio", () => assert.deepEqual(interpretarLinea("10 codos 90 1/2"), { cantidad: 10, descripcion: "codos 90 1/2" }));
test("con x", () => assert.deepEqual(interpretarLinea("4 x cople PVC 3/4"), { cantidad: 4, descripcion: "cople PVC 3/4" }));
test("con pzas", () => assert.deepEqual(interpretarLinea("- 6 pzas válvula esfera"), { cantidad: 6, descripcion: "válvula esfera" }));
test("sin cantidad", () => assert.deepEqual(interpretarLinea("bomba periférica 1/2 hp"), { cantidad: 1, descripcion: "bomba periférica 1/2 hp" }));
test("medida al inicio no es cantidad", () => assert.deepEqual(interpretarLinea('1/2" cople'), { cantidad: 1, descripcion: '1/2" cople' }));
test("línea vacía", () => assert.equal(interpretarLinea("   "), null));
