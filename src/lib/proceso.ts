import type postgres from "postgres";
import { sql } from "@/lib/db";
import { puedeCredito } from "@/lib/clientes";
import { otorgarPuntos } from "@/lib/lealtad";
import type { leerCfdi } from "@/lib/cfdi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

/*
 * Proceso del pedido en línea con el proveedor (Emmsa):
 * recibido → solicitud de cotización (WhatsApp) → cotización cargada y conciliada → confirmado al cliente →
 * aprobado (pago confirmado, o crédito: el cliente acepta y cabe en su límite) → orden de compra (se crea sola) →
 * enviada por WhatsApp = "comprado a proveedor" → el chofer sube la factura en la bodega → se concilia → surtido.
 */

/** Teléfono de WhatsApp del proveedor del pedido (el de su última cotización, o Emmsa). */
export async function proveedorDelPedido(pedidoId: string, tx: Tx = sql) {
  const [p] = await tx<{ id: string; nombre: string; whatsapp: string | null }[]>`
    select pr.id, pr.nombre, pr.whatsapp from proveedores pr
    where pr.id = coalesce((select proveedor_id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by cargada_en desc limit 1),
                           (select id from proveedores where nombre = 'Emmsa' limit 1))`;
  return p ?? null;
}

/** Proveedores con los que se trabaja el pedido: los que cotizaron o tienen orden de compra (Emmsa si no hay ninguno). */
export async function proveedoresDelPedido(pedidoId: string) {
  return sql<{ id: string; nombre: string; whatsapp: string | null }[]>`
    select pr.id, pr.nombre, pr.whatsapp from proveedores pr
    where pr.id in (select proveedor_id from cotizaciones_proveedor where pedido_id = ${pedidoId}
                    union select proveedor_id from ordenes_compra where pedido_id = ${pedidoId} and estado <> 'cancelada')
       or (pr.nombre = 'Emmsa' and not exists (select 1 from cotizaciones_proveedor where pedido_id = ${pedidoId}))
    order by (pr.nombre = 'Emmsa') desc, pr.nombre`;
}

/**
 * Mensaje de solicitud de cotización. Con proveedor: solo las piezas que ese proveedor surte (principal o alterno)
 * más las que no tienen surtidor asignado; si ninguna es suya, todas.
 */
export async function mensajeSolicitud(pedidoId: string, proveedorId?: string) {
  const [p] = await sql<{ folio: string }[]>`select folio from pedidos where id = ${pedidoId}`;
  const todas = await sql<{ cantidad: number; nombre: string; unidad: string; codigo: string | null; suya: boolean; sin_surtidor: boolean }[]>`
    select pp.cantidad::float cantidad, pr.nombre, pr.unidad,
           coalesce((select sku_proveedor from productos_proveedor x where x.producto_id = pr.id and x.proveedor_id = ${proveedorId ?? null} and x.sku_proveedor is not null),
                    (select sku_proveedor from productos_proveedor x where x.producto_id = pr.id and x.sku_proveedor is not null limit 1)) codigo,
           exists (select 1 from productos_proveedor x where x.producto_id = pr.id and x.proveedor_id = ${proveedorId ?? null} and x.preferencia is not null) suya,
           not exists (select 1 from productos_proveedor x where x.producto_id = pr.id and x.preferencia is not null) sin_surtidor
    from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = ${pedidoId} order by pr.nombre`;
  const propias = proveedorId ? todas.filter((x) => x.suya || x.sin_surtidor) : todas;
  const partidas = propias.some((x) => x.suya) || !proveedorId ? propias : todas;
  const especiales = await sql<{ cantidad: number; descripcion: string }[]>`
    select cantidad::float cantidad, descripcion from solicitudes_producto where pedido_id = ${pedidoId} and estado in ('nueva', 'buscando')`;
  const lineas = [
    ...partidas.map((x) => `• ${x.cantidad} ${x.unidad === "pieza" ? "pza" : x.unidad} ${x.nombre}${x.codigo ? ` (cód. ${x.codigo})` : ""}`),
    ...especiales.map((x) => `• ${x.cantidad} ${x.descripcion}`),
  ];
  return `Hola, de Tuval. Solicitud de cotización ${p?.folio ?? ""}:\n${lineas.join("\n")}\n\n¿Nos confirman existencias y precio, por favor? Gracias.`;
}

export async function mensajeOrdenCompra(ocId: string) {
  const [oc] = await sql<{ folio: string; pedido: string | null; total: number | null }[]>`
    select oc.folio, p.folio pedido, oc.total::float total from ordenes_compra oc left join pedidos p on p.id = oc.pedido_id where oc.id = ${ocId}`;
  const partidas = await sql<{ cantidad: number; nombre: string; codigo: string | null; costo: number | null }[]>`
    select ocp.cantidad::float cantidad, pr.nombre, (select sku_proveedor from productos_proveedor x where x.producto_id = pr.id and x.sku_proveedor is not null limit 1) codigo,
           ocp.costo_unitario::float costo
    from orden_compra_partidas ocp join productos pr on pr.id = ocp.producto_id where ocp.orden_id = ${ocId} order by pr.nombre`;
  return `Hola, de Tuval. Orden de compra ${oc?.folio ?? ""} (pedido ${oc?.pedido ?? ""}):\n${partidas.map((x) => `• ${x.cantidad} ${x.nombre}${x.codigo ? ` (cód. ${x.codigo})` : ""}${x.costo ? ` a $${x.costo.toFixed(2)}` : ""}`).join("\n")}\n${oc?.total ? `Total sin IVA: $${oc.total.toFixed(2)}\n` : ""}\nPasamos por ella. ¿Nos avisan cuando esté lista? Gracias.`;
}

/**
 * Crea las órdenes de compra del pedido: una por proveedor (cada partida va al proveedor elegido al confirmar,
 * o al de su última cotización; si no hay, Emmsa). No duplica las que ya existen. Devuelve la primera.
 */
export async function crearOrdenCompra(tx: Tx, pedidoId: string) {
  const partidas = await tx<{ id: string; producto_id: string; cantidad: number; costo: number | null; proveedor_id: string | null }[]>`
    select pp.id, pp.producto_id, pp.cantidad::float cantidad, x.proveedor_id,
           coalesce((select cp.precio_unitario from cotizacion_partidas cp join cotizaciones_proveedor c on c.id = cp.cotizacion_id
                     where cp.pedido_partida_id = pp.id and c.proveedor_id = x.proveedor_id order by c.cargada_en desc limit 1), pp.costo_unitario)::float costo
    from pedido_partidas pp
    cross join lateral (select coalesce(pp.proveedor_id,
        (select c.proveedor_id from cotizacion_partidas cp join cotizaciones_proveedor c on c.id = cp.cotizacion_id where cp.pedido_partida_id = pp.id order by c.cargada_en desc limit 1),
        (select id from proveedores where nombre = 'Emmsa' limit 1)) proveedor_id) x
    where pp.pedido_id = ${pedidoId}`;
  if (!partidas.length) return null;
  type Fila = (typeof partidas)[number];
  const porProveedor = new Map<string, Fila[]>();
  for (const x of partidas) if (x.proveedor_id) porProveedor.set(x.proveedor_id, [...(porProveedor.get(x.proveedor_id) ?? []), x]);
  let primera: string | null = null;
  for (const [proveedor, lista] of porProveedor) {
    const [ya] = await tx<{ id: string }[]>`select id from ordenes_compra where pedido_id = ${pedidoId} and proveedor_id = ${proveedor} and estado <> 'cancelada' limit 1`;
    if (ya) { primera ??= ya.id; continue; }
    const total = Math.round(lista.reduce((a, x) => a + (x.costo ?? 0) * x.cantidad, 0) * 100) / 100;
    const [oc] = await tx<{ id: string }[]>`
      insert into ordenes_compra (folio, proveedor_id, estado, pedido_id, total)
      values ('OC-' || lpad(nextval('folio_oc_seq')::text, 6, '0'), ${proveedor}, 'borrador', ${pedidoId}, ${total}) returning id`;
    for (const x of lista) {
      await tx`insert into orden_compra_partidas (orden_id, pedido_partida_id, producto_id, cantidad, costo_unitario) values (${oc.id}, ${x.id}, ${x.producto_id}, ${x.cantidad}, ${x.costo})`;
    }
    primera ??= oc.id;
  }
  return primera;
}

/**
 * Aprueba el pedido si ya se puede: pago confirmado que cubre el total, o crédito (el cliente aceptó, sin saldo vencido
 * y dentro de su límite). Al aprobarse se crea la orden de compra. Devuelve el estado para mostrarlo.
 */
export async function intentarAprobar(tx: Tx, pedidoId: string): Promise<{ aprobado: boolean; por?: string; motivo?: string }> {
  const [p] = await tx<{ estado: string; total: number; confirmado: boolean; aceptado: boolean; aprobado_por: string | null; cliente_id: string | null; pagado: number; canal: string }[]>`
    select p.estado, p.total::float total, p.confirmado_en is not null confirmado, p.aceptado_en is not null aceptado, p.aprobado_por, p.cliente_id, p.canal::text canal,
           coalesce((select sum(monto) from pagos g where g.pedido_id = p.id and g.estado = 'confirmado'), 0)::float pagado
    from pedidos p where p.id = ${pedidoId} for update`;
  if (!p || p.canal === "mostrador") return { aprobado: false };
  if (p.aprobado_por) return { aprobado: true, por: p.aprobado_por };
  if (!p.confirmado) return { aprobado: false, motivo: "Falta confirmar precio y existencias al cliente." };
  let por: "pago" | "credito" | null = null;
  if (p.total > 0 && p.pagado + 0.009 >= p.total) por = "pago";
  else if (p.aceptado && p.cliente_id) {
    const c = await puedeCredito(p.cliente_id, p.total - p.pagado, tx);
    if (c.ok) por = "credito";
    else return { aprobado: false, motivo: `Esperando pago. ${c.motivo ?? ""}`.trim() };
  } else return { aprobado: false, motivo: p.aceptado ? "Esperando pago." : "Esperando que el cliente acepte." };
  await tx`update pedidos set aprobado_en = now(), aprobado_por = ${por}, a_credito = ${por === "credito"}, aceptado_en = coalesce(aceptado_en, now()) where id = ${pedidoId}`;
  await tx`insert into pedido_eventos (pedido_id, estado, nota) values (${pedidoId}, ${p.estado}, ${por === "pago" ? "Aprobado: pago confirmado" : "Aprobado: a crédito dentro del límite"})`;
  if (por === "pago" && p.cliente_id) await otorgarPuntos(tx, p.cliente_id, pedidoId, p.pagado);
  if (p.estado === "recibido") await crearOrdenCompra(tx, pedidoId);
  return { aprobado: true, por };
}

export type Diferencia = { producto: string; esperado: number; facturado: number; costoOc: number | null; costoFactura: number | null };

/** Concilia la factura del proveedor contra la orden de compra por código del proveedor (y cantidad). */
export async function conciliarFactura(tx: Tx, ocId: string, cfdi: ReturnType<typeof leerCfdi>) {
  const partidas = await tx<{ producto: string; cantidad: number; costo: number | null; codigo: string | null }[]>`
    select pr.nombre producto, ocp.cantidad::float cantidad, ocp.costo_unitario::float costo,
           (select sku_proveedor from productos_proveedor x where x.producto_id = pr.id and x.proveedor_id = oc.proveedor_id) codigo
    from orden_compra_partidas ocp join productos pr on pr.id = ocp.producto_id join ordenes_compra oc on oc.id = ocp.orden_id where ocp.orden_id = ${ocId}`;
  const usados = new Set<number>();
  const diferencias: Diferencia[] = [];
  for (const x of partidas) {
    const i = cfdi.conceptos.findIndex((c, k) => !usados.has(k) && ((x.codigo && c.codigo === x.codigo) || c.descripcion.toLowerCase().includes(x.producto.toLowerCase().slice(0, 12))));
    const c = i >= 0 ? cfdi.conceptos[i] : null;
    if (i >= 0) usados.add(i);
    const difPrecio = c && x.costo ? Math.abs(c.valorUnitario - x.costo) / x.costo > 0.01 : false;
    if (!c || Math.abs(c.cantidad - x.cantidad) > 0.0001 || difPrecio) diferencias.push({ producto: x.producto, esperado: x.cantidad, facturado: c?.cantidad ?? 0, costoOc: x.costo, costoFactura: c?.valorUnitario ?? null });
  }
  cfdi.conceptos.forEach((c, k) => { if (!usados.has(k)) diferencias.push({ producto: `No pedido: ${c.descripcion}`, esperado: 0, facturado: c.cantidad, costoOc: null, costoFactura: c.valorUnitario }); });
  await tx`update ordenes_compra set factura_folio = ${cfdi.folio}, factura_total = ${cfdi.total || null}, diferencias = ${tx.json(diferencias as never)},
           conciliada_en = ${diferencias.length ? null : new Date()}, estado = ${diferencias.length ? "recolectada_parcial" : "recolectada"} where id = ${ocId}`;
  return diferencias;
}
