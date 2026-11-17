/**
 * Convierte lo que el cliente dice o escribe en el quiosco ("necesito dos codos de media", "válvula de bola
 * de pulgada y media") en búsquedas para el catálogo ("codo 1/2", "valvula bola 1 1/2"). Sin IA ni costo.
 * Devuelve variantes de la más específica a la más general.
 */
const MEDIDAS: [RegExp, string][] = [
  [/\bpulgada y media\b/g, "1 1/2"],
  [/\bpulgada y cuarto\b/g, "1 1/4"],
  [/\bdos pulgadas y media\b/g, "2 1/2"],
  [/\btres cuartos\b/g, "3/4"],
  [/\bun cuarto\b|\bcuarto de pulgada\b/g, "1/4"],
  [/\bun octavo\b|\boctavo\b/g, "1/8"],
  [/\bmedia pulgada\b|\bde media\b|\bmedia\b/g, "1/2"],
  [/\b(una|1) pulgada\b|\bde pulgada\b|\bpulgada\b/g, "1"],
  [/\bdos pulgadas\b/g, "2"],
  [/\btres pulgadas\b/g, "3"],
  [/\bcuatro pulgadas\b/g, "4"],
];
const RELLENO = new Set(("necesito busco buscando quiero ocupo me da dame tienen tiene hay donde esta estan un una unos unas el la los las de del para por favor con a " +
  "dos tres cuatro cinco seis siete ocho nueve diez docena par pieza piezas tramo tramos").split(" "));

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
// "reductores" → reductor, "tapones" → tapon, "coples" → cople, "codos" → codo.
const singular = (w: string) => (/[aeiou][rnldj]es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

export function normalizarBusqueda(texto: string): string[] {
  let t = sinAcentos(texto.toLowerCase()).replace(/["”]/g, " ").replace(/[¿?¡!.,;:]/g, " ");
  for (const [re, v] of MEDIDAS) t = t.replace(re, ` ${v} `);
  const palabras = t.split(/\s+/).filter(Boolean).filter((w) => !RELLENO.has(w)).map((w) => (/\d/.test(w) ? w : singular(w)));
  const medidas = palabras.filter((w) => /\d/.test(w));
  const nombres = palabras.filter((w) => !/\d/.test(w));
  const variantes = [palabras.join(" "), nombres.slice(0, 2).concat(medidas).join(" "), nombres.join(" "), nombres[0] ?? ""]
    .map((v) => v.trim()).filter(Boolean);
  return [...new Set(variantes)].slice(0, 4);
}
