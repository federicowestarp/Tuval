"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { ESTADOS_INTERNOS, SIGUIENTE, type EstadoPedido } from "@/lib/estados";
import { verificarAccesoInterno } from "../acceso";

export async function cambiarEstado(fd: FormData) {
  verificarAccesoInterno();
  const id = String(fd.get("id"));
  const estado = String(fd.get("estado")) as EstadoPedido;
  if (!ESTADOS_INTERNOS.includes(estado)) throw new Error("Estado inválido");

  await sql.begin(async (tx) => {
    const [actual] = await tx<{ estado: EstadoPedido }[]>`select estado from pedidos where id = ${id} for update`;
    if (!actual) throw new Error("Pedido no encontrado");
    const permitido = SIGUIENTE[actual.estado] === estado || (estado === "cancelado" && !["entregado", "entregado_con_faltantes", "cancelado"].includes(actual.estado));
    if (!permitido) throw new Error(`No se puede pasar de ${actual.estado} a ${estado}`);
    await tx`update pedidos set estado = ${estado} where id = ${id}`;
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${id}, ${estado}, 'Panel interno')`;
  });
  revalidatePath("/interno/pedidos");
  revalidatePath(`/interno/pedidos/${id}`);
}
