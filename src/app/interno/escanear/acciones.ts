"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quién surte el producto: proveedor principal y alterno (pueden ser dos distintos, o solo uno). */
export async function guardarSurtidores(fd: FormData) {
  await requerirInterno("operador");
  const producto = String(fd.get("producto_id"));
  const principal = String(fd.get("principal") ?? "");
  const alterno = String(fd.get("alterno") ?? "");
  if (!UUID.test(producto)) return;
  await sql.begin(async (tx) => {
    await tx`update productos_proveedor set preferencia = null where producto_id = ${producto}`;
    for (const [prov, pref] of [[principal, 1], [alterno, 2]] as const) {
      if (!UUID.test(prov) || (pref === 2 && prov === principal)) continue;
      await tx`insert into productos_proveedor (producto_id, proveedor_id, preferencia, actualizado_en) values (${producto}, ${prov}, ${pref}, now())
               on conflict (producto_id, proveedor_id) do update set preferencia = excluded.preferencia`;
    }
  });
  const [p] = await sql<{ sku: string }[]>`select sku from productos where id = ${producto}`;
  if (p) refrescar(`/interno/escanear/${p.sku}`);
}
