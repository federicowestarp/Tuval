"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { ESTADOS_INTERNOS, SIGUIENTE, type EstadoPedido } from "@/lib/estados";
import { requerirInterno } from "@/lib/equipo";
import { MOTIVOS_CANCELACION } from "@/lib/motivos";
import { PLAZOS } from "@/lib/seguimiento";
import { crearOrdenCompra, intentarAprobar, mensajeOrdenCompra, mensajeSolicitud, proveedorDelPedido } from "@/lib/proceso";

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
    if (estado === "comprado_proveedor") {
      // No se compra con existencias o precios viejos del proveedor.
      const [f] = await tx<{ viejo: boolean }[]>`
        select coalesce(greatest((select max(cargada_en) from cotizaciones_proveedor where pedido_id = ${id}),
          (select reconfirmado_en from pedidos where id = ${id})) < now() - make_interval(hours => ${PLAZOS.reconfirmarHoras}), false) viejo`;
      if (f?.viejo) throw new Error(`La cotización del proveedor tiene más de ${PLAZOS.reconfirmarHoras} h: reconfirma existencias y precio antes de comprar.`);
      await tx`update pedidos set aceptado_en = coalesce(aceptado_en, now()) where id = ${id}`;
    }
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
  await sql.begin((tx) => intentarAprobar(tx, id));
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
  await sql.begin((tx) => intentarAprobar(tx, id));
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

/** El operador ya le escribió al cliente (recordatorio de cotización sin respuesta). */
export async function registrarRecordatorio(fd: FormData) {
  await requerirInterno("operador");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql`update pedidos set recordatorios = recordatorios + 1, recordado_en = now() where id = ${id}`;
  refrescar("/interno/pedidos");
}

/** Se reconfirmaron existencia y precio con el proveedor: la cotización vuelve a estar vigente 48 h. */
export async function reconfirmarProveedor(fd: FormData) {
  const yo = await requerirInterno("operador");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql`update pedidos set reconfirmado_en = now() where id = ${id}`;
  await sql`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) select id, estado, 'Existencias y precio reconfirmados con proveedor', ${yo.id} from pedidos where id = ${id}`;
  refrescar("/interno/pedidos");
  refrescar(`/interno/pedidos/${id}`);
}

// ───────── Proceso con el proveedor por WhatsApp ─────────

const ligaWa = (tel: string, texto: string) => `https://wa.me/52${tel.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(texto)}`;

/** Prepara el WhatsApp de solicitud de cotización al proveedor y marca la hora (para medir cuánto tarda en responder). */
export async function solicitarCotizacionWA(pedidoId: string): Promise<{ url?: string; error?: string }> {
  await requerirInterno("operador");
  if (!UUID.test(pedidoId)) return { error: "Pedido no válido." };
  const prov = await proveedorDelPedido(pedidoId);
  if (!prov?.whatsapp) return { error: `Falta el WhatsApp de ${prov?.nombre ?? "Emmsa"}: captúralo abajo en “WhatsApp del proveedor”.` };
  await sql`update pedidos set cotizacion_solicitada_en = coalesce(cotizacion_solicitada_en, now()) where id = ${pedidoId}`;
  refrescar(`/interno/pedidos/${pedidoId}`);
  return { url: ligaWa(prov.whatsapp, await mensajeSolicitud(pedidoId)) };
}

/** Manda la orden de compra por WhatsApp: el pedido queda "comprado a proveedor" automáticamente. */
export async function enviarOrdenWA(ocId: string): Promise<{ url?: string; error?: string }> {
  const yo = await requerirInterno("operador");
  if (!UUID.test(ocId)) return { error: "Orden no válida." };
  const [oc] = await sql<{ pedido_id: string; whatsapp: string | null; nombre: string }[]>`
    select oc.pedido_id, pr.whatsapp, pr.nombre from ordenes_compra oc join proveedores pr on pr.id = oc.proveedor_id where oc.id = ${ocId}`;
  if (!oc) return { error: "Orden no encontrada." };
  if (!oc.whatsapp) return { error: `Falta el WhatsApp de ${oc.nombre}.` };
  await sql.begin(async (tx) => {
    await tx`update ordenes_compra set enviada_en = coalesce(enviada_en, now()), estado = case when estado = 'borrador' then 'enviada'::estado_oc else estado end where id = ${ocId}`;
    const [p] = await tx`update pedidos set estado = 'comprado_proveedor' where id = ${oc.pedido_id} and estado = 'recibido' returning id`;
    if (p) await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${oc.pedido_id}, 'comprado_proveedor', 'Orden de compra enviada por WhatsApp', ${yo.id})`;
  });
  refrescar(`/interno/pedidos/${oc.pedido_id}`);
  refrescar("/interno/rutas");
  return { url: ligaWa(oc.whatsapp, await mensajeOrdenCompra(ocId)) };
}

/** Excepción del administrador: aprobar sin pago ni crédito (queda registrado). */
export async function aprobarManual(fd: FormData) {
  const yo = await requerirInterno("admin");
  const id = String(fd.get("id"));
  if (!UUID.test(id)) return;
  await sql.begin(async (tx) => {
    const [p] = await tx<{ estado: EstadoPedido }[]>`update pedidos set aprobado_en = now(), aprobado_por = 'manual' where id = ${id} and aprobado_por is null returning estado`;
    if (!p) return;
    await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id) values (${id}, ${p.estado}, 'Aprobado manualmente por administrador', ${yo.id})`;
    if (p.estado === "recibido") await crearOrdenCompra(tx, id);
  });
  refrescar(`/interno/pedidos/${id}`);
}

export async function guardarWhatsAppProveedor(fd: FormData) {
  await requerirInterno("operador");
  const id = String(fd.get("proveedor")), tel = String(fd.get("whatsapp") ?? "").replace(/\D/g, "").slice(-10);
  if (!UUID.test(id) || tel.length !== 10) return;
  await sql`update proveedores set whatsapp = ${tel} where id = ${id}`;
  refrescar("/interno/pedidos");
}
