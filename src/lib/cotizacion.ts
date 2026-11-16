/**
 * Lee una cotización pegada desde Excel o correo.
 * Columnas esperadas, en este orden: código | descripción | cantidad | precio unitario | disponible | tiempo de entrega
 * Separador: tabulador (copiar de Excel), punto y coma o coma. Los renglones sin precio numérico (encabezados) se ignoran.
 * Pendiente: ajustar al formato real de Emmsa cuando tengamos una cotización de ejemplo.
 */
export type RenglonCotizacion = {
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  precio: number;
  disponible: boolean | null;
  tiempo: string;
};

const numero = (s: string): number | null => {
  const limpio = s.replace(/[$\s]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
};

function disponibilidad(s: string): boolean | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (/^(s[ií]|x|disponible|inmediato|inmediata|ok)$/.test(v)) return true;
  if (/^(no|agotado|sin existencia|0)$/.test(v)) return false;
  const n = numero(v);
  return n == null ? null : n > 0;
}

export function leerCotizacion(texto: string): RenglonCotizacion[] {
  const filas = texto.split(/\r?\n/).filter((f) => f.trim());
  return filas.flatMap((f) => {
    const sep = f.includes("\t") ? "\t" : f.includes(";") ? ";" : ",";
    const c = f.split(sep).map((x) => x.trim());
    if (c.length < 4) return [];
    const precio = numero(c[3]);
    if (precio == null || precio < 0) return [];
    return [{
      codigo: c[0],
      descripcion: c[1],
      cantidad: numero(c[2]),
      precio,
      disponible: disponibilidad(c[4] ?? ""),
      tiempo: c[5] ?? "",
    }];
  });
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/".]+/g, " ").trim();
