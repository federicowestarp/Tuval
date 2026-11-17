import { sql } from "./db";

/** Productos con etiqueta impresa cuyo precio (con IVA) o nombre ya no coincide con lo impreso. */
export async function etiquetasDesactualizadas() {
  return sql<{ id: string; sku: string; nombre: string; impreso: number | null; actual: number | null }[]>`
    select p.id, p.sku, p.nombre, ei.precio::float impreso, round(pr.precio * 1.16, 2)::float actual
    from etiquetas_impresas ei join productos p on p.id = ei.producto_id
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.activo and (ei.precio is distinct from round(pr.precio * 1.16, 2) or ei.nombre is distinct from p.nombre)
    order by p.nombre`;
}
