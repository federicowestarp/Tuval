"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { recalcularPrecios } from "@/lib/precios";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** "35" o "35%" → 0.35. Vacío → null. */
const pct = (v: string) => { const n = Number(v.replace("%", "")); return v === "" ? null : n > 0 && n < 95 ? n / 100 : undefined; };

export async function guardarMargenes(fd: FormData) {
  await requerirInterno("admin");
  const lista = t(fd, "lista");
  if (!UUID.test(lista)) return;
  await sql.begin(async (tx) => {
    const base = pct(t(fd, "margen_base"));
    if (base !== undefined) await tx`update listas_precio set margen_base = ${base} where id = ${lista}`;
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("cat_")) continue;
      const m = pct(String(v).trim()), cat = k.slice(4);
      if (m === null) await tx`delete from margenes_lista where lista_id = ${lista} and categoria_id = ${cat}`;
      else if (m !== undefined) await tx`insert into margenes_lista (lista_id, categoria_id, margen) values (${lista}, ${cat}, ${m})
                                          on conflict (lista_id, categoria_id) do update set margen = excluded.margen`;
    }
    await recalcularPrecios(tx);
  });
  refrescar("/interno/precios");
  refrescar("/tienda");
}

export async function recalcularTodo() {
  await requerirInterno("admin");
  await recalcularPrecios();
  refrescar("/interno/precios");
  refrescar("/tienda");
}

export async function crearLista(fd: FormData) {
  await requerirInterno("admin");
  const nombre = t(fd, "nombre");
  if (nombre.length < 2) return;
  await sql`insert into listas_precio (nombre, descripcion) values (${nombre.slice(0, 60)}, ${t(fd, "descripcion") || null}) on conflict (nombre) do nothing`;
  refrescar("/interno/precios");
}

/** Precio fijo (no se recalcula) para un producto en una lista. Precio con IVA → se guarda sin IVA. Vacío = quitar fijo. */
export async function precioFijo(fd: FormData) {
  await requerirInterno("admin");
  const lista = t(fd, "lista"), producto = t(fd, "producto");
  if (!UUID.test(lista) || !UUID.test(producto)) return;
  const v = Number(t(fd, "precio_con_iva").replace(/[$,\s]/g, ""));
  if (v > 0) {
    await sql`insert into precios (lista_id, producto_id, precio, fijo) values (${lista}, ${producto}, ${Math.round((v / 1.16) * 1e6) / 1e6}, true)
              on conflict (lista_id, producto_id) do update set precio = excluded.precio, fijo = true, actualizado_en = now()`;
  } else {
    await sql`update precios set fijo = false where lista_id = ${lista} and producto_id = ${producto}`;
    await recalcularPrecios(sql, [producto]);
  }
  refrescar("/interno/precios");
}
