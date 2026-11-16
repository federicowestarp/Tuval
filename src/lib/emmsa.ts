/**
 * Lector de cotizaciones PDF de Emmsa (plantilla "COTIZACIÓN · Sistemas de Tubería").
 * Reconstruye renglones por posición del texto: las columnas de la plantilla son fijas.
 * Valida que la suma de importes cuadre con el subtotal impreso.
 */
export type TextoPdf = { pagina: number; x: number; y: number; str: string };

export type RenglonEmmsa = {
  partida: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;      // unitario, sin IVA
  importe: number;
  tiempo: string;      // "1 Día Hab."
  dias: number | null; // días hábiles de entrega
};

export type CotizacionEmmsa = {
  folio: string | null;
  fecha: string | null;
  vigencia: string | null;
  condiciones: string | null;
  renglones: RenglonEmmsa[];
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  cuadra: boolean; // suma de importes = subtotal impreso
};

// Rangos de columnas (puntos PDF) de la plantilla de Emmsa.
const COL = {
  partida: [30, 62], codigo: [62, 132], descripcion: [132, 340], cantidad: [340, 366],
  unidad: [366, 400], montos: [400, 532], tiempo: [532, 640],
} as const;
const TABLA_Y = [140, 545] as const;

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const en = (x: number, [a, b]: readonly [number, number]) => x >= a && x < b;
const unir = (items: TextoPdf[]) => items.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim();

export function interpretarEmmsa(textos: TextoPdf[]): CotizacionEmmsa {
  // Agrupa en filas: misma página y misma altura (±2 pt). Orden de lectura: página, de arriba hacia abajo.
  const filas: { pagina: number; y: number; items: TextoPdf[] }[] = [];
  for (const t of textos.filter((t) => t.str.trim())) {
    const f = filas.find((f) => f.pagina === t.pagina && Math.abs(f.y - t.y) <= 2);
    if (f) f.items.push(t);
    else filas.push({ pagina: t.pagina, y: t.y, items: [t] });
  }
  filas.sort((a, b) => a.pagina - b.pagina || b.y - a.y);

  const renglones: RenglonEmmsa[] = [];
  for (const f of filas) {
    if (f.y < TABLA_Y[0] || f.y > TABLA_Y[1]) continue;
    const col = (c: keyof typeof COL) => unir(f.items.filter((i) => en(i.x, COL[c])));
    const partida = col("partida");
    if (/^\d+$/.test(partida)) {
      const tiempo = col("tiempo");
      // Precio e importe van alineados a la derecha: un número largo se corre de columna. Se toman en orden.
      const montos = f.items.filter((i) => en(i.x, COL.montos)).sort((a, b) => a.x - b.x).map((i) => num(i.str.trim()));
      const dias = tiempo.match(/(\d+)\s*D[ií]a/i);
      renglones.push({
        partida: Number(partida),
        codigo: col("codigo"),
        descripcion: col("descripcion"),
        cantidad: num(col("cantidad")) ?? 0,
        unidad: col("unidad"),
        precio: montos[0] ?? 0,
        importe: montos[1] ?? 0,
        tiempo,
        dias: dias ? Number(dias[1]) : null,
      });
    } else if (renglones.length && f.items.every((i) => en(i.x, COL.descripcion))) {
      // Descripción que continúa en la siguiente línea (o en la siguiente página).
      const ultimo = renglones[renglones.length - 1];
      ultimo.descripcion = `${ultimo.descripcion} ${unir(f.items)}`.trim();
    }
  }

  const primera = textos.filter((t) => t.pagina === 1);
  const arriba = (yMin: number, yMax: number, xMin: number) =>
    unir(primera.filter((t) => t.y >= yMin && t.y <= yMax && t.x >= xMin)) || null;
  const folio = arriba(745, 760, 440);
  const fecha = arriba(722, 735, 440);
  const condiciones = arriba(688, 700, 430);
  const vig = arriba(675, 686, 430);

  const ultimaPagina = Math.max(...textos.map((t) => t.pagina));
  const totales = textos
    .filter((t) => t.pagina === ultimaPagina && t.y < TABLA_Y[0] && t.x > 480 && num(t.str) != null)
    .sort((a, b) => b.y - a.y)
    .map((t) => num(t.str)!);
  const [subtotal = null, iva = null, total = null] = totales;
  const suma = Math.round(renglones.reduce((s, r) => s + r.importe, 0) * 100) / 100;

  return {
    folio: folio && /^\d+$/.test(folio) ? folio : null,
    fecha: fecha && /^\d{2}-[A-Z]{3}-\d{2}$/.test(fecha) ? fecha : null,
    vigencia: vig && /^\d{2}-[A-Z]{3}-\d{2}$/.test(vig) ? vig : null,
    condiciones,
    renglones,
    subtotal, iva, total,
    cuadra: subtotal != null && Math.abs(suma - subtotal) < 0.05,
  };
}

/** Extrae el texto con posiciones de un PDF (servidor). */
export async function textosDePdf(datos: Uint8Array): Promise<TextoPdf[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(datos);
  const textos: TextoPdf[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const contenido = await (await pdf.getPage(p)).getTextContent();
    for (const it of contenido.items) {
      if ("str" in it && it.str.trim()) textos.push({ pagina: p, x: it.transform[4], y: it.transform[5], str: it.str });
    }
  }
  return textos;
}

export async function leerPdfEmmsa(datos: Uint8Array): Promise<CotizacionEmmsa> {
  return interpretarEmmsa(await textosDePdf(datos));
}
