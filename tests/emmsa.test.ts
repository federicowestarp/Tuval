import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretarEmmsa, type TextoPdf } from "../src/lib/emmsa.ts";

// Posiciones tomadas de la plantilla real de Emmsa (sin datos del cliente).
const t = (pagina: number, x: number, y: number, str: string): TextoPdf => ({ pagina, x, y, str });
const fila = (p: number, y: number, part: string, cod: string, desc: string, cant: string, uni: string, pu: string, imp: string, tiempo: string) => [
  t(p, 37, y, part), t(p, 69, y, cod), t(p, 138, y, desc), t(p, 345, y, cant), t(p, 371, y, uni), t(p, 427, y, pu), t(p, 499, y, imp), t(p, 536, y, tiempo),
];

const textos: TextoPdf[] = [
  t(1, 471, 751, "974469"), t(1, 468, 728, "10-ENE-25"), t(1, 444, 693, "CONTADO"), t(1, 482, 693, "EN"), t(1, 497, 693, "FIRM"), t(1, 444, 680, "14-ENE-25"),
  ...fila(1, 529, "1", "PROS-04", 'CUERPO ASP PROFESIONAL 4" ENT 1/2"', "19", "PZA", "48.38", "919.22", "1 Día Hab."),
  ...fila(1, 517, "2", "437400", "VALVULA CHECK PARA PRO/INST-SPRAY", "19", "PZA", "22.68", "430.92", "1 Día Hab."),
  t(1, 138, 506, '4"'),
  ...fila(1, 229, "26", "526100C", 'TUBERIA RD26 DE 1" CEM CRESCO', "84", "MTO", "11.65", "978.60", "1 Día Hab."),
  ...fila(1, 157, "32", "A12500", 'CAJA PARA VALVULAS RECTANGULAR 12"', "2", "PZA", "697.2", "1,394.40", "15 Días Hab."),
  // Página 2: encabezado repetido, continuación de la partida 32 y última partida.
  t(2, 471, 751, "974469"), t(2, 84, 680, "PRIVADA"),
  t(2, 138, 529, "RB"),
  ...fila(2, 518, "33", "A12523", 'CAJA PARA VALVULAS CIRCULAR 6" RB', "1", "PZA", "122.45", "122.45", "1 Día Hab."),
  t(2, 508, 122, "3,845.59"), t(2, 512, 105, "615.29"), t(2, 508, 86, "4,460.88"), t(2, 561, 86, "MXN"),
];

test("lee encabezado, partidas y totales", () => {
  const c = interpretarEmmsa(textos);
  assert.equal(c.folio, "974469");
  assert.equal(c.fecha, "10-ENE-25");
  assert.equal(c.vigencia, "14-ENE-25");
  assert.equal(c.condiciones, "CONTADO EN FIRM");
  assert.equal(c.renglones.length, 5);
  assert.deepEqual(c.renglones[2], {
    partida: 26, codigo: "526100C", descripcion: 'TUBERIA RD26 DE 1" CEM CRESCO', cantidad: 84, unidad: "MTO",
    precio: 11.65, importe: 978.6, tiempo: "1 Día Hab.", dias: 1,
  });
  assert.equal(c.subtotal, 3845.59);
  assert.equal(c.total, 4460.88);
  assert.equal(c.cuadra, true);
});

test("une descripciones partidas en dos líneas y entre páginas", () => {
  const c = interpretarEmmsa(textos);
  assert.equal(c.renglones[1].descripcion, 'VALVULA CHECK PARA PRO/INST-SPRAY 4"');
  assert.equal(c.renglones[3].descripcion, 'CAJA PARA VALVULAS RECTANGULAR 12" RB');
  assert.equal(c.renglones[3].dias, 15);
});

test("detecta cuando no cuadra", () => {
  const c = interpretarEmmsa(textos.filter((x) => x.str !== "PROS-04" && !(x.y === 529 && x.pagina === 1)));
  assert.equal(c.cuadra, false);
});

test("precio largo que se corre de columna (alineado a la derecha)", () => {
  const c = interpretarEmmsa([
    t(1, 37, 529, "1"), t(1, 69, 529, "1210040"), t(1, 138, 529, 'VALV. CHECK BOLA PVC/EPDM, 4" CEM,'), t(1, 138, 518, "UNION SENC"),
    t(1, 350, 529, "1"), t(1, 371, 529, "PZA"), t(1, 413, 529, "13249.16"), t(1, 484.6, 529, "13,249.16"), t(1, 536, 529, "15 Días Hab."),
    t(1, 508, 122, "13,249.16"), t(1, 512, 105, "2,119.86"), t(1, 508, 86, "15,369.02"),
  ]);
  assert.equal(c.renglones[0].precio, 13249.16);
  assert.equal(c.renglones[0].importe, 13249.16);
  assert.equal(c.renglones[0].descripcion, 'VALV. CHECK BOLA PVC/EPDM, 4" CEM, UNION SENC');
  assert.equal(c.cuadra, true);
});
