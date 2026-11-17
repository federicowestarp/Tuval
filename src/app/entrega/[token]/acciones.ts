"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { obtenerPedidoPorTokenReceptor } from "@/lib/pedidos";

export type EstadoRecepcion = { error?: string; ok?: boolean };

/** Quien recibe confirma partida por partida; lo que falte queda como reporte de faltante. */
export async function confirmarRecepcion(_prev: EstadoRecepcion, fd: FormData): Promise<EstadoRecepcion> {
  const token = String(fd.get("token") ?? "");
  const pedido = await obtenerPedidoPorTokenReceptor(token);
  if (!pedido) return { error: "Liga no válida." };
  if (pedido.recepcion_confirmada_en) return { error: "Esta entrega ya fue confirmada." };
  if (pedido.estado !== "en_ruta" && pedido.estado !== "entregado") return { error: "El pedido todavía no sale a entrega." };

  const recibidas = pedido.partidas.map((p) => {
    const n = Number(fd.get(`recibido_${p.id}`));
    return { p, recibida: Number.isFinite(n) ? Math.min(Math.max(0, Math.floor(n)), p.cantidad) : p.cantidad, nota: String(fd.get(`nota_${p.id}`) ?? "").trim() };
  });
  const hayFaltantes = recibidas.some((r) => r.recibida < r.p.cantidad);
  const comentario = String(fd.get("comentario") ?? "").trim().slice(0, 500);

  await sql.begin(async (tx) => {
    for (const r of recibidas) {
      await tx`update pedido_partidas set cantidad_recibida = ${r.recibida} where id = ${r.p.id} and pedido_id = ${pedido.id}`;
      if (r.recibida < r.p.cantidad) {
        await tx`
          insert into reportes_faltante (pedido_partida_id, cantidad_faltante, comentario)
          values (${r.p.id}, ${r.p.cantidad - r.recibida}, ${[r.nota, comentario].filter(Boolean).join(" · ") || null})`;
      }
    }
    const estado = hayFaltantes ? "entregado_con_faltantes" : "entregado";
    await tx`update pedidos set estado = ${estado}, recepcion_confirmada_en = now() where id = ${pedido.id}`;
    await tx`
      insert into pedido_eventos (pedido_id, estado, nota)
      values (${pedido.id}, ${estado}, ${"Recepción confirmada por " + (pedido.recibe_nombre ?? "quien recibe") + (comentario ? `: ${comentario}` : "")})`;
  });
  refrescar(`/entrega/${token}`);
  return { ok: true };
}
