"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { leerCsv } from "@/lib/csv";
import { normalizarRenglon, type ProductoImportado } from "@/lib/importar";

export type ResultadoImportacion = {
  error?: string;
  vista?: { total: number; conPrecio: number; porCategoria: Record<string, number>; ejemplos: ProductoImportado[] };
  importados?: number;
};

const ORIGEN = /^[a-z0-9-]{2,30}$/;

async function leer(fd: FormData) {
  const f = fd.get("archivo");
  if (!f || typeof f === "string" || f.size === 0) return { error: "Elige el archivo CSV." } as const;
  if (f.size > 15 * 1024 * 1024) return { error: "El archivo pesa más de 15 MB." } as const;
  const renglones = leerCsv(await f.text()).map(normalizarRenglon).filter((p): p is ProductoImportado => p !== null);
  if (renglones.length === 0) return { error: "No encontré productos. ¿El CSV tiene encabezados (nombre, precio…)?" } as const;
  // SKU único: mismo SKU y mismo nombre = mismo producto (gana el último); nombre distinto = sufijo -2, -3…
  const porSku = new Map<string, ProductoImportado>();
  for (const p of renglones) {
    let sku = p.sku, n = 1;
    while (porSku.has(sku) && porSku.get(sku)!.nombre.toLowerCase() !== p.nombre.toLowerCase()) sku = `${p.sku}-${++n}`;
    porSku.set(sku, { ...p, sku });
  }
  return { productos: [...porSku.values()] } as const;
}

/** Paso 1: vista previa sin guardar nada. */
export async function revisarCatalogo(_prev: ResultadoImportacion, fd: FormData): Promise<ResultadoImportacion> {
  await requerirInterno("admin");
  const r = await leer(fd);
  if ("error" in r) return { error: r.error };
  const porCategoria: Record<string, number> = {};
  for (const p of r.productos) porCategoria[p.categoria] = (porCategoria[p.categoria] ?? 0) + 1;
  return {
    vista: { total: r.productos.length, conPrecio: r.productos.filter((p) => p.precio != null).length, porCategoria, ejemplos: r.productos.slice(0, 8) },
  };
}

/** Paso 2: guarda productos, precios (lista Público), costo del proveedor y existencias en el almacén indicado. */
export async function importarCatalogo(_prev: ResultadoImportacion, fd: FormData): Promise<ResultadoImportacion> {
  await requerirInterno("admin");
  const origen = String(fd.get("origen") ?? "").trim().toLowerCase();
  const almacen = String(fd.get("almacen") ?? "").trim();
  if (!ORIGEN.test(origen)) return { error: "El origen debe ser corto, sin espacios (ej. puraqua-prueba)." };
  const r = await leer(fd);
  if ("error" in r) return { error: r.error };
  const ps = r.productos;

  await sql.begin(async (tx) => {
    const ids = new Map<string, string>();
    for (let i = 0; i < ps.length; i += 500) {
      const l = ps.slice(i, i + 500);
      const res = await tx<{ id: string; sku: string }[]>`
        insert into productos (sku, nombre, categoria_id, unidad, atributos, sat_clave_prod_serv, sat_clave_unidad, origen, marca)
        select sku, nombre, cat, unidad, atr::jsonb, sat, satu, ${origen}, marca
        from unnest(${l.map((p) => p.sku)}::text[], ${l.map((p) => p.nombre)}::text[], ${l.map((p) => p.categoria)}::text[],
                    ${l.map((p) => p.unidad)}::text[], ${l.map((p) => JSON.stringify(p.atributos))}::text[],
                    ${l.map((p) => p.satClave)}::text[], ${l.map((p) => p.satUnidad)}::text[], ${l.map((p) => p.marca)}::text[])
             as t(sku, nombre, cat, unidad, atr, sat, satu, marca)
        on conflict (sku) do update set
          nombre = excluded.nombre, categoria_id = excluded.categoria_id, unidad = excluded.unidad,
          atributos = excluded.atributos, marca = excluded.marca, origen = excluded.origen,
          sat_clave_prod_serv = coalesce(excluded.sat_clave_prod_serv, productos.sat_clave_prod_serv),
          sat_clave_unidad = coalesce(excluded.sat_clave_unidad, productos.sat_clave_unidad),
          activo = true
        returning id, sku`;
      res.forEach((x) => ids.set(x.sku, x.id));
    }
    const id = (sku: string) => ids.get(sku)!;

    const conPrecio = ps.filter((p) => p.precio != null);
    if (conPrecio.length) {
      await tx`
        insert into precios (lista_id, producto_id, precio)
        select (select id from listas_precio where nombre = 'Público'), pid, pr
        from unnest(${conPrecio.map((p) => id(p.sku))}::uuid[], ${conPrecio.map((p) => p.precio!)}::numeric[]) as t(pid, pr)
        on conflict (lista_id, producto_id) do update set precio = excluded.precio, vigente_desde = now()`;
    }

    // Costos por proveedor (se crea el proveedor si no existe).
    const provIds = new Map<string, string>();
    for (const n of new Set(ps.map((p) => p.proveedor).filter((x): x is string => !!x))) {
      let [pv] = await tx<{ id: string }[]>`select id from proveedores where lower(nombre) = lower(${n}) limit 1`;
      if (!pv) [pv] = await tx<{ id: string }[]>`insert into proveedores (nombre) values (${n}) returning id`;
      provIds.set(n, pv.id);
    }
    const conCosto = ps.filter((p) => p.proveedor && p.costo != null);
    if (conCosto.length) {
      await tx`
        insert into productos_proveedor (producto_id, proveedor_id, costo)
        select pid, prov, c from unnest(${conCosto.map((p) => id(p.sku))}::uuid[], ${conCosto.map((p) => provIds.get(p.proveedor!)!)}::uuid[], ${conCosto.map((p) => p.costo!)}::numeric[]) as t(pid, prov, c)
        on conflict (producto_id, proveedor_id) do update set costo = excluded.costo, actualizado_en = now()`;
    }

    // Existencias en un almacén de tipo proveedor: así no se anuncia "Disponible hoy" en Tuval.
    const conExistencia = ps.filter((p) => p.existencia != null);
    if (almacen && conExistencia.length) {
      let [a] = await tx<{ id: string }[]>`select id from almacenes where nombre = ${almacen}`;
      if (!a) [a] = await tx<{ id: string }[]>`insert into almacenes (nombre, tipo) values (${almacen}, 'proveedor') returning id`;
      await tx`
        insert into existencias (producto_id, almacen_id, cantidad)
        select pid, ${a.id}, greatest(0, c) from unnest(${conExistencia.map((p) => id(p.sku))}::uuid[], ${conExistencia.map((p) => p.existencia!)}::numeric[]) as t(pid, c)
        on conflict (producto_id, almacen_id) do update set cantidad = excluded.cantidad`;
    }
  });
  revalidatePath("/tienda");
  revalidatePath("/interno/catalogo");
  return { importados: ps.length };
}

/** Quita de la tienda todo lo que vino de un origen (p. ej. el catálogo de prueba). No borra: desactiva. */
export async function desactivarOrigen(fd: FormData) {
  await requerirInterno("admin");
  const origen = String(fd.get("origen") ?? "");
  if (!ORIGEN.test(origen)) return;
  await sql`update productos set activo = false where origen = ${origen}`;
  revalidatePath("/interno/catalogo");
  revalidatePath("/tienda");
}
