/** Lee un CFDI (XML) de factura: folio, total y conceptos. Sin dependencias: el CFDI es XML plano. */
export function leerCfdi(xml: string) {
  const attr = (tag: string, nombre: string) => tag.match(new RegExp(`\\b${nombre}="([^"]*)"`, "i"))?.[1] ?? null;
  const comp = xml.match(/<(?:cfdi:)?Comprobante\b[^>]*>/i)?.[0] ?? "";
  const conceptos = [...xml.matchAll(/<(?:cfdi:)?Concepto\b[^>]*>/gi)].map((m) => ({
    codigo: attr(m[0], "NoIdentificacion"), descripcion: attr(m[0], "Descripcion") ?? "",
    cantidad: Number(attr(m[0], "Cantidad") ?? 0), valorUnitario: Number(attr(m[0], "ValorUnitario") ?? 0), importe: Number(attr(m[0], "Importe") ?? 0),
  }));
  return { folio: [attr(comp, "Serie"), attr(comp, "Folio")].filter(Boolean).join("-") || null, subtotal: Number(attr(comp, "SubTotal") ?? 0), total: Number(attr(comp, "Total") ?? 0), conceptos };
}

