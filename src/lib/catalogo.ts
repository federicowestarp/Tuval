import { sql } from "@/lib/db";
import type { Categoria } from "@/lib/categorias";

export type Producto = {
  id: string;
  sku: string;
  nombre: string;
  categoria_id: Categoria;
  atributos: Record<string, string>;
  unidad: string;
  precio: number | null; // sin IVA; null = por confirmar
};

const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Búsqueda por nombre, SKU o atributo, sin importar acentos ni mayúsculas. */
export async function buscarProductos(q: string, categoria?: Categoria): Promise<Producto[]> {
  const terminos = q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const filtroTexto = terminos.reduce(
    (acc, t) =>
      sql`${acc} and unaccent(lower(p.nombre || ' ' || p.sku || ' ' || p.atributos::text)) like unaccent(lower(${"%" + escaparLike(t) + "%"}))`,
    sql`true`,
  );
  return sql<Producto[]>`
    select p.id, p.sku, p.nombre, p.categoria_id, p.atributos, p.unidad, pr.precio
    from productos p
    left join precios pr on pr.producto_id = p.id
      and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo
      and ${categoria ? sql`p.categoria_id = ${categoria}` : sql`true`}
      and ${filtroTexto}
    order by p.nombre
    limit 60`;
}

export async function productosPorId(ids: string[]): Promise<Producto[]> {
  if (ids.length === 0) return [];
  return sql<Producto[]>`
    select p.id, p.sku, p.nombre, p.categoria_id, p.atributos, p.unidad, pr.precio
    from productos p
    left join precios pr on pr.producto_id = p.id
      and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo and p.id = any(${ids}::uuid[])`;
}

/**
 * Sugerencias para una línea escrita por el cliente ("10 codos 90 1/2").
 * Ordena por cuántas palabras coinciden; exige al menos la mitad.
 */
export async function sugerirProductos(texto: string, limite = 3): Promise<Producto[]> {
  const terminos = texto
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^(de|del|la|el|los|las|para|con|y|pza|pzas|piezas?|tramos?)$/, ""))
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (terminos.length === 0) return [];
  const minimo = Math.max(1, Math.ceil(terminos.length / 2));
  const puntaje = terminos.reduce(
    (acc, t) =>
      sql`${acc} + (unaccent(lower(p.nombre || ' ' || p.sku || ' ' || p.atributos::text)) like unaccent(lower(${"%" + escaparLike(t) + "%"})))::int`,
    sql`0`,
  );
  return sql<Producto[]>`
    select * from (
      select p.id, p.sku, p.nombre, p.categoria_id, p.atributos, p.unidad, pr.precio, ${puntaje} as puntaje
      from productos p
      left join precios pr on pr.producto_id = p.id
        and pr.lista_id = (select id from listas_precio where nombre = 'Público')
      where p.activo
    ) x
    where puntaje >= ${minimo}
    order by puntaje desc, nombre
    limit ${limite}`;
}

export const IVA = 0.16;

export { formatoMoneda } from "@/lib/catalogo-formato";

export async function productoPorSku(sku: string): Promise<(Producto & { marca: string | null; existencia_prov: number }) | null> {
  if (!/^[A-Za-z0-9-]{1,60}$/.test(sku)) return null;
  const [p] = await sql<(Producto & { marca: string | null; existencia_prov: number })[]>`
    select p.id, p.sku, p.nombre, p.categoria_id, p.atributos, p.unidad, p.marca, pr.precio,
           coalesce((select sum(cantidad) from existencias e where e.producto_id = p.id), 0) existencia_prov
    from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo and upper(p.sku) = upper(${sku})`;
  return p ?? null;
}

export async function relacionados(categoria: string, excluir: string, n = 4): Promise<Producto[]> {
  return sql<Producto[]>`
    select p.id, p.sku, p.nombre, p.categoria_id, p.atributos, p.unidad, pr.precio
    from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo and p.categoria_id = ${categoria} and p.id <> ${excluir}
    order by (pr.precio is null), random() limit ${n}`;
}

export async function skusPublicos(limite = 5000): Promise<{ sku: string }[]> {
  return sql<{ sku: string }[]>`select sku from productos where activo order by sku limit ${limite}`;
}
