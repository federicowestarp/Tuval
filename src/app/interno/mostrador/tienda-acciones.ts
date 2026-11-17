"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { buscarProductos, sucursal, type ProductoMostrador } from "@/lib/inventario";

/** Caja: carga el carrito que el cliente armó en la tienda (por QR o código). */
export async function cargarCarritoTienda(codigo: string): Promise<{ error?: string; id?: string; lineas?: { producto: ProductoMostrador; cantidad: number }[]; clienteId?: string | null; vendedor?: string | null }> {
  await requerirInterno("mostrador");
  const c = String(codigo ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return { error: "Código no válido." };
  const [carrito] = await sql<{ id: string; lineas: { id: string; cantidad: number }[]; cobrado_en: Date | null; cliente_id: string | null; vendedor: string | null }[]>`
    select ct.id, ct.lineas, ct.cobrado_en, coalesce(ct.cliente_id, cu.cliente_id) cliente_id, v.nombre vendedor from carritos_tienda ct left join usuarios_internos v on v.id = ct.vendedor_id left join cuentas cu on cu.id = ct.cuenta_id
    where ct.codigo = ${c} and ct.creado_en > now() - interval '2 days'`;
  if (!carrito) return { error: `No encontré el carrito ${c} (vence a los 2 días).` };
  if (carrito.cobrado_en) return { error: `El carrito ${c} ya se cobró.` };
  const s = await sucursal();
  const productos = await sql<ProductoMostrador[]>`
    select p.id, p.sku, p.nombre, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float existencia, p.codigo_barras,
           coalesce(p.costo_promedio, (select min(costo) from productos_proveedor where producto_id = p.id))::float costo
    from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
    where p.id = any(${carrito.lineas.map((l) => l.id)}::uuid[]) and p.activo`;
  return {
    id: carrito.id, clienteId: carrito.cliente_id, vendedor: carrito.vendedor,
    lineas: carrito.lineas.flatMap((l) => { const producto = productos.find((p) => p.id === l.id); return producto ? [{ producto, cantidad: l.cantidad }] : []; }),
  };
}

/** Caja: producto por el QR de su etiqueta de anaquel (SKU). */
export async function productoPorEtiqueta(sku: string): Promise<ProductoMostrador | null> {
  await requerirInterno("mostrador");
  const s = await sucursal();
  const [p] = await buscarProductos(sku, s.id);
  return p && p.sku.toUpperCase() === sku.toUpperCase() ? p : null;
}

/** Venta asistida: el vendedor manda a caja lo que armó con el cliente (la venta queda a su nombre). */
export async function mandarACaja(lineas: { id: string; cantidad: number }[], clienteId: string | null): Promise<{ codigo?: string; error?: string }> {
  const yo = await requerirInterno("mostrador");
  const validas = (lineas ?? []).filter((l) => /^[0-9a-f-]{36}$/i.test(l.id) && Number(l.cantidad) > 0).slice(0, 100).map((l) => ({ id: l.id, cantidad: Number(l.cantidad) }));
  if (validas.length === 0) return { error: "Agrega al menos un producto." };
  const cliente = clienteId && /^[0-9a-f-]{36}$/i.test(clienteId) ? clienteId : null;
  const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const { randomInt } = await import("node:crypto");
  for (let i = 0; i < 5; i++) {
    const codigo = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    const [r] = await sql<{ codigo: string }[]>`
      insert into carritos_tienda (codigo, lineas, vendedor_id, cliente_id) values (${codigo}, ${sql.json(validas)}, ${yo.id}, ${cliente})
      on conflict (codigo) do nothing returning codigo`;
    if (r) return { codigo: r.codigo };
  }
  return { error: "No se pudo generar el código, intenta de nuevo." };
}
