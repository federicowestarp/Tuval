"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { verificarAccesoInterno } from "../../acceso";
import { leerCotizacion, normalizar } from "@/lib/cotizacion";
import { idEmmsa } from "@/lib/interno";
import { IVA } from "@/lib/catalogo";

export type Resultado = { error?: string; mensaje?: string };

/** Carga la cotización de Emmsa y la empareja con las partidas del pedido. */
export async function cargarCotizacion(_prev: Resultado, fd: FormData): Promise<Resultado> {
  verificarAccesoInterno();
  const pedidoId = String(fd.get("pedido_id"));
  const texto = String(fd.get("texto") ?? "");
  const renglones = leerCotizacion(texto);
  if (renglones.length === 0) return { error: "No encontré renglones con precio. Revisa el orden de columnas." };

  const proveedorId = await idEmmsa();
  const partidas = await sql<{ id: string; producto_id: string; nombre: string; sku: string; sku_proveedor: string | null }[]>`
    select pp.id, pr.id as producto_id, pr.nombre, pr.sku, pv.sku_proveedor
    from pedido_partidas pp join productos pr on pr.id = pp.producto_id
    left join productos_proveedor pv on pv.producto_id = pr.id and pv.proveedor_id = ${proveedorId}
    where pp.pedido_id = ${pedidoId}`;

  const usadas = new Set<string>();
  const emparejar = (codigo: string, descripcion: string) => {
    const c = codigo.toLowerCase();
    let p = partidas.find((x) => !usadas.has(x.id) && c && (x.sku_proveedor?.toLowerCase() === c || x.sku.toLowerCase() === c));
    if (!p) {
      const d = normalizar(descripcion);
      p = partidas.find((x) => !usadas.has(x.id) && d && (d.includes(normalizar(x.nombre)) || normalizar(x.nombre).includes(d)));
    }
    if (p) usadas.add(p.id);
    return p;
  };

  let emparejados = 0;
  await sql.begin(async (tx) => {
    const [cot] = await tx<{ id: string }[]>`
      insert into cotizaciones_proveedor (proveedor_id, pedido_id, folio_proveedor, texto_original)
      values (${proveedorId}, ${pedidoId}, ${String(fd.get("folio") ?? "").trim() || null}, ${texto})
      returning id`;
    for (const r of renglones) {
      const p = emparejar(r.codigo, r.descripcion);
      if (p) emparejados++;
      await tx`
        insert into cotizacion_partidas (cotizacion_id, codigo_proveedor, descripcion, cantidad, precio_unitario, disponible, tiempo_entrega, pedido_partida_id)
        values (${cot.id}, ${r.codigo || null}, ${r.descripcion || null}, ${r.cantidad}, ${r.precio}, ${r.disponible}, ${r.tiempo || null}, ${p?.id ?? null})`;
      if (p) {
        // Guardamos el costo y el código del proveedor: así se arma la lista de costos con el uso.
        await tx`
          insert into productos_proveedor (producto_id, proveedor_id, sku_proveedor, costo, actualizado_en)
          values (${p.producto_id}, ${proveedorId}, ${r.codigo || null}, ${r.precio}, now())
          on conflict (producto_id, proveedor_id) do update
            set costo = excluded.costo, sku_proveedor = coalesce(excluded.sku_proveedor, productos_proveedor.sku_proveedor), actualizado_en = now()`;
      }
    }
  });
  revalidatePath(`/interno/pedidos/${pedidoId}`);
  return { mensaje: `Cotización cargada: ${renglones.length} renglones, ${emparejados} emparejados con el pedido.` };
}

export async function asignarRenglon(fd: FormData) {
  verificarAccesoInterno();
  const pedidoId = String(fd.get("pedido_id"));
  const renglonId = String(fd.get("renglon_id"));
  const partidaId = String(fd.get("partida_id"));
  await sql`
    update cotizacion_partidas set pedido_partida_id = ${partidaId}
    where id = ${renglonId} and exists (select 1 from pedido_partidas where id = ${partidaId} and pedido_id = ${pedidoId})`;
  revalidatePath(`/interno/pedidos/${pedidoId}`);
}

/**
 * Confirma el pedido: fija precios, quita lo que no se consigue (y lo registra como demanda no surtida),
 * recalcula totales. Después se avisa al cliente por WhatsApp.
 */
export async function confirmarPedido(_prev: Resultado, fd: FormData): Promise<Resultado> {
  verificarAccesoInterno();
  const pedidoId = String(fd.get("pedido_id"));
  const partidas = await sql<{ id: string; producto_id: string; nombre: string; cantidad: number; cot_precio: number | null }[]>`
    select pp.id, pp.producto_id, pr.nombre, pp.cantidad,
           (select cp.precio_unitario from cotizacion_partidas cp join cotizaciones_proveedor c on c.id = cp.cotizacion_id
             where cp.pedido_partida_id = pp.id order by c.cargada_en desc limit 1) as cot_precio
    from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = ${pedidoId}`;

  const quitar = partidas.filter((p) => fd.get(`quitar_${p.id}`) === "on");
  const quedan = partidas.filter((p) => !quitar.includes(p));
  const precios = new Map(quedan.map((p) => [p.id, Number(String(fd.get(`precio_${p.id}`) ?? "").replace(/[$,\s]/g, ""))]));
  const sinPrecio = quedan.filter((p) => !(precios.get(p.id)! > 0));
  if (sinPrecio.length) return { error: `Falta precio de venta en: ${sinPrecio.map((p) => p.nombre).join(", ")}` };

  const [pedido] = await sql<{ estado: string; especiales_pendientes: number }[]>`
    select estado, (select count(*)::int from solicitudes_producto where pedido_id = ${pedidoId}
                    and origen = 'cliente_fuera_catalogo' and estado in ('nueva', 'buscando')) as especiales_pendientes
    from pedidos where id = ${pedidoId}`;
  if (!pedido || pedido.estado === "cancelado") return { error: "Pedido no válido." };
  if (quedan.length === 0 && pedido.especiales_pendientes === 0) return { error: "No queda nada que surtir. Mejor cancela el pedido." };

  await sql.begin(async (tx) => {
    for (const p of quitar) {
      await tx`
        insert into solicitudes_producto (descripcion, cantidad, origen, producto_id, pedido_id, notas)
        values (${p.nombre}, ${p.cantidad}, 'proveedor_sin_existencia', ${p.producto_id}, ${pedidoId}, 'Sin existencia al confirmar pedido')`;
      await tx`delete from cotizacion_partidas where pedido_partida_id = ${p.id}`;
      await tx`delete from pedido_partidas where id = ${p.id}`;
    }
    for (const p of quedan) {
      await tx`update pedido_partidas set precio_unitario = ${precios.get(p.id)!}, costo_unitario = coalesce(${p.cot_precio}, costo_unitario) where id = ${p.id}`;
    }
    const subtotal = quedan.reduce((s, p) => s + precios.get(p.id)! * p.cantidad, 0);
    const iva = Math.round(subtotal * IVA * 100) / 100;
    await tx`update pedidos set subtotal = ${subtotal}, iva = ${iva}, total = ${subtotal + iva}, confirmado_en = now() where id = ${pedidoId}`;
    await tx`
      insert into pedido_eventos (pedido_id, estado, nota)
      values (${pedidoId}, ${pedido.estado}, ${`Confirmado. ${quitar.length} partida(s) sin existencia registradas como demanda.`})`;
  });
  revalidatePath(`/interno/pedidos/${pedidoId}`);
  return { mensaje: "Pedido confirmado. Avisa al cliente con el botón de WhatsApp." };
}
