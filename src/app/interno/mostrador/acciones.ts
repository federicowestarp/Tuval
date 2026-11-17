"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { mover, sucursal } from "@/lib/inventario";
import { sinIva, totalesVenta } from "@/lib/totales";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => Number(String(v ?? "").replace(/[$,\s]/g, ""));

export type LineaVenta = { id: string; cantidad: number; precio?: number | null };
export type Venta = {
  lineas: LineaVenta[];
  forma: "efectivo" | "tarjeta" | "transferencia";
  terminal?: string | null;
  recibido?: number | null;
  referencia?: string;
  comprobante: "nota" | "factura";
  cliente?: { nombre?: string; telefono?: string; rfc?: string; razon?: string; cp?: string; regimen?: string; uso?: string };
};

/**
 * Venta de mostrador: queda como pedido (canal mostrador, entregado), descuenta la sucursal,
 * registra el cobro en el turno abierto y autorizado del cajero. Tarjeta exige terminal.
 * Transferencia queda PENDIENTE de pago (no se entrega ni se descuenta) hasta confirmación del proveedor o del supervisor. Precios desde el catálogo; solo se acepta precio
 * capturado a mano (con IVA) para productos sin precio.
 */
export async function registrarVenta(v: Venta): Promise<{ error?: string; id?: string; folio?: string; pendiente?: boolean }> {
  const yo = await requerirInterno("mostrador");
  const lineas = (v.lineas ?? []).filter((l) => UUID.test(l.id) && num(l.cantidad) > 0).slice(0, 200);
  if (lineas.length === 0) return { error: "Agrega al menos un producto." };
  if (!["efectivo", "tarjeta", "transferencia"].includes(v.forma)) return { error: "Elige la forma de pago." };
  const fiscal = v.comprobante === "factura" ? v.cliente : undefined;
  if (fiscal && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test((fiscal.rfc ?? "").toUpperCase())) return { error: "Revisa el RFC." };
  if (fiscal && !/^\d{5}$/.test(fiscal.cp ?? "")) return { error: "Falta el código postal fiscal." };

  const s = await sucursal();
  try {
    return await sql.begin(async (tx) => {
      // Nada se vende sin turno abierto y autorizado del cajero.
      const [caja] = await tx<{ id: string; estado: string; registradora_id: string }[]>`
        select id, estado, registradora_id from cajas where abierta_por = ${yo.id} and cerrada_en is null order by abierta_en desc limit 1`;
      if (!caja) throw new Error("Abre tu turno de caja antes de vender.");
      if (caja.estado !== "abierto") throw new Error("Tu apertura está pendiente de autorización del supervisor.");
      let terminal: string | null = null;
      if (v.forma === "tarjeta") {
        const [t] = v.terminal && UUID.test(v.terminal) ? await tx<{ id: string }[]>`
          select terminal_id id from caja_terminales where registradora_id = ${caja.registradora_id} and terminal_id = ${v.terminal}` : [];
        if (!t) throw new Error("Elige en qué terminal cobraste.");
        terminal = t.id;
      }
      const pendiente = v.forma === "transferencia";
      const p0 = pendiente ? await tx<{ dias: number }[]>`select valor::float dias from parametros_caja where clave = 'vigencia_transferencia_dias'` : [];
      const ids = lineas.map((l) => l.id);
      const prods = await tx<{ id: string; nombre: string; precio: number | null; costo: number | null }[]>`
        select p.id, p.nombre, pr.precio::float precio,
               coalesce(p.costo_promedio, (select min(costo) from productos_proveedor where producto_id = p.id))::float costo
        from productos p left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
        where p.id = any(${ids}::uuid[])`;
      const mapa = new Map(prods.map((p) => [p.id, p]));
      const partidas = lineas.map((l) => {
        const p = mapa.get(l.id);
        if (!p) throw new Error("Un producto ya no existe.");
        const manual = l.precio != null && num(l.precio) > 0 ? sinIva(num(l.precio)) : null;
        const precio = p.precio ?? manual;
        if (precio == null) throw new Error(`Escribe el precio de: ${p.nombre}`);
        return { ...p, cantidad: num(l.cantidad), precio };
      });
      const { subtotal, iva, total } = totalesVenta(partidas);
      const recibido = v.forma === "efectivo" ? num(v.recibido) : null;
      if (v.forma === "efectivo" && !(recibido! >= total)) throw new Error("El efectivo recibido no cubre el total.");

      const nombre = v.cliente?.nombre?.trim().slice(0, 120) || null;
      let clienteId: string | null = null;
      if (nombre || fiscal) {
        const rfc = fiscal?.rfc?.toUpperCase() ?? null;
        const [c] = await tx<{ id: string }[]>`
          insert into clientes (tipo, nombre, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi)
          values (${rfc && rfc.length === 12 ? "empresa" : "persona"}, ${nombre ?? fiscal?.razon ?? "Mostrador"}, ${rfc},
                  ${fiscal?.razon ?? null}, ${fiscal?.regimen ?? null}, ${fiscal?.cp ?? null}, ${fiscal?.uso ?? null})
          returning id`;
        clienteId = c.id;
      }
      const [p] = await tx<{ id: string; folio: string }[]>`
        insert into pedidos (folio, canal, cliente_id, tipo_entrega, almacen_surtido, estado, comprobante, contacto_nombre, contacto_telefono,
                             subtotal, iva, total, confirmado_en, aceptado_en, vendedor_id)
        values ('MO-' || lpad(nextval('folio_pedido_seq')::text, 6, '0'), 'mostrador', ${clienteId}, 'recoger', ${s.id}, ${pendiente ? "recibido" : "entregado"},
                ${v.comprobante === "factura" ? "factura" : "nota"}, ${nombre}, ${v.cliente?.telefono?.replace(/\D/g, "").slice(0, 15) || null},
                ${subtotal}, ${iva}, ${total}, now(), now(), ${yo.id})
        returning id, folio`;
      for (const x of partidas) {
        await tx`
          insert into pedido_partidas (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, cantidad_surtida)
          values (${p.id}, ${x.id}, ${x.cantidad}, ${x.precio}, ${x.costo}, ${pendiente ? 0 : x.cantidad})`;
        if (!pendiente) await mover(tx, { producto: x.id, cantidad: x.cantidad, tipo: "salida_venta", origen: s.id, costo: x.costo, referencia: p.folio, pedido: p.id, usuario: yo.id });
      }
      await tx`
        insert into pagos (cliente_id, pedido_id, monto, forma, referencia_pasarela, registrado_por, caja_id, recibido, terminal_id, estado, vence_en)
        values (${clienteId}, ${p.id}, ${total}, ${v.forma}, ${v.referencia?.trim().slice(0, 100) || null}, ${yo.id}, ${caja.id}, ${recibido},
                ${terminal}, ${pendiente ? "pendiente" : "confirmado"}, ${pendiente ? new Date(Date.now() + (p0[0]?.dias ?? 3) * 86400000) : null})`;
      if (fiscal) await tx`insert into facturas (pedido_id, cliente_id, forma_pago, metodo_pago, total, estado) values (${p.id}, ${clienteId}, ${v.forma}, 'PUE', ${total}, 'pendiente')`;
      await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id)
               values (${p.id}, ${pendiente ? "recibido" : "entregado"}, ${pendiente ? "Venta de mostrador: pendiente de pago por transferencia (no entregar)" : "Venta de mostrador"}, ${yo.id})`;
      return { id: p.id, folio: p.folio, pendiente };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
  }
}
