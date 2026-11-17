"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { sucursal } from "@/lib/inventario";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "A-D" → A,B,C,D · "1-4" → 1..4 · "A,B,F" → A,B,F */
function rango(t: string): string[] {
  const s = t.trim().toUpperCase();
  const m = s.match(/^([A-Z]|\d+)\s*-\s*([A-Z]|\d+)$/);
  if (m) {
    const [a, b] = [m[1], m[2]];
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Array.from({ length: Math.max(0, Math.min(Number(b) - Number(a) + 1, 50)) }, (_, i) => String(Number(a) + i));
    if (/^[A-Z]$/.test(a) && /^[A-Z]$/.test(b)) return Array.from({ length: Math.max(0, b.charCodeAt(0) - a.charCodeAt(0) + 1) }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));
  }
  return s.split(/[,\s]+/).filter(Boolean).slice(0, 50);
}

/** Alta en bloque: un pasillo con sus anaqueles y niveles (código P1-A-3 = pasillo 1, anaquel A, nivel 3 desde abajo). */
export async function crearUbicaciones(fd: FormData) {
  await requerirInterno("supervisor");
  const pasillo = String(fd.get("pasillo") ?? "").trim().toUpperCase().slice(0, 10);
  const anaqueles = rango(String(fd.get("anaqueles") ?? ""));
  const niveles = Math.min(Math.max(Number(fd.get("niveles")) || 1, 1), 12);
  if (!pasillo || anaqueles.length === 0) return;
  const s = await sucursal();
  for (const a of anaqueles) for (let n = 1; n <= niveles; n++) {
    await sql`insert into ubicaciones (almacen_id, codigo, pasillo, anaquel, nivel) values (${s.id}, ${`P${pasillo}-${a}-${n}`}, ${pasillo}, ${a}, ${String(n)})
              on conflict (almacen_id, codigo) do nothing`;
  }
  refrescar("/interno/plano");
}

export async function borrarUbicacion(fd: FormData) {
  await requerirInterno("supervisor");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    await tx`update existencias set ubicacion_id = null where ubicacion_id = ${id}`;
    await tx`delete from ubicaciones where id = ${id}`;
  });
  refrescar("/interno/plano");
}

/** Dónde vive un producto en la sucursal (se usa para surtir, chequeos y el quiosco). */
export async function asignarUbicacion(fd: FormData) {
  await requerirInterno("mostrador");
  const producto = String(fd.get("producto_id")), ubicacion = String(fd.get("ubicacion_id"));
  if (!UUID.test(producto)) return;
  const s = await sucursal();
  await sql`
    insert into existencias (producto_id, almacen_id, cantidad, ubicacion_id) values (${producto}, ${s.id}, 0, ${UUID.test(ubicacion) ? ubicacion : null})
    on conflict (producto_id, almacen_id) do update set ubicacion_id = excluded.ubicacion_id`;
  refrescar("/interno/plano");
  const [p] = await sql<{ sku: string }[]>`select sku from productos where id = ${producto}`;
  if (p) refrescar(`/interno/escanear/${p.sku}`);
}
