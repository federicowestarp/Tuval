"use server";

import { sql } from "@/lib/db";
import { refrescar } from "@/lib/refrescar";
import { URL_SITIO } from "@/lib/sitio";

/** El cliente indica quién va a recoger y obtiene la liga para compartirle el QR (por WhatsApp). */
export async function compartirRecoger(pedidoId: string, nombre: string): Promise<{ error?: string; liga?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return { error: "Pedido no válido." };
  const quien = String(nombre ?? "").trim().slice(0, 80);
  if (quien.length < 2) return { error: "Escribe el nombre de quien va a recoger." };
  const [p] = await sql<{ token: string; folio: string }[]>`
    update pedidos set recibe_nombre = ${quien} where id = ${pedidoId} and tipo_entrega = 'recoger' and estado in ('recibido', 'comprado_proveedor', 'surtido', 'en_ruta')
    returning token_receptor token, folio`;
  if (!p) return { error: "Este pedido ya no se puede recoger." };
  await sql`insert into pedido_eventos (pedido_id, estado, nota) select id, estado, ${`El cliente indicó que recoge ${quien}`} from pedidos where id = ${pedidoId}`;
  refrescar(`/pedido/${pedidoId}`);
  return { liga: `${URL_SITIO}/recoger/${p.token}` };
}
