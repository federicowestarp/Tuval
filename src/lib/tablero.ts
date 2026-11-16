import { sql } from "@/lib/db";

/** Periodos del tablero (hora de México, UTC-6). */
export const PERIODOS = [
  { id: "hoy", nombre: "Hoy" },
  { id: "7d", nombre: "7 días" },
  { id: "30d", nombre: "30 días" },
  { id: "mes", nombre: "Este mes" },
] as const;
export type Periodo = (typeof PERIODOS)[number]["id"];

/** Inicio del periodo como fragmento SQL (timestamptz). */
const desde = (p: Periodo) => {
  const mx = sql`(now() at time zone 'America/Mexico_City')`;
  if (p === "hoy") return sql`(date_trunc('day', ${mx}) at time zone 'America/Mexico_City')`;
  if (p === "mes") return sql`(date_trunc('month', ${mx}) at time zone 'America/Mexico_City')`;
  return sql`(now() - ${p === "7d" ? "7 days" : "30 days"}::interval)`;
};

export type Etapa = { etapa: string; horas: number | null; pedidos: number };

export async function datosTablero(p: Periodo) {
  const d = desde(p);
  const [estados, flujo, cancelados, etapas, rutas, finanzas, gastos, flotilla, nomina, pendientes] = await Promise.all([
    // Pedidos abiertos hoy, por etapa (foto del momento, no del periodo)
    sql<{ etapa: string; n: number }[]>`
      select etapa, n from (
        select 'Por confirmar' etapa, 1 o, count(*)::int n from pedidos where estado = 'recibido' and confirmado_en is null
        union all select 'Confirmado, por comprar', 2, count(*)::int from pedidos where estado = 'recibido' and confirmado_en is not null
        union all select 'Comprado a proveedor', 3, count(*)::int from pedidos where estado = 'comprado_proveedor'
        union all select 'Surtido, por salir', 4, count(*)::int from pedidos where estado = 'surtido'
        union all select 'En ruta', 5, count(*)::int from pedidos where estado = 'en_ruta'
      ) x order by o`,
    // Movimiento del periodo
    sql<{ recibidos: number; cotizaciones: number; confirmados: number; entregados: number; con_faltantes: number; cancelados: number; demanda: number; contactos: number }[]>`
      select
        (select count(*)::int from pedidos where creado_en >= ${d}) recibidos,
        (select count(*)::int from cotizaciones_proveedor where cargada_en >= ${d}) cotizaciones,
        (select count(*)::int from pedidos where confirmado_en >= ${d} and estado <> 'cancelado') confirmados,
        (select count(distinct pedido_id)::int from pedido_eventos where estado in ('entregado', 'entregado_con_faltantes') and creado_en >= ${d}) entregados,
        (select count(distinct pedido_id)::int from pedido_eventos where estado = 'entregado_con_faltantes' and creado_en >= ${d}) con_faltantes,
        (select count(distinct pedido_id)::int from pedido_eventos where estado = 'cancelado' and creado_en >= ${d}) cancelados,
        (select count(*)::int from solicitudes_producto where creado_en >= ${d}) demanda,
        (select count(*)::int from contactos_web where creado_en >= ${d}) contactos`,
    sql<{ motivo: string; n: number }[]>`
      select coalesce(split_part(p.motivo_cancelacion, ':', 1), 'Sin motivo') motivo, count(*)::int n
      from pedidos p where p.estado = 'cancelado'
        and exists (select 1 from pedido_eventos e where e.pedido_id = p.id and e.estado = 'cancelado' and e.creado_en >= ${d})
      group by 1 order by 2 desc`,
    // Mediana de horas por etapa, pedidos creados en el periodo (o en 30 días si el periodo es "hoy")
    sql<Etapa[]>`
      with base as (
        select p.id, p.creado_en, p.confirmado_en,
          (select min(c.cargada_en) from cotizaciones_proveedor c where c.pedido_id = p.id) cot,
          (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'surtido') surt,
          (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'en_ruta') ruta,
          (select min(x.entregada_en) from entregas x where x.pedido_id = p.id and x.estado = 'entregada') entr
        from pedidos p where p.creado_en >= ${p === "hoy" ? sql`now() - interval '30 days'` : d}
      ), t as (
        select 1 o, 'Pedido → cotización del proveedor' etapa, extract(epoch from cot - creado_en) / 3600 h from base
        union all select 2, 'Cotización → confirmado al cliente', extract(epoch from confirmado_en - cot) / 3600 from base
        union all select 3, 'Confirmado → surtido', extract(epoch from surt - confirmado_en) / 3600 from base
        union all select 4, 'Surtido → sale a ruta', extract(epoch from ruta - surt) / 3600 from base
        union all select 5, 'Traslado: sale → entregado', extract(epoch from entr - ruta) / 3600 from base
        union all select 6, 'Total: pedido → entregado', extract(epoch from entr - creado_en) / 3600 from base
      )
      select etapa, round((percentile_cont(0.5) within group (order by h))::numeric, 1)::float horas, count(h)::int pedidos
      from t where h is not null and h >= 0 group by o, etapa order by o`,
    // Rutas del periodo: km por GPS (suma de tramos), duración, entregas
    sql<{ id: string; fecha: string; chofer: string; vehiculo: string | null; iniciada_en: Date | null; terminada_en: Date | null; km: number; horas: number | null; entregas: number; pendientes: number }[]>`
      with pos as (
        select ruta_id, lat, lng, lag(lat) over w plat, lag(lng) over w plng
        from posiciones_ruta window w as (partition by ruta_id order by registrada_en)
      ), km as (
        select ruta_id, sum(6371 * 2 * asin(sqrt(power(sin(radians(lat - plat) / 2), 2) + cos(radians(plat)) * cos(radians(lat)) * power(sin(radians(lng - plng) / 2), 2)))) km
        from pos where plat is not null group by ruta_id
      )
      select r.id, to_char(r.fecha, 'YYYY-MM-DD') fecha, u.nombre chofer, v.nombre vehiculo, r.iniciada_en, r.terminada_en,
             round(coalesce(km.km, 0)::numeric, 1)::float km,
             round((extract(epoch from coalesce(r.terminada_en, now()) - r.iniciada_en) / 3600)::numeric, 1)::float horas,
             (select count(*)::int from entregas e where e.ruta_id = r.id and e.estado = 'entregada') entregas,
             (select count(*)::int from entregas e where e.ruta_id = r.id and e.estado = 'en_ruta') pendientes
      from rutas r join usuarios_internos u on u.id = r.chofer_id left join vehiculos v on v.id = r.vehiculo_id left join km on km.ruta_id = r.id
      where r.fecha >= (${d} at time zone 'America/Mexico_City')::date
      order by r.fecha desc, u.nombre`,
    sql<{ ventas: number; costo: number; cobrado: number; gastos: number }[]>`
      select
        coalesce((select sum(total) from pedidos where confirmado_en >= ${d} and estado <> 'cancelado'), 0)::float ventas,
        coalesce((select sum(pp.costo_unitario * pp.cantidad) from pedido_partidas pp join pedidos p on p.id = pp.pedido_id
                  where p.confirmado_en >= ${d} and p.estado <> 'cancelado'), 0)::float costo,
        coalesce((select sum(monto) from pagos where pagado_en >= ${d}), 0)::float cobrado,
        coalesce((select sum(monto) from gastos where fecha >= (${d} at time zone 'America/Mexico_City')::date), 0)::float gastos`,
    sql<{ categoria: string; total: number }[]>`
      select categoria, sum(monto)::float total from gastos where fecha >= (${d} at time zone 'America/Mexico_City')::date
      group by 1 order by 2 desc`,
    sql<{ id: string; nombre: string; tipo: string; gasto: number; rutas: number; km: number; entregas: number }[]>`
      with pos as (
        select ruta_id, lat, lng, lag(lat) over w plat, lag(lng) over w plng
        from posiciones_ruta window w as (partition by ruta_id order by registrada_en)
      ), km as (
        select ruta_id, sum(6371 * 2 * asin(sqrt(power(sin(radians(lat - plat) / 2), 2) + cos(radians(plat)) * cos(radians(lat)) * power(sin(radians(lng - plng) / 2), 2)))) km
        from pos where plat is not null group by ruta_id
      ), rr as (select * from rutas where fecha >= (${d} at time zone 'America/Mexico_City')::date)
      select v.id, v.nombre, v.tipo,
        coalesce((select sum(g.monto) from gastos g where g.vehiculo_id = v.id and g.fecha >= (${d} at time zone 'America/Mexico_City')::date), 0)::float gasto,
        (select count(*)::int from rr where rr.vehiculo_id = v.id) rutas,
        round(coalesce((select sum(km.km) from rr join km on km.ruta_id = rr.id where rr.vehiculo_id = v.id), 0)::numeric, 1)::float km,
        (select count(*)::int from entregas e join rr on rr.id = e.ruta_id where rr.vehiculo_id = v.id and e.estado = 'entregada') entregas
      from vehiculos v where v.activo order by v.nombre`,
    sql<{ nombre: string; puesto: string | null; pagado: number }[]>`
      select e.nombre, e.puesto, coalesce(sum(g.monto), 0)::float pagado
      from empleados e left join gastos g on g.empleado_id = e.id and g.categoria = 'nomina' and g.fecha >= (${d} at time zone 'America/Mexico_City')::date
      where e.activo group by e.id order by pagado desc, e.nombre`,
    // Recolecciones pendientes: comprados al proveedor que aún no se surten
    sql<{ folio: string; id: string; horas: number }[]>`
      select p.folio, p.id, round((extract(epoch from now() - coalesce(
        (select max(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'comprado_proveedor'), p.creado_en)) / 3600)::numeric, 1)::float horas
      from pedidos p where p.estado = 'comprado_proveedor' order by horas desc limit 20`,
  ]);
  return { estados, flujo: flujo[0], cancelados, etapas, rutas, finanzas: finanzas[0], gastos, flotilla, nomina, pendientes };
}
