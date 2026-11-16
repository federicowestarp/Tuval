/** Lector de CSV (comillas, comas dentro de comillas, saltos de línea "\r\n"). Devuelve objetos por encabezado. */
export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [], celda = "", comillas = false;
  const t = texto.replace(/^﻿/, "");
  const sep = (t.split("\n")[0].match(/;/g)?.length ?? 0) > (t.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else if (c !== "\r") celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  const [enc, ...resto] = filas.filter((f) => f.some((x) => x.trim()));
  if (!enc) return [];
  const claves = enc.map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return resto.map((f) => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? "").trim()])));
}
