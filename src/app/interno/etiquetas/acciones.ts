"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Al imprimir: guarda con qué precio y nombre salió cada etiqueta (para avisar cuando cambien). */
export async function registrarImpresion(ids: string[]) {
  const yo = await requerirInterno("mostrador");
  const v = ids.filter((x) => UUID.test(x)).slice(0, 500);
  if (v.length === 0) return;
  await sql`
    insert into etiquetas_impresas (producto_id, precio, nombre, impresa_en, impresa_por)
    select p.id, round(pr.precio * 1.16, 2), p.nombre, now(), ${yo.id}
    from productos p left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where p.id = any(${v}::uuid[])
    on conflict (producto_id) do update set precio = excluded.precio, nombre = excluded.nombre, impresa_en = now(), impresa_por = excluded.impresa_por`;
  refrescar("/interno/etiquetas");
  refrescar("/interno/mostrador");
}
