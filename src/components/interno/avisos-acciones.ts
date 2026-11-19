"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { refrescar } from "@/lib/refrescar";

/** Quita el aviso de una pieza que no tenemos (sigue en Demanda para conseguirla). */
export async function marcarFaltanteVisto(fd: FormData) {
  await requerirInterno("mostrador");
  const id = String(fd.get("id"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await sql`update solicitudes_producto set atendida_en = now() where id = ${id}`;
  for (const r of ["/interno/mostrador", "/interno/vender", "/interno/tablero"]) refrescar(r);
}
