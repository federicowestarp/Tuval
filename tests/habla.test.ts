import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarBusqueda } from "../src/lib/habla.ts";

test("medidas habladas y relleno", () => {
  assert.equal(normalizarBusqueda("necesito dos codos de media")[0], "codo 1/2");
  assert.equal(normalizarBusqueda("¿Dónde está la válvula de bola de pulgada y media?")[0], "valvula bola 1 1/2");
  assert.equal(normalizarBusqueda("coples de tres cuartos")[0], "cople 3/4");
  assert.equal(normalizarBusqueda("Teflón")[0], "teflon");
});

test("variantes de específica a general", () => {
  const v = normalizarBusqueda("tee reducida de pulgada a media");
  assert.equal(v[0], "tee reducida 1 1/2");
  assert.equal(normalizarBusqueda("tapones de dos pulgadas")[0], "tapon 2");
  assert.ok(v.includes("tee"));
});
