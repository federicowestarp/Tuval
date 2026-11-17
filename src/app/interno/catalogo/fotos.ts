"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { guardarArchivo, TIPOS_IMAGEN } from "@/lib/archivos";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Borra el archivo de la foto anterior si ya nadie la usa (no deja basura en la base). */
async function soltarAnterior(url: string | null) {
  const id = url?.match(/^\/fotos\/([0-9a-f-]{36})$/i)?.[1];
  if (id) await sql`delete from archivos where id = ${id} and not exists (select 1 from productos where imagen_url = ${url})`;
}

export async function subirFoto(fd: FormData): Promise<{ error?: string; url?: string }> {
  await requerirInterno("admin");
  const producto = String(fd.get("producto_id"));
  if (!UUID.test(producto)) return { error: "Producto no válido." };
  let id: string | null;
  try { id = await guardarArchivo(fd.get("foto"), TIPOS_IMAGEN); } catch (e) { return { error: (e as Error).message }; }
  if (!id) return { error: "Elige una foto." };
  const [antes] = await sql<{ imagen_url: string | null }[]>`select imagen_url from productos where id = ${producto}`;
  const url = `/fotos/${id}`;
  await sql`update productos set imagen_url = ${url} where id = ${producto}`;
  await soltarAnterior(antes?.imagen_url ?? null);
  refrescar("/interno/catalogo");
  refrescar("/tienda");
  return { url };
}

export async function quitarFoto(fd: FormData) {
  await requerirInterno("admin");
  const producto = String(fd.get("producto_id"));
  if (!UUID.test(producto)) return;
  const [antes] = await sql<{ imagen_url: string | null }[]>`update productos p set imagen_url = null from productos o where p.id = o.id and p.id = ${producto} returning o.imagen_url`;
  await soltarAnterior(antes?.imagen_url ?? null);
  refrescar("/interno/catalogo");
}
