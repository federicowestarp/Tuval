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

export const IVA = 0.16;

export const formatoMoneda = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
