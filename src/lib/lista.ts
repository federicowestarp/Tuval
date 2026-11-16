/** Separa "10 codos 90 1/2" en cantidad y descripción. Sin cantidad → 1. */
export function interpretarLinea(linea: string): { cantidad: number; descripcion: string } | null {
  const limpia = linea.replace(/^[\s\-•*·]+/, "").trim();
  if (!limpia) return null;
  const m = limpia.match(/^(\d+(?:[.,]\d+)?)\s*(?:x\s+|pzas?\.?\s+|piezas?\s+|pz\s+|tramos?\s+)?(.+)$/i);
  if (m && !/^["'/]/.test(m[2])) {
    const cantidad = Number(m[1].replace(",", "."));
    if (cantidad > 0 && cantidad <= 10000) return { cantidad, descripcion: m[2].trim() };
  }
  return { cantidad: 1, descripcion: limpia };
}
