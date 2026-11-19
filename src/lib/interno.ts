import { sql } from "@/lib/db";

export type RenglonComparacion = {
  partida_id: string;
  producto_id: string;
  nombre: string;
  sku: string;
  cantidad: number;
  precio_unitario: number | null;   // precio ya puesto en el pedido
  precio_lista: number | null;      // nuestra lista Público
  existencia_propia: number;        // CEDIS + sucursales
  cot_precio: number | null;        // costo según última cotización del proveedor
  cot_disponible: boolean | null;
  cot_tiempo: string | null;
  cot_codigo: string | null;
  cot_dias: number | null;
  /** Proveedor al que se compra esta partida (elegido, o el de mejor oferta disponible). */
  proveedor_id: string | null;
  proveedor: string | null;
  /** Última oferta de cada proveedor que cotizó esta partida. */
  ofertas: Oferta[];
};
export type Oferta = { proveedor_id: string; proveedor: string; precio: number; disponible: boolean | null; tiempo: string | null; dias: number | null; codigo: string | null; preferencia: number | null };

export async function idEmmsa(): Promise<string> {
  const [p] = await sql<{ id: string }[]>`select id from proveedores where nombre = 'Emmsa' limit 1`;
  if (!p) throw new Error("Proveedor Emmsa no registrado");
  return p.id;
}

/**
 * Compara cada partida contra nuestra lista, nuestras existencias y la última cotización de cada proveedor.
 * El proveedor de la partida es el elegido al confirmar; si no, el que sí tiene la pieza, prefiriendo el surtidor
 * principal del producto, luego el alterno y luego el más barato.
 */
export async function compararPedido(pedidoId: string): Promise<RenglonComparacion[]> {
  const filas = await sql<(Omit<RenglonComparacion, "cot_precio" | "cot_disponible" | "cot_tiempo" | "cot_codigo" | "cot_dias" | "proveedor" | "proveedor_id"> & { elegido: string | null })[]>`
    with ultimas as (
      select distinct on (c.proveedor_id) c.id, c.proveedor_id from cotizaciones_proveedor c
      where c.pedido_id = ${pedidoId} order by c.proveedor_id, c.cargada_en desc
    )
    select pp.id as partida_id, pr.id as producto_id, pr.nombre, pr.sku, pp.cantidad, pp.precio_unitario, pp.proveedor_id as elegido,
           -- Lista del cliente si tiene; si no, Público.
           coalesce((select precio from precios where producto_id = pr.id
                       and lista_id = (select c.lista_precio_id from pedidos pe join clientes c on c.id = pe.cliente_id where pe.id = pp.pedido_id)),
                    (select precio from precios where producto_id = pr.id
                       and lista_id = (select id from listas_precio where nombre = 'Público'))) as precio_lista,
           coalesce((select sum(e.cantidad) from existencias e join almacenes a on a.id = e.almacen_id
                     where e.producto_id = pr.id and a.tipo in ('cedis', 'sucursal')), 0) as existencia_propia,
           coalesce((select json_agg(json_build_object('proveedor_id', u.proveedor_id, 'proveedor', pv.nombre, 'precio', cp.precio_unitario::float,
                        'disponible', cp.disponible, 'tiempo', cp.tiempo_entrega, 'dias', cp.dias_entrega, 'codigo', cp.codigo_proveedor,
                        'preferencia', (select x.preferencia from productos_proveedor x where x.producto_id = pr.id and x.proveedor_id = u.proveedor_id))
                        -- Primero quien sí tiene la pieza; luego el surtidor principal, el alterno y al final el precio.
                        order by (cp.disponible is false), coalesce((select x.preferencia from productos_proveedor x where x.producto_id = pr.id and x.proveedor_id = u.proveedor_id), 9), cp.precio_unitario)
                     from ultimas u join cotizacion_partidas cp on cp.cotizacion_id = u.id and cp.pedido_partida_id = pp.id
                     join proveedores pv on pv.id = u.proveedor_id), '[]') as ofertas
    from pedido_partidas pp
    join productos pr on pr.id = pp.producto_id
    where pp.pedido_id = ${pedidoId}
    order by pr.nombre`;
  return filas.map(({ elegido, ...x }) => {
    const o = x.ofertas.find((k) => k.proveedor_id === elegido) ?? x.ofertas[0] ?? null;
    return {
      ...x, proveedor_id: o?.proveedor_id ?? elegido, proveedor: o?.proveedor ?? null,
      cot_precio: o?.precio ?? null, cot_disponible: o ? o.disponible : null, cot_tiempo: o?.tiempo ?? null, cot_codigo: o?.codigo ?? null, cot_dias: o?.dias ?? null,
    };
  });
}

export async function renglonesSinAsignar(pedidoId: string) {
  return sql<{ id: string; codigo_proveedor: string; descripcion: string; precio_unitario: number; disponible: boolean | null }[]>`
    select cp.id, cp.codigo_proveedor, cp.descripcion, cp.precio_unitario, cp.disponible
    from cotizacion_partidas cp
    where cp.pedido_partida_id is null
      and cp.cotizacion_id in (select distinct on (proveedor_id) id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by proveedor_id, cargada_en desc)`;
}

/** Demanda agrupada: misma descripción (sin acentos ni mayúsculas) y mismo estado = un renglón. */
export type GrupoDemanda = {
  ids: string[];
  descripcion: string;
  cantidad_total: number | null;
  veces: number;
  clientes: number;
  origenes: string[];
  estado: string;
  proveedor_alterno: string | null;
  notas: string | null;
  pedidos: { id: string; folio: string }[];
  ultima: Date;
  contactos: { id: string; telefono: string; nombre: string | null; avisado: boolean }[];
  hay_existencia: boolean;
};

export async function listarDemanda(estado?: string): Promise<GrupoDemanda[]> {
  return sql<GrupoDemanda[]>`
    select array_agg(s.id order by s.creado_en) as ids,
           (array_agg(s.descripcion order by s.creado_en desc))[1] as descripcion,
           sum(s.cantidad) as cantidad_total,
           count(*)::int as veces,
           count(distinct coalesce(s.cuenta_id::text, p.contacto_telefono, s.id::text))::int as clientes,
           array_agg(distinct s.origen::text) as origenes,
           s.estado,
           max(s.proveedor_alterno) as proveedor_alterno,
           max(s.notas) as notas,
           coalesce(json_agg(distinct jsonb_build_object('id', p.id, 'folio', p.folio)) filter (where p.id is not null), '[]') as pedidos,
           max(s.creado_en) as ultima,
           coalesce(json_agg(jsonb_build_object('id', s.id, 'telefono', coalesce(s.contacto_telefono, p.contacto_telefono, cu.telefono),
                       'nombre', coalesce(p.contacto_nombre, cl.nombre, cu.nombre), 'avisado', s.avisado_en is not null))
                    filter (where coalesce(s.contacto_telefono, p.contacto_telefono, cu.telefono) is not null), '[]') as contactos,
           bool_or(exists (select 1 from existencias e join almacenes a on a.id = e.almacen_id
                           where e.producto_id = s.producto_id and a.tipo in ('sucursal', 'cedis') and e.cantidad > 0)) as hay_existencia
    from solicitudes_producto s
    left join pedidos p on p.id = s.pedido_id
    left join cuentas cu on cu.id = s.cuenta_id
    left join clientes cl on cl.id = s.cliente_id
    where ${estado ? sql`s.estado = ${estado}` : sql`s.estado in ('nueva', 'buscando', 'conseguida')`}
    group by lower(unaccent(trim(s.descripcion))), s.estado
    order by veces desc, ultima desc
    limit 300`;
}

export async function ultimaCotizacion(pedidoId: string): Promise<string | null> {
  const [c] = await sql<{ id: string }[]>`
    select id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by cargada_en desc limit 1`;
  return c?.id ?? null;
}
