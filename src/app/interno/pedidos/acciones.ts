"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { ESTADOS_INTERNOS, SIGUIENTE, type EstadoPedido } from "@/lib/estados";
import { requerirInterno } from "@/lib/equipo";
import { MOTIVOS_CANCELACION } from "@/lib/motivos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cambiarEstado(fd: FormData) {
  await requerirInterno("operador");
  const id = String(fd.get("id"));
  const estado = String(fd.get("estado")) as EstadoPedido;
  if (!ESTADOS_INTERNOS.includes(estado)) throw new Error("Estado inválido");
  const motivo = String(fd.get("motivo") ?? "").trim();
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 300);
  if (estado === "cancelado" && !MOTIVOS_CANCELACION.includes(motivo)) throw new Error("Falta el motivo de cancelación");
  const motivoCompleto = estado === "cancelado" ? (nota ? `${motivo}: ${nota}` : motivo) : null;

  await sql.begin(async (tx) => {
    const [actual] = await tx<{ estado: EstadoPedido }[]>`select estado from pedidos where id = ${id} for update`;
    if (!actual) throw new Error("Pedido no encontrado");
    const permitido = SIGUIENTE[actual.estado] === estado || (estado === "cancelado" && !["entregado", "entregado_con_faltantes", "cancelado"].includes(actual.estado));
    if (!permitido) throw new Error(`No se puede pasar de ${actual.estado} a ${estado}`);
    await tx`update pedidos set estado = ${estado}, motivo_cancelacion = coalesce(${motivoCompleto}, motivo_cancelacion) where id = ${id}`;
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${id}, ${estado}, ${motivoCompleto ?? "Panel interno"})`;
  });
  revalidatePath("/interno/pedidos");
  revalidatePath(`/interno/pedidos/${id}`);
}

/** Cobro recibido de un pedido (anticipo o total). Alimenta "Cobrado" en el tablero. */
export async function registrarCobro(fd: FormData) {
  const yo = await requerirInterno("operador");
  const id = String(fd.get("id"));
  const monto = Number(String(fd.get("monto") ?? "").replace(/[$,\s]/g, ""));
  const forma = String(fd.get("forma"));
  if (!UUID.test(id) || !(monto > 0) || !["efectivo", "transferencia", "tarjeta", "credito"].includes(forma)) throw new Error("Revisa monto y forma de pago");
  await sql`
    insert into pagos (cliente_id, pedido_id, monto, forma, referencia_pasarela, registrado_por)
    select cliente_id, id, ${monto}, ${forma}, ${String(fd.get("referencia") ?? "").trim().slice(0, 100) || null}, ${yo.id} from pedidos where id = ${id}`;
  revalidatePath(`/interno/pedidos/${id}`);
  revalidatePath("/interno/tablero");
}
