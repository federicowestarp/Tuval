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
  partidas: { nombre: string; cantidad: number }[];
  especiales: number;
};

/** Hoy en México (UTC-6, sin horario de verano). */
export const hoyMx = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

export async function paradasPendientes(): Promise<ParadaRuta[]> {
  return sql<ParadaRuta[]>`
    select p.id, p.folio, p.estado, p.zona, p.entidad, p.direccion_entrega, p.lat, p.lng, p.foto_fachada_id,
           p.recibe_nombre, p.recibe_telefono, p.preferencia_contacto, p.sin_recepcion_solicitada,
           to_char(p.entrega_fecha, 'YYYY-MM-DD') entrega_fecha, p.entrega_ventana,
           coalesce((select json_agg(json_build_object('nombre', pr.nombre, 'cantidad', pp.cantidad) order by pr.nombre)
                     from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = p.id), '[]') partidas,
           (select count(*)::int from solicitudes_producto s where s.pedido_id = p.id and s.estado = 'conseguida') especiales,
           exists (select 1 from paradas_ruta x where x.pedido_id = p.id and x.tipo = 'entrega' and x.salida_en is null) llegado
    from pedidos p
    where p.estado in ('surtido', 'en_ruta') and p.tipo_entrega <> 'recoger'
    order by p.estado desc, p.entrega_fecha nulls last, p.entrega_ventana, p.zona, p.creado_en`;
}

export async function rutaDeHoy(choferId: string) {
  const [r] = await sql<{ id: string; iniciada_en: Date | null; terminada_en: Date | null }[]>`
    select id, iniciada_en, terminada_en from rutas where chofer_id = ${choferId} and fecha = ${hoyMx()}`;
  return r ?? null;
}

/** Última posición del chofer que lleva el pedido (para el seguimiento del cliente). */
export async function ultimaPosicion(pedidoId: string) {
  const [p] = await sql<{ lat: number; lng: number; minutos: number }[]>`
    select pr.lat, pr.lng, floor(extract(epoch from now() - pr.registrada_en) / 60)::int as minutos
    from entregas e join posiciones_ruta pr on pr.ruta_id = e.ruta_id
    where e.pedido_id = ${pedidoId} and e.estado = 'en_ruta'
    order by pr.registrada_en desc limit 1`;
  return p ?? null;
}

export async function fotosDeEntrega(pedidoId: string) {
  return sql<{ id: string; archivo_id: string; tomada_en: Date }[]>`
    select f.id, (regexp_match(f.url, '([0-9a-f-]{36})$'))[1] archivo_id, f.tomada_en
    from entrega_fotos f join entregas e on e.id = f.entrega_id
    where e.pedido_id = ${pedidoId} order by f.tomada_en`;
}
