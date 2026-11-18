import { sql } from "@/lib/db";
import { PLAZOS, archivado, frescuraProveedor } from "@/lib/seguimiento";
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
  entidad: string | null;
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
  motivo_cancelacion: string | null;
  cotizacion_solicitada_en: Date | null;
  aceptado_en: Date | null;
  recepcion_confirmada_en: Date | null;
  creado_en: Date;
  partidas: PartidaPedido[];
  especiales: { id: string; descripcion: string; cantidad: number; estado: string }[];
  adjuntos: { archivo_id: string; nombre: string; mime: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function detalle(where: ReturnType<typeof sql>): Promise<PedidoDetalle | null> {
  const [p] = await sql<PedidoDetalle[]>`
    select p.id, p.folio, p.estado, p.zona, p.entidad, p.tipo_entrega, p.direccion_entrega, p.lat, p.lng, p.foto_fachada_id,
           p.recibe_nombre, p.recibe_telefono, p.preferencia_contacto,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.notas,
           p.subtotal, p.iva, p.total, p.token_receptor, p.confirmado_en, p.motivo_cancelacion, p.cotizacion_solicitada_en, p.aceptado_en, p.recepcion_confirmada_en, p.creado_en,
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
  reconfirmar: boolean;
  piezas: number;
  sin_precio: number;
  especiales: number;
  adjuntos: number;
  /** Momentos del proceso, para saber en qué paso va y desde cuándo. */
  hitos: { paso: string; en: string }[];
};

/** Paso actual del pedido: el hito más reciente del proceso (el contador se reinicia en cada paso). */
export function pasoActual(p: { creado_en: Date | string; hitos: { paso: string; en: string }[] }): { paso: string; desde: string } {
  let actual = { paso: "Llegó", desde: new Date(p.creado_en).toISOString() };
  for (const h of p.hitos ?? []) if (h.en && new Date(h.en) > new Date(actual.desde)) actual = { paso: h.paso, desde: new Date(h.en).toISOString() };
  return actual;
}

/** "3 h 20 min" desde una fecha hasta ahora (para el primer render; luego se actualiza en el navegador). */
export function tiempoDesde(fecha: Date | string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
}

export type VistaPedidos = "proceso" | "cerrados" | "archivo";

/** En proceso: abiertos · Cerrados: entregados/cancelados recientes · Archivo: lo viejo (nada se borra). Sin ventas de mostrador. */
export async function listarPedidos(vista: VistaPedidos = "proceso"): Promise<PedidoResumen[]> {
  const filtro =
    vista === "archivo" ? archivado
    : vista === "cerrados" ? sql`p.estado in ('entregado', 'entregado_con_faltantes', 'cancelado') and not ${archivado}`
    : sql`p.estado not in ('entregado', 'entregado_con_faltantes', 'cancelado') and not ${archivado}`;
  return sql<PedidoResumen[]>`
    select p.id, p.folio, p.estado, p.zona, p.entidad, p.tipo_entrega, p.direccion_entrega, p.recibe_nombre, p.recibe_telefono, p.motivo_cancelacion, p.cotizacion_solicitada_en, p.aceptado_en,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') as entrega_fecha, p.entrega_ventana, p.comprobante,
           p.contacto_nombre, p.contacto_telefono, p.sin_recepcion_solicitada, p.subtotal, p.iva, p.total,
           p.confirmado_en, p.creado_en, p.token_receptor,
           (select coalesce(sum(cantidad), 0) from pedido_partidas where pedido_id = p.id) as piezas,
           (select count(*)::int from pedido_partidas where pedido_id = p.id and precio_unitario is null) as sin_precio,
           (select count(*)::int from solicitudes_producto where pedido_id = p.id and origen = 'cliente_fuera_catalogo') as especiales,
           (select count(*)::int from pedido_archivos where pedido_id = p.id) as adjuntos,
           (select coalesce(json_agg(json_build_object('paso', h.paso, 'en', h.en)) filter (where h.en is not null), '[]') from (values
              ('Pedimos cotización', p.cotizacion_solicitada_en),
              ('Cotización del proveedor', (select max(c.cargada_en) from cotizaciones_proveedor c where c.pedido_id = p.id)),
              ('Confirmado al cliente', p.confirmado_en),
              ('Cliente aceptó', p.aceptado_en),
              ('Aprobado', p.aprobado_en),
              ('Orden enviada al proveedor', (select max(o.enviada_en) from ordenes_compra o where o.pedido_id = p.id and o.estado <> 'cancelada')),
              ('Comprado al proveedor', (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'comprado_proveedor')),
              ('Surtido', (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'surtido')),
              ('En ruta', (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'en_ruta')),
              ('Entregado', (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado in ('entregado', 'entregado_con_faltantes'))),
              ('Cancelado', (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'cancelado'))
            ) h(paso, en)) as hitos,
           coalesce(p.estado = 'recibido' and ${frescuraProveedor} < now() - make_interval(hours => ${PLAZOS.reconfirmarHoras}), false) as reconfirmar
    from pedidos p
    where p.canal <> 'mostrador' and ${filtro}
    order by p.creado_en desc
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

/** Dónde se entrega, para mostrar: el estado si es foráneo, la zona si es local. */
export function lugar(p: { zona: string | null; entidad: string | null }): string {
  if (!p.zona) return "Recoger";
  if (p.zona === "otro") return p.entidad ?? "Otro estado";
  return { puebla: "Puebla", atlixco: "Atlixco", tlaxcala: "Tlaxcala" }[p.zona] ?? p.zona;
}

/** Pedidos y solicitudes de la página por estado (últimos 90 días): para ver dónde hay demanda. */
export async function demandaPorEstado() {
  return sql<{ entidad: string; pedidos: number; contactos: number }[]>`
    select entidad, sum(p)::int pedidos, sum(c)::int contactos from (
      select coalesce(entidad, 'Sin estado') entidad, 1 p, 0 c from pedidos where creado_en > now() - interval '90 days' and estado <> 'cancelado'
      union all
      select coalesce(entidad, 'Sin estado'), 0, 1 from contactos_web where creado_en > now() - interval '90 days'
    ) x group by entidad order by sum(p) + sum(c) desc`;
}
