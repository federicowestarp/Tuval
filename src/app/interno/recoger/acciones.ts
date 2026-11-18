"use server";

import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { guardarArchivo } from "@/lib/archivos";
import { refrescar } from "@/lib/refrescar";

export type EstadoRecoger = { error?: string; ok?: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entrega en sucursal de un pedido "recoger": el cliente enseña su QR, se revisa partida por partida y firma.
 * Solo si ya está pagado o aprobado a crédito.
 */
export async function entregarEnSucursal(_p: EstadoRecoger, fd: FormData): Promise<EstadoRecoger> {
  const yo = await requerirInterno("mostrador");
  const pedidoId = String(fd.get("pedido_id"));
  if (!UUID.test(pedidoId)) return { error: "Pedido no válido." };
  const recibio = String(fd.get("recibio") ?? "").trim().slice(0, 120);
  if (!recibio) return { error: "Escribe quién recoge." };
  let checklist: { id: string; recibida: number }[] = [];
  try { checklist = JSON.parse(String(fd.get("checklist") ?? "[]")); } catch { checklist = []; }
  let firma: string | null;
  try { firma = await guardarArchivo(fd.get("firma"), ["image/png"]); } catch (e) { return { error: (e as Error).message }; }
  if (!firma) return { error: "Falta la firma de quien recoge." };

  return sql.begin(async (tx) => {
    const [p] = await tx<{ estado: string; tipo_entrega: string; aprobado_por: string | null }[]>`
      select estado, tipo_entrega, aprobado_por from pedidos where id = ${pedidoId} for update`;
    if (!p || p.tipo_entrega !== "recoger") return { error: "Este pedido no es para recoger en sucursal." };
    if (!["surtido", "en_ruta"].includes(p.estado)) return { error: p.estado.startsWith("entregado") ? "Este pedido ya se entregó." : "El material todavía no está listo en sucursal." };
    if (!p.aprobado_por) return { error: "Falta el pago (o la aprobación a crédito). Cóbralo antes de entregar." };
    const partidas = await tx<{ id: string; cantidad: number }[]>`select id, cantidad::float cantidad from pedido_partidas where pedido_id = ${pedidoId}`;
    const recibido = partidas.map((x) => {
      const r = Number(checklist.find((k) => k.id === x.id)?.recibida ?? x.cantidad);
      return { id: x.id, cantidad: x.cantidad, recibida: Number.isFinite(r) && r >= 0 ? Math.min(r, x.cantidad) : x.cantidad };
    });
    const faltan = recibido.some((x) => x.recibida < x.cantidad);
    const estado = faltan ? "entregado_con_faltantes" : "entregado";
    await tx`insert into entregas (pedido_id, estado, recibio_nombre, entregada_en, firma_archivo_id, checklist, notas)
             values (${pedidoId}, 'entregada', ${recibio}, now(), ${firma}, ${tx.json(recibido as never)}, 'Recogido en sucursal')`;
    for (const x of recibido) await tx`update pedido_partidas set cantidad_recibida = ${x.recibida} where id = ${x.id}`;
    await tx`update pedidos set estado = ${estado} where id = ${pedidoId}`;
    await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${pedidoId}, ${estado}, ${`Recogido en sucursal por ${recibio} (firmó)`}, ${yo.id})`;
    refrescar("/interno/pedidos");
    refrescar(`/interno/pedidos/${pedidoId}`);
    refrescar(`/pedido/${pedidoId}`);
    return { ok: true };
  });
}
