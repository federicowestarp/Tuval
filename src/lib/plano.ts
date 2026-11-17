import { sql } from "./db";
import { sucursal } from "./inventario";

export type Ubicacion = { id: string; codigo: string; pasillo: string | null; anaquel: string | null; nivel: string | null };

/** Ubicaciones del almacén (por defecto la sucursal), ordenadas como se recorren. */
export async function ubicacionesDe(almacenId?: string): Promise<Ubicacion[]> {
  const id = almacenId ?? (await sucursal()).id;
  return sql<Ubicacion[]>`
    select id, codigo, pasillo, anaquel, nivel from ubicaciones where almacen_id = ${id}
    order by orden nulls last, ${ordenNatural("pasillo")}, ${ordenNatural("anaquel")}, ${ordenNatural("nivel")}`;
}

const ordenNatural = (c: "pasillo" | "anaquel" | "nivel") =>
  sql`nullif(regexp_replace(${sql(c)}, '\\D', '', 'g'), '')::int nulls last, ${sql(c)}`;

/** Texto para la persona: "Pasillo 2 · Anaquel B · Nivel 3 de 5 (contando desde abajo)". */
export function describirUbicacion(u: Ubicacion | null | undefined, todas: Ubicacion[] = []): string {
  if (!u) return "Sin ubicación capturada";
  const partes = [u.pasillo && `Pasillo ${u.pasillo}`, u.anaquel && `Anaquel ${u.anaquel}`].filter(Boolean) as string[];
  if (u.nivel) {
    const niveles = todas.filter((x) => x.pasillo === u.pasillo && x.anaquel === u.anaquel).length;
    partes.push(`Nivel ${u.nivel}${niveles > 1 ? ` de ${niveles}` : ""} (contando desde abajo)`);
  }
  return partes.length ? partes.join(" · ") : u.codigo;
}

/** Orden de recorrido para surtir: pasillo, anaquel y nivel (los sin ubicación al final). */
export function ordenRecorrido(a: Ubicacion | null, b: Ubicacion | null, todas: Ubicacion[]) {
  const i = (u: Ubicacion | null) => (u ? todas.findIndex((x) => x.id === u.id) : Infinity);
  return i(a) - i(b);
}
