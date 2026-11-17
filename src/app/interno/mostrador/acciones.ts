"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { mover, sucursal } from "@/lib/inventario";
import { sinIva, totalesVenta } from "@/lib/totales";
import { preciosParaLista } from "@/lib/precios";
import { nuevoCodigoRecomendado, puedeCredito, puntosDe } from "@/lib/clientes";
import { otorgarPuntos, paramLealtad } from "@/lib/lealtad";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => Number(String(v ?? "").replace(/[$,\s]/g, ""));

export type LineaVenta = { id: string; cantidad: number; precio?: number | null };
export type Venta = {
  lineas: LineaVenta[];
  forma: "efectivo" | "tarjeta" | "transferencia" | "credito";
  terminal?: string | null;
  recibido?: number | null;
  referencia?: string;
  comprobante: "nota" | "factura";
  /** Cliente de la ficha (lista de precios, crédito, puntos). Si no hay, se puede capturar nombre/datos fiscales sueltos. */
  clienteId?: string | null;
  puntos?: number;
  cliente?: { nombre?: string; telefono?: string; rfc?: string; razon?: string; cp?: string; regimen?: string; uso?: string };
};

/**
 * Venta de mostrador: queda como pedido (canal mostrador, entregado), descuenta la sucursal y registra el cobro en el turno
 * abierto del cajero. Con cliente: su lista de precios, crédito (si está autorizado y cabe en su límite) y puntos.
 * Tarjeta exige terminal. Transferencia queda PENDIENTE (no se entrega ni se descuenta) hasta confirmarse.
 */
export async function registrarVenta(v: Venta): Promise<{ error?: string; id?: string; folio?: string; pendiente?: boolean; puntos?: number }> {
  const yo = await requerirInterno("mostrador");
  const lineas = (v.lineas ?? []).filter((l) => UUID.test(l.id) && num(l.cantidad) > 0).slice(0, 200);
  if (lineas.length === 0) return { error: "Agrega al menos un producto." };
  if (!["efectivo", "tarjeta", "transferencia", "credito"].includes(v.forma)) return { error: "Elige la forma de pago." };
  const clienteFicha = v.clienteId && UUID.test(v.clienteId) ? v.clienteId : null;
  if (v.forma === "credito" && !clienteFicha) return { error: "Para vender a crédito elige al cliente." };

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
      const [ficha] = clienteFicha ? await tx<{ id: string; nombre: string; telefono: string | null; rfc: string | null; razon_social: string | null; regimen_fiscal: string | null; codigo_postal_fiscal: string | null; uso_cfdi: string | null; lista_precio_id: string | null }[]>`
        select id, nombre, telefono, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, lista_precio_id from clientes where id = ${clienteFicha} and activo` : [];
      if (clienteFicha && !ficha) throw new Error("Cliente no encontrado.");
      const fiscal = v.comprobante === "factura"
        ? (ficha ? { nombre: ficha.nombre, rfc: ficha.rfc ?? v.cliente?.rfc, razon: ficha.razon_social ?? v.cliente?.razon, cp: ficha.codigo_postal_fiscal ?? v.cliente?.cp, regimen: ficha.regimen_fiscal ?? v.cliente?.regimen, uso: ficha.uso_cfdi ?? v.cliente?.uso } : v.cliente)
        : undefined;
      if (fiscal && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test((fiscal.rfc ?? "").toUpperCase())) throw new Error("Revisa el RFC.");
      if (fiscal && !/^\d{5}$/.test(fiscal.cp ?? "")) throw new Error("Falta el código postal fiscal.");

      const pendiente = v.forma === "transferencia";
      const credito = v.forma === "credito";
      const p0 = pendiente ? await tx<{ dias: number }[]>`select valor::float dias from parametros_caja where clave = 'vigencia_transferencia_dias'` : [];
      const ids = lineas.map((l) => l.id);
      const prods = await tx<{ id: string; nombre: string; costo: number | null }[]>`
        select p.id, p.nombre, coalesce(p.costo_promedio, (select min(costo) from productos_proveedor where producto_id = p.id))::float costo
        from productos p where p.id = any(${ids}::uuid[])`;
      const precios = await preciosParaLista(ids, ficha?.lista_precio_id ?? null, tx);
      const mapa = new Map(prods.map((p) => [p.id, p]));
      const partidas = lineas.map((l) => {
        const p = mapa.get(l.id);
        if (!p) throw new Error("Un producto ya no existe.");
        const manual = l.precio != null && num(l.precio) > 0 ? sinIva(num(l.precio)) : null;
        const precio = precios.get(l.id) ?? manual;
        if (precio == null) throw new Error(`Escribe el precio de: ${p.nombre}`);
        return { ...p, cantidad: num(l.cantidad), precio };
      });
      const { subtotal, iva, total } = totalesVenta(partidas);

      // Puntos a canjear (descuento pagado con puntos) y crédito.
      const lp = await paramLealtad(tx);
      let puntosUsados = 0, montoPuntos = 0;
      if (ficha && v.puntos && v.puntos > 0) {
        const saldo = await puntosDe(ficha.id, tx);
        puntosUsados = Math.min(Math.floor(v.puntos), saldo, Math.floor(total / (lp.valor_punto || 1)));
        montoPuntos = Math.round(puntosUsados * (lp.valor_punto || 1) * 100) / 100;
      }
      const porCobrar = Math.round((total - montoPuntos) * 100) / 100;
      if (credito) {
        const ok = await puedeCredito(ficha!.id, porCobrar, tx);
        if (!ok.ok) throw new Error(ok.motivo);
      }
      const recibido = v.forma === "efectivo" ? num(v.recibido) : null;
      if (v.forma === "efectivo" && porCobrar > 0 && !(recibido! >= porCobrar)) throw new Error("El efectivo recibido no cubre el total.");

      let clienteId: string | null = ficha?.id ?? null;
      const nombre = ficha?.nombre ?? (v.cliente?.nombre?.trim().slice(0, 120) || null);
      if (!clienteId && (nombre || fiscal)) {
        const rfc = fiscal?.rfc?.toUpperCase() ?? null;
        const [c] = await tx<{ id: string }[]>`
          insert into clientes (tipo, nombre, telefono, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi, codigo_recomendado)
          values (${rfc && rfc.length === 12 ? "empresa" : "persona"}, ${nombre ?? fiscal?.razon ?? "Mostrador"}, ${v.cliente?.telefono?.replace(/\D/g, "").slice(-10) || null}, ${rfc},
                  ${fiscal?.razon ?? null}, ${fiscal?.regimen ?? null}, ${fiscal?.cp ?? null}, ${fiscal?.uso ?? null}, ${nuevoCodigoRecomendado()})
          returning id`;
        clienteId = c.id;
      }
      const [p] = await tx<{ id: string; folio: string }[]>`
        insert into pedidos (folio, canal, cliente_id, tipo_entrega, almacen_surtido, estado, comprobante, contacto_nombre, contacto_telefono,
                             subtotal, iva, total, confirmado_en, aceptado_en, aprobado_en, aprobado_por, a_credito, vendedor_id)
        values ('MO-' || lpad(nextval('folio_pedido_seq')::text, 6, '0'), 'mostrador', ${clienteId}, 'recoger', ${s.id}, ${pendiente ? "recibido" : "entregado"},
                ${v.comprobante === "factura" ? "factura" : "nota"}, ${nombre}, ${ficha?.telefono ?? (v.cliente?.telefono?.replace(/\D/g, "").slice(0, 15) || null)},
                ${subtotal}, ${iva}, ${total}, now(), now(), ${pendiente ? null : new Date()}, ${pendiente ? null : credito ? "credito" : "pago"}, ${credito}, ${yo.id})
        returning id, folio`;
      for (const x of partidas) {
        await tx`
          insert into pedido_partidas (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, cantidad_surtida)
          values (${p.id}, ${x.id}, ${x.cantidad}, ${x.precio}, ${x.costo}, ${pendiente ? 0 : x.cantidad})`;
        if (!pendiente) await mover(tx, { producto: x.id, cantidad: x.cantidad, tipo: "salida_venta", origen: s.id, costo: x.costo, referencia: p.folio, pedido: p.id, usuario: yo.id });
      }
      if (montoPuntos > 0) {
        await tx`insert into pagos (cliente_id, pedido_id, monto, forma, registrado_por, caja_id, estado) values (${clienteId}, ${p.id}, ${montoPuntos}, 'puntos', ${yo.id}, ${caja.id}, 'confirmado')`;
        await tx`insert into movimientos_puntos (cliente_id, pedido_id, puntos, motivo, creado_por) values (${clienteId}, ${p.id}, ${-puntosUsados}, 'canje', ${yo.id})`;
      }
      // A crédito no hay cobro: queda como cargo en su estado de cuenta.
      if (!credito && porCobrar > 0) await tx`
        insert into pagos (cliente_id, pedido_id, monto, forma, referencia_pasarela, registrado_por, caja_id, recibido, terminal_id, estado, vence_en)
        values (${clienteId}, ${p.id}, ${porCobrar}, ${v.forma}, ${v.referencia?.trim().slice(0, 100) || null}, ${yo.id}, ${caja.id}, ${recibido},
                ${terminal}, ${pendiente ? "pendiente" : "confirmado"}, ${pendiente ? new Date(Date.now() + (p0[0]?.dias ?? 3) * 86400000) : null})`;
      if (fiscal) await tx`insert into facturas (pedido_id, cliente_id, forma_pago, metodo_pago, total, estado) values (${p.id}, ${clienteId}, ${v.forma}, ${credito ? "PPD" : "PUE"}, ${total}, 'pendiente')`;
      await tx`insert into pedido_eventos (pedido_id, estado, nota, usuario_id)
               values (${p.id}, ${pendiente ? "recibido" : "entregado"}, ${pendiente ? "Venta de mostrador: pendiente de pago por transferencia (no entregar)" : credito ? "Venta de mostrador a crédito" : "Venta de mostrador"}, ${yo.id})`;
      // Puntos por la compra pagada (no por lo pagado con puntos ni lo que queda a crédito).
      const puntos = clienteId && !pendiente && !credito ? await otorgarPuntos(tx, clienteId, p.id, porCobrar) : 0;
      return { id: p.id, folio: p.folio, pendiente, puntos };
    });
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    refrescar("/interno/mostrador");
  }
}
