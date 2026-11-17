"use server";

import { sql } from "@/lib/db";
import { intentarAprobar } from "@/lib/proceso";
import { refrescar } from "@/lib/refrescar";

/**
 * El cliente acepta la cotización desde su liga de seguimiento (el id del pedido no es adivinable).
 * Si tiene crédito y cabe en su límite, queda aprobado y se pide el material al proveedor; si no, falta el pago.
 */
export async function aceptarCotizacion(pedidoId: string): Promise<{ mensaje: string; aprobado: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return { mensaje: "Pedido no válido.", aprobado: false };
  const r = await sql.begin(async (tx) => {
    const [p] = await tx`update pedidos set aceptado_en = coalesce(aceptado_en, now())
                         where id = ${pedidoId} and confirmado_en is not null and estado = 'recibido' returning id`;
    if (!p) return null;
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${pedidoId}, 'recibido', 'El cliente aceptó la cotización en línea')`;
    return intentarAprobar(tx, pedidoId);
  });
  refrescar(`/pedido/${pedidoId}`);
  refrescar(`/interno/pedidos/${pedidoId}`);
  if (!r) return { mensaje: "Esta cotización ya no se puede aceptar. Escríbenos por WhatsApp.", aprobado: false };
  return r.aprobado
    ? { mensaje: r.por === "credito" ? "¡Listo! Quedó a tu crédito y ya lo estamos preparando." : "¡Listo! Ya lo estamos preparando.", aprobado: true }
    : { mensaje: "Gracias, quedó aceptada. Para surtir falta tu pago: te mandamos los datos por WhatsApp.", aprobado: false };
}
