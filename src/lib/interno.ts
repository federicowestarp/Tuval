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
};

export async function idEmmsa(): Promise<string> {
  const [p] = await sql<{ id: string }[]>`select id from proveedores where nombre = 'Emmsa' limit 1`;
  if (!p) throw new Error("Proveedor Emmsa no registrado");
  return p.id;
}

/** Compara cada partida contra nuestra lista, nuestras existencias y la última cotización cargada. */
export async function compararPedido(pedidoId: string): Promise<RenglonComparacion[]> {
  return sql<RenglonComparacion[]>`
    with ultima as (
      select id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by cargada_en desc limit 1
    )
    select pp.id as partida_id, pr.id as producto_id, pr.nombre, pr.sku, pp.cantidad, pp.precio_unitario,
           (select precio from precios where producto_id = pr.id
              and lista_id = (select id from listas_precio where nombre = 'Público')) as precio_lista,
           coalesce((select sum(e.cantidad) from existencias e join almacenes a on a.id = e.almacen_id
                     where e.producto_id = pr.id and a.tipo in ('cedis', 'sucursal')), 0) as existencia_propia,
           cp.precio_unitario as cot_precio, cp.disponible as cot_disponible, cp.tiempo_entrega as cot_tiempo,
           cp.codigo_proveedor as cot_codigo, cp.dias_entrega as cot_dias
    from pedido_partidas pp
    join productos pr on pr.id = pp.producto_id
    left join cotizacion_partidas cp on cp.pedido_partida_id = pp.id and cp.cotizacion_id = (select id from ultima)
    where pp.pedido_id = ${pedidoId}
    order by pr.nombre`;
}

export async function renglonesSinAsignar(pedidoId: string) {
  return sql<{ id: string; codigo_proveedor: string; descripcion: string; precio_unitario: number; disponible: boolean | null }[]>`
    select cp.id, cp.codigo_proveedor, cp.descripcion, cp.precio_unitario, cp.disponible
    from cotizacion_partidas cp
    where cp.pedido_partida_id is null
      and cp.cotizacion_id = (select id from cotizaciones_proveedor where pedido_id = ${pedidoId} order by cargada_en desc limit 1)`;
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
           max(s.creado_en) as ultima
    from solicitudes_producto s
    left join pedidos p on p.id = s.pedido_id
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
