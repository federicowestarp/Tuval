import { sql } from "@/lib/db";
import type { EstadoPedido } from "@/lib/estados";
import type { Ventana, Zona } from "@/lib/corte";

export type PartidaPedido = {
  id: string;
  producto_id: string;
  nombre: string;
  sku: string;
  cantidad: number;
  precio_unitario: number | null;
  costo_unitario: number | null;
  cantidad_recibida: number | null;
};

export type PedidoDetalle = {
  id: string;
  folio: string;
  estado: EstadoPedido;
  zona: Zona | null;
  tipo_entrega: "domicilio" | "obra" | "recoger";
  direccion_entrega: string | null;
  lat: number | null;
  lng: number | null;
  foto_fachada_id: string | null;
  recibe_nombre: string | null;
  recibe_telefono: string | null;
  preferencia_contacto: "whatsapp" | "telefono" | null;
  entrega_fecha: string | null;
  entrega_ventana: Ventana | null;
  comprobante: "factura" | "nota";
  contacto_nombre: string;
  contacto_telefono: string;
  sin_recepcion_solicitada: boolean;
  notas: string | null;
  subtotal: number;
  iva: number;
  total: number;
  token_receptor: string;
  confirmado_en: Date | null;
  recepcion_confirmada_en: Date | null;
  creado_en: Date;
  partidas: PartidaPedido[];
  especiales: { id: string; descripcion: string; cantidad: number; estado: string }[];
  adjuntos: { archivo_id: string; nombre: string; mime: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function detalle(where: ReturnType<typeof sql>): Promise<PedidoDetalle | null> {
  const [p] = await sql<PedidoDetalle[]>`
    select p.id, p.folio, p.estado, p.zona, p.tipo_entrega, p.direccion_entrega, p.lat, p.lng, p.foto_fachada_id,
           p.recibe_nombre, p.recibe_telefono, p.preferencia_contacto,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.notas,
           p.subtotal, p.iva, p.total, p.token_receptor, p.confirmado_en, p.recepcion_confirmada_en, p.creado_en,
           coalesce((select json_agg(json_build_object('id', pp.id, 'producto_id', pr.id, 'nombre', pr.nombre, 'sku', pr.sku,
                      'cantidad', pp.cantidad, 'precio_unitario', pp.precio_unitario, 'costo_unitario', pp.costo_unitario,
                      'cantidad_recibida', pp.cantidad_recibida) order by pr.nombre)
                     from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = p.id), '[]') as partidas,
           coalesce((select json_agg(json_build_object('id', s.id, 'descripcion', s.descripcion, 'cantidad', s.cantidad, 'estado', s.estado)
                      order by s.creado_en)
                     from solicitudes_producto s where s.pedido_id = p.id and s.origen = 'cliente_fuera_catalogo'), '[]') as especiales,
           coalesce((select json_agg(json_build_object('archivo_id', a.id, 'nombre', a.nombre, 'mime', a.mime))
                     from pedido_archivos pa join archivos a on a.id = pa.archivo_id where pa.pedido_id = p.id), '[]') as adjuntos
    from pedidos p
    where ${where}`;
  return p ?? null;
}

export async function obtenerPedido(id: string) {
  if (!UUID.test(id)) return null;
  return detalle(sql`p.id = ${id}`);
}

export async function obtenerPedidoPorTokenReceptor(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  return detalle(sql`p.token_receptor = ${token}`);
}

export type PedidoResumen = Omit<PedidoDetalle, "partidas" | "especiales" | "adjuntos"> & {
  piezas: number;
  sin_precio: number;
  especiales: number;
  adjuntos: number;
};

export async function listarPedidos(): Promise<PedidoResumen[]> {
  return sql<PedidoResumen[]>`
    select p.id, p.folio, p.estado, p.zona, p.tipo_entrega, p.direccion_entrega, p.recibe_nombre, p.recibe_telefono,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.subtotal, p.iva, p.total,
           p.confirmado_en, p.creado_en,
           (select coalesce(sum(cantidad), 0) from pedido_partidas where pedido_id = p.id) as piezas,
           (select count(*)::int from pedido_partidas where pedido_id = p.id and precio_unitario is null) as sin_precio,
           (select count(*)::int from solicitudes_producto where pedido_id = p.id and origen = 'cliente_fuera_catalogo') as especiales,
           (select count(*)::int from pedido_archivos where pedido_id = p.id) as adjuntos
    from pedidos p
    where p.estado not in ('entregado', 'entregado_con_faltantes', 'cancelado') or p.creado_en > now() - interval '2 days'
    order by p.entrega_fecha nulls last, p.entrega_ventana, p.creado_en
    limit 200`;
}

export async function haySucursales(): Promise<boolean> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from almacenes where tipo = 'sucursal' and activo`;
  return r.n > 0;
}

/** Liga de WhatsApp sin API (gratis): abre el chat con el mensaje escrito. */
export const ligaWhatsApp = (telefono: string, mensaje: string) =>
  `https://wa.me/52${telefono.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(mensaje)}`;

export const ligaMapa = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
