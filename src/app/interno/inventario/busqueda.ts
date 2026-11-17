"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { buscarProductos, sucursal, type ProductoMostrador } from "@/lib/inventario";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function buscarEnSucursal(q: string): Promise<ProductoMostrador[]> {
  await requerirInterno("mostrador");
  return buscarProductos(String(q).slice(0, 80), (await sucursal()).id);
}

/** Un código escaneado que no existe se liga a un producto (una sola vez por código). */
export async function asignarCodigo(productoId: string, codigo: string): Promise<{ error?: string }> {
  await requerirInterno("mostrador");
  const c = String(codigo).trim();
  if (!UUID.test(productoId) || !/^[0-9A-Za-z\-.]{4,40}$/.test(c)) return { error: "Código no válido." };
  const [otro] = await sql<{ nombre: string }[]>`select nombre from productos where codigo_barras = ${c} and id <> ${productoId}`;
  if (otro) return { error: `Ese código ya es de: ${otro.nombre}` };
  await sql`update productos set codigo_barras = ${c} where id = ${productoId}`;
  return {};
}
