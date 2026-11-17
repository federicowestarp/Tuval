"use server";

import { refrescar } from "@/lib/refrescar";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { leerCotizacion, normalizar } from "@/lib/cotizacion";
import { leerPdfEmmsa } from "@/lib/emmsa";
import { guardarArchivo } from "@/lib/archivos";
import { idEmmsa } from "@/lib/interno";
import { IVA } from "@/lib/catalogo";

export type Resultado = { error?: string; mensaje?: string };

type Renglon = { codigo: string; descripcion: string; cantidad: number | null; unidad?: string; precio: number; disponible: boolean | null; tiempo: string; dias?: number | null };

/** Carga la cotización de Emmsa (PDF o pegada desde Excel) y la empareja con las partidas del pedido. */
export async function cargarCotizacion(_prev: Resultado, fd: FormData): Promise<Resultado> {
  await requerirInterno("operador");
  const pedidoId = String(fd.get("pedido_id"));
  const archivo = fd.get("pdf");
  let renglones: Renglon[] = [];
  let meta: { folio: string | null; fecha: string | null; vigencia: string | null; condiciones: string | null; subtotal: number | null; total: number | null; cuadra: boolean | null } =
    { folio: null, fecha: null, vigencia: null, condiciones: null, subtotal: null, total: null, cuadra: null };
  let archivoId: string | null = null;
  let texto = "";

  if (archivo && typeof archivo !== "string" && archivo.size > 0) {
    if (archivo.type !== "application/pdf") return { error: "Sube el PDF de la cotización de Emmsa." };
    const c = await leerPdfEmmsa(new Uint8Array(await archivo.arrayBuffer()));
    if (c.renglones.length === 0) return { error: "No reconocí partidas en el PDF. ¿Es una cotización de Emmsa?" };
    renglones = c.renglones.map((r) => ({
      codigo: r.codigo, descripcion: r.descripcion, cantidad: r.cantidad, unidad: r.unidad,
      precio: r.precio, disponible: null, tiempo: r.tiempo, dias: r.dias,
    }));
    meta = { folio: c.folio, fecha: c.fecha, vigencia: c.vigencia, condiciones: c.condiciones, subtotal: c.subtotal, total: c.total, cuadra: c.cuadra };
    archivoId = await guardarArchivo(archivo, ["application/pdf"]);
    texto = c.renglones.map((r) => `${r.partida}\t${r.codigo}\t${r.descripcion}\t${r.cantidad}\t${r.unidad}\t${r.precio}\t${r.tiempo}`).join("\n");
  } else {
    texto = String(fd.get("texto") ?? "");
    renglones = leerCotizacion(texto);
    if (renglones.length === 0) return { error: "Sube el PDF o pega renglones con precio." };
    meta.folio = String(fd.get("folio") ?? "").trim() || null;
  }

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
      insert into cotizaciones_proveedor (proveedor_id, pedido_id, folio_proveedor, texto_original, archivo_id,
                                          fecha_proveedor, vigencia, condiciones, subtotal, total, cuadra)
      values (${proveedorId}, ${pedidoId}, ${meta.folio}, ${texto}, ${archivoId},
              ${meta.fecha}, ${meta.vigencia}, ${meta.condiciones}, ${meta.subtotal}, ${meta.total}, ${meta.cuadra})
      returning id`;
    for (const r of renglones) {
      const p = emparejar(r.codigo, r.descripcion);
      if (p) emparejados++;
      await tx`
        insert into cotizacion_partidas (cotizacion_id, codigo_proveedor, descripcion, cantidad, unidad, precio_unitario,
                                         disponible, tiempo_entrega, dias_entrega, pedido_partida_id)
        values (${cot.id}, ${r.codigo || null}, ${r.descripcion || null}, ${r.cantidad}, ${r.unidad ?? null}, ${r.precio},
                ${r.disponible}, ${r.tiempo || null}, ${r.dias ?? null}, ${p?.id ?? null})`;
      if (p) {
        // Guardamos el costo y el código del proveedor: así se arma la lista de costos con el uso.
        await tx`
          insert into productos_proveedor (producto_id, proveedor_id, sku_proveedor, costo, tiempo_surtido_horas, actualizado_en)
          values (${p.producto_id}, ${proveedorId}, ${r.codigo || null}, ${r.precio}, ${r.dias != null ? r.dias * 24 : null}, now())
          on conflict (producto_id, proveedor_id) do update
            set costo = excluded.costo, sku_proveedor = coalesce(excluded.sku_proveedor, productos_proveedor.sku_proveedor),
                tiempo_surtido_horas = coalesce(excluded.tiempo_surtido_horas, productos_proveedor.tiempo_surtido_horas), actualizado_en = now()`;
      }
    }
  });
  refrescar(`/interno/pedidos/${pedidoId}`);
  const aviso = meta.cuadra === false ? " ⚠ La suma de partidas no cuadra con el subtotal del PDF: revísala." : "";
  return {
    mensaje: `Cotización ${meta.folio ?? ""} cargada: ${renglones.length} renglones, ${emparejados} emparejados con el pedido.${aviso}`,
  };
}

/**
 * Para pedidos que llegaron como foto o lista: los renglones de la cotización que no existen en el pedido
 * se dan de alta (categoría "por clasificar", ligados al código de Emmsa) y entran como partidas.
 */
export async function agregarRenglonesAlPedido(fd: FormData) {
  await requerirInterno("operador");
  const pedidoId = String(fd.get("pedido_id"));
  const proveedorId = await idEmmsa();
  const sueltos = await sql<{ id: string; codigo_proveedor: string | null; descripcion: string; cantidad: number | null; precio_unitario: number; unidad: string | null }[]>`
    select cp.id, cp.codigo_proveedor, cp.descripcion, cp.cantidad, cp.precio_unitario, cp.unidad
    from cotizacion_partidas cp
    where cp.pedido_partida_id is null
      and cp.cotizacion_id = (select id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by cargada_en desc limit 1)`;
  await sql.begin(async (tx) => {
    for (const r of sueltos) {
      // ¿Ya existe en catálogo con ese código de Emmsa?
      let [prod] = await tx<{ id: string }[]>`
        select producto_id as id from productos_proveedor where proveedor_id = ${proveedorId} and sku_proveedor = ${r.codigo_proveedor}`;
      if (!prod) {
        [prod] = await tx<{ id: string }[]>`
          insert into productos (sku, nombre, categoria_id, unidad)
          values (${"EM-" + (r.codigo_proveedor ?? r.id.slice(0, 8)).toUpperCase()}, ${r.descripcion}, 'por_clasificar',
                  ${r.unidad === "MTO" ? "metro" : "pieza"})
          on conflict (sku) do update set nombre = productos.nombre
          returning id`;
      }
      await tx`
        insert into productos_proveedor (producto_id, proveedor_id, sku_proveedor, costo, actualizado_en)
        values (${prod.id}, ${proveedorId}, ${r.codigo_proveedor}, ${r.precio_unitario}, now())
        on conflict (producto_id, proveedor_id) do update set costo = excluded.costo, actualizado_en = now()`;
      const [partida] = await tx<{ id: string }[]>`
        insert into pedido_partidas (pedido_id, producto_id, cantidad, costo_unitario)
        values (${pedidoId}, ${prod.id}, ${r.cantidad ?? 1}, ${r.precio_unitario}) returning id`;
      await tx`update cotizacion_partidas set pedido_partida_id = ${partida.id} where id = ${r.id}`;
    }
  });
  refrescar(`/interno/pedidos/${pedidoId}`);
}

export async function asignarRenglon(fd: FormData) {
  await requerirInterno("operador");
  const pedidoId = String(fd.get("pedido_id"));
  const renglonId = String(fd.get("renglon_id"));
  const partidaId = String(fd.get("partida_id"));
  await sql`
    update cotizacion_partidas set pedido_partida_id = ${partidaId}
    where id = ${renglonId} and exists (select 1 from pedido_partidas where id = ${partidaId} and pedido_id = ${pedidoId})`;
  refrescar(`/interno/pedidos/${pedidoId}`);
}

/**
 * Confirma el pedido: fija precios, quita lo que no se consigue (y lo registra como demanda no surtida),
 * recalcula totales. Después se avisa al cliente por WhatsApp.
 */
export async function confirmarPedido(_prev: Resultado, fd: FormData): Promise<Resultado> {
  await requerirInterno("operador");
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
  refrescar(`/interno/pedidos/${pedidoId}`);
  return { mensaje: "Pedido confirmado. Avisa al cliente con el botón de WhatsApp." };
}
