import { test } from "node:test";
import assert from "node:assert/strict";
import { sinIva, totalesVenta } from "../src/lib/totales.ts";

test("precio capturado con IVA no pierde centavos (caso del mostrador: 4 × $500 + $46)", () => {
  const t = totalesVenta([{ precio: sinIva(500), cantidad: 4 }, { precio: sinIva(46), cantidad: 1 }]);
  assert.equal(t.total, 2046);
  assert.equal(Math.round((t.subtotal + t.iva) * 100) / 100, 2046);
});

test("subtotal + IVA siempre igual al total", () => {
  for (const p of [0.99, 12.5, 99.99, 333.33, 1234.56]) {
    for (const c of [1, 3, 7]) {
      const t = totalesVenta([{ precio: sinIva(p), cantidad: c }]);
      assert.equal(t.total, Math.round(p * c * 100) / 100);
      assert.equal(Math.round((t.subtotal + t.iva) * 100) / 100, t.total);
    }
  }
});

test("precio de catálogo sin IVA suma su IVA normal", () => {
  assert.equal(totalesVenta([{ precio: 100, cantidad: 2 }]).total, 232);
});
