import type postgres from "postgres";
import { sql } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción, con o sin tipos personalizados
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

export type TipoMovimiento = "entrada_compra" | "salida_venta" | "traspaso" | "ajuste_conteo" | "retiro_obra" | "devolucion";

/** La sucursal principal (creada por la migración 0013). */
export async function sucursal(tx: Tx = sql): Promise<{ id: string; nombre: string }> {
  const [s] = await tx<{ id: string; nombre: string }[]>`select id, nombre from almacenes where tipo = 'sucursal' and activo order by creado_en limit 1`;
  if (!s) throw new Error("No hay sucursal dada de alta");
  return s;
}

/**
 * Único camino para mover inventario: deja el movimiento en el libro y ajusta existencias.
 * cantidad siempre positiva; origen resta, destino suma.
 */
export async function mover(tx: Tx, m: {
  producto: string; cantidad: number; tipo: TipoMovimiento; origen?: string | null; destino?: string | null;
  costo?: number | null; referencia?: string | null; nota?: string | null; pedido?: string | null; usuario?: string | null; escaneado?: boolean;
}) {
  if (!(m.cantidad > 0)) throw new Error("Cantidad inválida");
  await tx`
    insert into movimientos_inventario (producto_id, almacen_origen, almacen_destino, cantidad, tipo, referencia, usuario_id, escaneado, costo_unitario, nota, pedido_id)
    values (${m.producto}, ${m.origen ?? null}, ${m.destino ?? null}, ${m.cantidad}, ${m.tipo}, ${m.referencia ?? null}, ${m.usuario ?? null},
            ${m.escaneado ?? false}, ${m.costo ?? null}, ${m.nota ?? null}, ${m.pedido ?? null})`;
  if (m.origen) await tx`
    insert into existencias (producto_id, almacen_id, cantidad) values (${m.producto}, ${m.origen}, ${-m.cantidad})
    on conflict (producto_id, almacen_id) do update set cantidad = existencias.cantidad - ${m.cantidad}, actualizado_en = now()`;
  if (m.destino) await tx`
    insert into existencias (producto_id, almacen_id, cantidad) values (${m.producto}, ${m.destino}, ${m.cantidad})
    on conflict (producto_id, almacen_id) do update set cantidad = existencias.cantidad + ${m.cantidad}, actualizado_en = now()`;
}

/** Entrada de compra con costo: actualiza el costo promedio ponderado del producto. */
export async function entradaCompra(tx: Tx, p: { producto: string; cantidad: number; costo: number | null; almacen: string; referencia?: string | null; usuario?: string | null; escaneado?: boolean }) {
  if (p.costo != null && p.costo > 0) {
    await tx`
      update productos set costo_promedio = round((
        coalesce(costo_promedio, ${p.costo}::numeric) * greatest(coalesce((select sum(cantidad) from existencias where producto_id = ${p.producto}), 0), 0)
        + ${p.costo}::numeric * ${p.cantidad}::numeric
      ) / (greatest(coalesce((select sum(cantidad) from existencias where producto_id = ${p.producto}), 0), 0) + ${p.cantidad}::numeric), 2)
      where id = ${p.producto}`;
  }
  await mover(tx, { producto: p.producto, cantidad: p.cantidad, tipo: "entrada_compra", destino: p.almacen, costo: p.costo, referencia: p.referencia, usuario: p.usuario, escaneado: p.escaneado });
}

/** Recalcula existencias desde el libro de movimientos (se usa al borrar datos de prueba). */
export async function recalcularExistencias(tx: Tx, productos: string[]) {
  if (productos.length === 0) return;
  await tx`
    update existencias e set cantidad = coalesce((
      select sum(case when m.almacen_destino = e.almacen_id then m.cantidad else 0 end)
           - sum(case when m.almacen_origen = e.almacen_id then m.cantidad else 0 end)
      from movimientos_inventario m where m.producto_id = e.producto_id), 0), actualizado_en = now()
    where e.producto_id = any(${productos}::uuid[])`;
}

export type ProductoMostrador = { id: string; sku: string; nombre: string; unidad: string; precio: number | null; existencia: number; codigo_barras: string | null; costo: number | null };

/** Búsqueda para mostrador e inventario: primero código de barras o SKU exacto, luego por texto. */
export async function buscarProductos(q: string, almacen: string): Promise<ProductoMostrador[]> {
  const t = q.trim();
  if (!t) return [];
  const campos = sql`
    p.id, p.sku, p.nombre, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float existencia, p.codigo_barras,
    coalesce(p.costo_promedio, (select min(costo) from productos_proveedor where producto_id = p.id))::float costo`;
  const joins = sql`
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    left join existencias e on e.producto_id = p.id and e.almacen_id = ${almacen}`;
  const exacto = await sql<ProductoMostrador[]>`
    select ${campos} from productos p ${joins} where p.activo and (p.codigo_barras = ${t} or upper(p.sku) = upper(${t})) limit 1`;
  if (exacto.length) return exacto;
  const palabras = t.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  return sql<ProductoMostrador[]>`
    select ${campos} from productos p ${joins}
    where p.activo and ${palabras.map((w) => sql`(lower(p.nombre) like ${"%" + w + "%"} or lower(p.sku) like ${"%" + w + "%"})`).reduce((a, b) => sql`${a} and ${b}`)}
    order by (e.cantidad > 0) desc nulls last, p.nombre limit 12`;
}
