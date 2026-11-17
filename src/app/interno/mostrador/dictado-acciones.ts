"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { buscarProductos, sucursal, type ProductoMostrador } from "@/lib/inventario";
import { normalizarLista, type RenglonLista } from "@/lib/interpretar-lista";
import { refrescar } from "@/lib/refrescar";

export type RenglonInterpretado = RenglonLista & { candidatos: ProductoMostrador[] };

/** Lista dictada o pegada → renglones con productos candidatos del catálogo (con existencia en sucursal). */
export async function interpretarDictado(texto: string): Promise<{ renglones: RenglonInterpretado[]; conIA: boolean; error?: string }> {
  await requerirInterno("mostrador");
  const t = String(texto ?? "").trim();
  if (t.length < 2) return { renglones: [], conIA: false, error: "Dicta o escribe la lista." };
  const { renglones, conIA } = await normalizarLista(t);
  const almacen = (await sucursal()).id;
  const salida: RenglonInterpretado[] = [];
  for (const r of renglones.slice(0, 40)) {
    let candidatos: ProductoMostrador[] = [];
    for (const q of [...r.busqueda, r.descripcion]) {
      candidatos = await buscarProductos(q, almacen);
      if (candidatos.length) break;
    }
    salida.push({ ...r, candidatos: candidatos.slice(0, 5) });
  }
  return { renglones: salida, conIA };
}

/** Lo que el cliente pidió y no tenemos (o está agotado): queda en Demanda no surtida. */
export async function registrarFaltante(d: { descripcion: string; cantidad: number; productoId?: string | null; cliente?: string; telefono?: string }): Promise<{ ok?: boolean; error?: string }> {
  const yo = await requerirInterno("mostrador");
  const desc = String(d.descripcion ?? "").trim().slice(0, 200);
  const cant = Number(d.cantidad) > 0 ? Number(d.cantidad) : 1;
  if (desc.length < 2) return { error: "Describe lo que pidieron." };
  const nota = [d.cliente?.trim(), d.telefono?.replace(/\D/g, "")].filter(Boolean).join(" · ") || null;
  await sql`
    insert into solicitudes_producto (descripcion, cantidad, origen, estado, producto_id, notas, registrado_por)
    values (${desc}, ${cant}, 'mostrador', 'nueva', ${d.productoId && /^[0-9a-f-]{36}$/i.test(d.productoId) ? d.productoId : null}, ${nota}, ${yo.id})`;
  refrescar("/interno/demanda");
  return { ok: true };
}
