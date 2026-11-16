import { sql } from "@/lib/db";
import type { EstadoPedido } from "@/lib/estados";
import type { Ventana, Zona } from "@/lib/corte";

export type PedidoDetalle = {
  id: string;
  folio: string;
  estado: EstadoPedido;
  zona: Zona;
  tipo_entrega: "domicilio" | "obra";
  direccion_entrega: string;
  entrega_fecha: string;
  entrega_ventana: Ventana;
  comprobante: "factura" | "nota";
  contacto_nombre: string;
  contacto_telefono: string;
  sin_recepcion_solicitada: boolean;
  notas: string | null;
  subtotal: number;
  iva: number;
  total: number;
  creado_en: Date;
  partidas: { nombre: string; sku: string; cantidad: number; precio_unitario: number | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerPedido(id: string): Promise<PedidoDetalle | null> {
  if (!UUID.test(id)) return null;
  const [p] = await sql<PedidoDetalle[]>`
    select p.id, p.folio, p.estado, p.zona, p.tipo_entrega, p.direccion_entrega,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.notas,
           p.subtotal, p.iva, p.total, p.creado_en,
           coalesce(json_agg(json_build_object('nombre', pr.nombre, 'sku', pr.sku, 'cantidad', pp.cantidad,
                    'precio_unitario', pp.precio_unitario) order by pr.nombre) filter (where pp.id is not null), '[]') as partidas
    from pedidos p
    left join pedido_partidas pp on pp.pedido_id = p.id
    left join productos pr on pr.id = pp.producto_id
    where p.id = ${id}
    group by p.id`;
  return p ?? null;
}

export async function listarPedidos(): Promise<(Omit<PedidoDetalle, "partidas"> & { piezas: number; sin_precio: number })[]> {
  return sql`
    select p.id, p.folio, p.estado, p.zona, p.tipo_entrega, p.direccion_entrega,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.notas,
           p.subtotal, p.iva, p.total, p.creado_en,
           coalesce(sum(pp.cantidad), 0) as piezas,
           count(*) filter (where pp.precio_unitario is null) as sin_precio
    from pedidos p
    left join pedido_partidas pp on pp.pedido_id = p.id
    where p.estado not in ('entregado', 'cancelado') or p.creado_en > now() - interval '2 days'
    group by p.id
    order by p.entrega_fecha, p.entrega_ventana, p.creado_en
    limit 200`;
}
