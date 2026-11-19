import { sql } from "@/lib/db";

export type ParadaRuta = {
  id: string;
  folio: string;
  llegado: boolean;
  estado: "surtido" | "en_ruta" | "entregado" | "entregado_con_faltantes";
  zona: string | null;
  entidad: string | null;
  direccion_entrega: string | null;
  lat: number | null;
  lng: number | null;
  foto_fachada_id: string | null;
  recibe_nombre: string | null;
  recibe_telefono: string | null;
  preferencia_contacto: "whatsapp" | "telefono" | null;
  sin_recepcion_solicitada: boolean;
  entrega_fecha: string | null;
  entrega_ventana: "manana" | "tarde" | null;
  partidas: { id: string; nombre: string; cantidad: number }[];
  especiales: number;
  eta: Date | null;
};

/** Hoy en México (UTC-6, sin horario de verano). */
export const hoyMx = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Entregas pendientes. Si el chofer tiene ruta planeada hoy, solo las suyas y en el orden planeado;
 * si no (o sin chofer), todas las que están listas, como antes.
 */
export async function paradasPendientes(choferId?: string): Promise<ParadaRuta[]> {
  const [plan] = choferId ? await sql<{ id: string }[]>`
    select r.id from rutas r where r.chofer_id = ${choferId} and r.fecha = ${hoyMx()}
      and exists (select 1 from entregas e where e.ruta_id = r.id and e.estado in ('programada', 'en_ruta'))` : [];
  return sql<ParadaRuta[]>`
    select p.id, p.folio, p.estado, p.zona, p.entidad, p.direccion_entrega, p.lat, p.lng, p.foto_fachada_id,
           p.recibe_nombre, p.recibe_telefono, p.preferencia_contacto, p.sin_recepcion_solicitada,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') entrega_fecha, p.entrega_ventana,
           coalesce((select json_agg(json_build_object('id', pp.id, 'nombre', pr.nombre, 'cantidad', pp.cantidad) order by pr.nombre)
                     from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = p.id), '[]') partidas,
           (select count(*)::int from solicitudes_producto s where s.pedido_id = p.id and s.estado = 'conseguida') especiales,
           exists (select 1 from paradas_ruta x where x.pedido_id = p.id and x.tipo = 'entrega' and x.salida_en is null) llegado
           , (select e.eta from entregas e where e.pedido_id = p.id and e.estado in ('programada', 'en_ruta') limit 1) eta
    from pedidos p
    ${plan ? sql`join entregas en on en.pedido_id = p.id and en.ruta_id = ${plan.id} and en.estado in ('programada', 'en_ruta')` : sql``}
    where p.estado in ('surtido', 'en_ruta') and p.tipo_entrega <> 'recoger'
    order by ${plan ? sql`en.orden_en_ruta nulls last,` : sql`p.estado desc,`} p.entrega_fecha nulls last, p.entrega_ventana, p.zona, p.creado_en`;
}

export async function rutaDeHoy(choferId: string) {
  const [r] = await sql<{ id: string; iniciada_en: Date | null; terminada_en: Date | null }[]>`
    select id, iniciada_en, terminada_en from rutas where chofer_id = ${choferId} and fecha = ${hoyMx()}`;
  return r ?? null;
}

/** Última posición del chofer que lleva el pedido (para el seguimiento del cliente). */
/** Última ubicación del pedido en ruta: la más reciente entre el teléfono del chofer y el GPS (o app) del vehículo. */
/**
 * Dónde va el chofer, solo cuando ya viene hacia este cliente: su entrega es la siguiente de la ruta
 * (no quedan otras pendientes antes) y la ubicación es reciente. Si no, cuántas entregas faltan antes.
 */
export async function ultimaPosicion(pedidoId: string): Promise<{ lat: number; lng: number; minutos: number } | { antes: number } | null> {
  const [e] = await sql<{ ruta_id: string; vehiculo_id: string | null; antes: number }[]>`
    select e.ruta_id, ru.vehiculo_id,
           (select count(*)::int from entregas o where o.ruta_id = e.ruta_id and o.id <> e.id and o.estado = 'en_ruta'
              and coalesce(o.orden_en_ruta, 999) < coalesce(e.orden_en_ruta, 999)) antes
    from entregas e join rutas ru on ru.id = e.ruta_id
    where e.pedido_id = ${pedidoId} and e.estado = 'en_ruta' limit 1`;
  if (!e) return null;
  if (e.antes > 0) return { antes: e.antes };
  const [p] = await sql<{ lat: number; lng: number; minutos: number }[]>`
    with pos as (
      (select pr.lat, pr.lng, pr.registrada_en from posiciones_ruta pr where pr.ruta_id = ${e.ruta_id} order by pr.registrada_en desc limit 1)
      union all
      (select pv.lat, pv.lng, pv.registrada_en from posiciones_vehiculo pv where pv.vehiculo_id = ${e.vehiculo_id} order by pv.registrada_en desc limit 1)
    )
    select lat, lng, floor(extract(epoch from now() - registrada_en) / 60)::int as minutos from pos
    where registrada_en > now() - interval '30 minutes' order by registrada_en desc limit 1`;
  return p ?? null;
}

export async function fotosDeEntrega(pedidoId: string) {
  return sql<{ id: string; archivo_id: string; tomada_en: Date }[]>`
    select f.id, (regexp_match(f.url, '([0-9a-f-]{36})$'))[1] archivo_id, f.tomada_en
    from entrega_fotos f join entregas e on e.id = f.entrega_id
    where e.pedido_id = ${pedidoId} order by f.tomada_en`;
}
