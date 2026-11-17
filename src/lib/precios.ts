import type postgres from "postgres";
import { sql } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

/**
 * Recalcula precios (sin IVA) de las listas con margen: precio = costo ÷ (1 − margen).
 * Margen de la categoría en esa lista, o el margen base de la lista. Costo = costo promedio del inventario
 * o, si no hay, el menor costo de proveedor. Los precios marcados "fijo" no se tocan.
 */
export async function recalcularPrecios(tx: Tx = sql, productos?: string[]) {
  const r = await tx`
    insert into precios (lista_id, producto_id, precio, actualizado_en)
    select l.id, p.id, round(k.costo / (1 - coalesce(m.margen, l.margen_base)), 2), now()
    from productos p
    cross join listas_precio l
    left join margenes_lista m on m.lista_id = l.id and m.categoria_id = p.categoria_id
    cross join lateral (select coalesce(p.costo_promedio, (select min(costo) from productos_proveedor pp where pp.producto_id = p.id and pp.costo > 0)) costo) k
    where l.activa and p.activo and k.costo > 0 and coalesce(m.margen, l.margen_base) is not null
      ${productos?.length ? tx`and p.id = any(${productos}::uuid[])` : tx``}
    on conflict (lista_id, producto_id) do update set precio = excluded.precio, actualizado_en = now()
    where not precios.fijo and precios.precio is distinct from excluded.precio`;
  return r.count;
}

/** Precio sin IVA para la lista del cliente; si no tiene precio en esa lista, el de Público. */
export async function preciosParaLista(productos: string[], listaId: string | null, tx: Tx = sql) {
  const filas = await tx<{ id: string; precio: number | null }[]>`
    select p.id, coalesce(
      ${listaId ? tx`(select precio from precios where producto_id = p.id and lista_id = ${listaId})` : tx`null`},
      (select precio from precios where producto_id = p.id and lista_id = (select id from listas_precio where nombre = 'Público')))::float precio
    from productos p where p.id = any(${productos}::uuid[])`;
  return new Map(filas.map((f) => [f.id, f.precio]));
}
