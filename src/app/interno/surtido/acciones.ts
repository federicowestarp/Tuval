"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { mover } from "@/lib/inventario";
import { refrescar } from "@/lib/refrescar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Surtido guiado: se escaneó la etiqueta y coincide con la partida → se descuenta del inventario en ese momento.
 * Cuando todas las partidas están completas, el pedido queda "surtido" (listo para ruta o para entregar).
 */
export async function tomarPieza(partidaId: string, skuLeido: string, cantidad: number, escaneado = true): Promise<{ error?: string; completo?: boolean; restante?: number }> {
  const yo = await requerirInterno("mostrador");
  if (!UUID.test(partidaId)) return { error: "Partida no válida." };
  if (!(cantidad > 0)) return { error: "Cantidad no válida." };
  return sql.begin(async (tx) => {
    const [x] = await tx<{ pedido_id: string; folio: string; producto_id: string; sku: string; cantidad: number; surtida: number; almacen: string | null; estado: string; en_surtido: boolean; costo: number | null }[]>`
      select pp.pedido_id, p.folio, pp.producto_id, pr.sku, pp.cantidad::float cantidad, pp.cantidad_surtida::float surtida, p.almacen_surtido almacen, p.estado,
             p.surtir_en_sucursal_desde is not null en_surtido, coalesce(pr.costo_promedio, pp.costo_unitario)::float costo
      from pedido_partidas pp join pedidos p on p.id = pp.pedido_id join productos pr on pr.id = pp.producto_id
      where pp.id = ${partidaId} for update of pp`;
    if (!x || !x.en_surtido || x.estado !== "recibido" || !x.almacen) return { error: "Este pedido no está en surtido." };
    if (x.sku.toUpperCase() !== skuLeido.trim().toUpperCase()) return { error: `No es esta pieza: escaneaste ${skuLeido} y se necesita ${x.sku}.` };
    const falta = x.cantidad - x.surtida;
    if (falta <= 0) return { error: "Esta partida ya está completa." };
    const q = Math.min(cantidad, falta);
    await mover(tx, { producto: x.producto_id, cantidad: q, tipo: "salida_venta", origen: x.almacen, costo: x.costo, referencia: x.folio, pedido: x.pedido_id, usuario: yo.id, escaneado, nota: escaneado ? null : "Surtido con código escrito (etiqueta sin leer)" });
    await tx`update pedido_partidas set cantidad_surtida = cantidad_surtida + ${q}, costo_unitario = coalesce(costo_unitario, ${x.costo}) where id = ${partidaId}`;
    const [pend] = await tx<{ n: number }[]>`select count(*)::int n from pedido_partidas where pedido_id = ${x.pedido_id} and cantidad_surtida < cantidad`;
    if (pend.n === 0) {
      await tx`update pedidos set estado = 'surtido' where id = ${x.pedido_id}`;
      await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${x.pedido_id}, 'surtido', 'Surtido en sucursal con escaneo de cada pieza', ${yo.id})`;
    }
    refrescar(`/interno/surtido/${x.pedido_id}`);
    refrescar("/interno/surtido");
    refrescar(`/interno/pedidos/${x.pedido_id}`);
    if (pend.n === 0) refrescar("/interno/rutas");
    return { completo: pend.n === 0, restante: falta - q };
  });
}
