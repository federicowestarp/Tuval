"use server";

import { refrescar } from "@/lib/refrescar";
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
    if (estado === "comprado_proveedor") await tx`update pedidos set aceptado_en = coalesce(aceptado_en, now()) where id = ${id}`;
    await tx`update pedidos set estado = ${estado}, motivo_cancelacion = coalesce(${motivoCompleto}, motivo_cancelacion) where id = ${id}`;
    await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${id}, ${estado}, ${motivoCompleto ?? "Panel interno"})`;
  });
  refrescar("/interno/pedidos");
  refrescar(`/interno/pedidos/${id}`);
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
  await sql`update pedidos set aceptado_en = coalesce(aceptado_en, now()) where id = ${id} and confirmado_en is not null`;
  refrescar(`/interno/pedidos/${id}`);
  refrescar("/interno/tablero");
}

/** Marca de tiempo que mide "pedimos cotización → el proveedor responde". */
export async function cotizacionSolicitada(fd: FormData) {
  await requerirInterno("operador");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql`update pedidos set cotizacion_solicitada_en = coalesce(cotizacion_solicitada_en, now()) where id = ${id}`;
  refrescar(`/interno/pedidos/${id}`);
}

/** El cliente aceptó el total confirmado: desde aquí corre "aceptado → surtido". */
export async function clienteAcepto(fd: FormData) {
  await requerirInterno("operador");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql`update pedidos set aceptado_en = coalesce(aceptado_en, now()) where id = ${id} and confirmado_en is not null`;
  refrescar(`/interno/pedidos/${id}`);
}

/** Surtir con existencias de la sucursal en vez de comprar al proveedor. */
export async function surtirDeSucursal(fd: FormData) {
  const yo = await requerirInterno("operador");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  const { mover, sucursal } = await import("@/lib/inventario");
  const s = await sucursal();
  await sql.begin(async (tx) => {
    const [p] = await tx<{ folio: string; estado: string }[]>`select folio, estado from pedidos where id = ${id} for update`;
    if (!p || p.estado !== "recibido") return;
    const partidas = await tx<{ producto_id: string; cantidad: number; costo: number | null }[]>`
      select pp.producto_id, pp.cantidad::float cantidad, coalesce(pr.costo_promedio, pp.costo_unitario)::float costo
      from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = ${id}`;
    for (const x of partidas) {
      await mover(tx, { producto: x.producto_id, cantidad: x.cantidad, tipo: "salida_venta", origen: s.id, costo: x.costo, referencia: p.folio, pedido: id, usuario: yo.id });
      await tx`update pedido_partidas set cantidad_surtida = cantidad, costo_unitario = coalesce(costo_unitario, ${x.costo}) where pedido_id = ${id} and producto_id = ${x.producto_id}`;
    }
    await tx`update pedidos set estado = 'surtido', almacen_surtido = ${s.id}, aceptado_en = coalesce(aceptado_en, now()) where id = ${id}`;
    await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${id}, 'surtido', ${"Surtido de " + s.nombre}, ${yo.id})`;
  });
  refrescar(`/interno/pedidos/${id}`);
  refrescar("/interno/pedidos");
}
