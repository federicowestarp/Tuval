import { cacheLife, cacheTag } from "next/cache";
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

/** Ventana para promediar el costo por km del vehículo y por hora del chofer. */
export const DIAS_COSTO = 90;
export type Ruta = {
  id: string; fecha: string; chofer: string; vehiculo: string | null; iniciada_en: Date | null; terminada_en: Date | null;
  km: number; horas: number | null; entregas: number; pendientes: number; km_odometro: number | null;
  costo_km: number | null; costo_hora: number | null; costo: number; costo_incompleto: boolean;
  km_plan: number | null; horas_plan: number | null; tarde: number;
};

/**
 * En caché un minuto por periodo; cualquier acción del panel lo invalida al instante (refrescar → updateTag).
 * Todas las consultas salen en una sola tanda en paralelo.
 */
export async function datosTablero(p: Periodo) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag("tablero");
  const d = desde(p);
  const extra = datosExtra(p);
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
        (select count(*)::int from pedidos where canal <> 'mostrador' and creado_en >= ${d}) recibidos,
        (select count(*)::int from cotizaciones_proveedor where cargada_en >= ${d}) cotizaciones,
        (select count(*)::int from pedidos where canal <> 'mostrador' and confirmado_en >= ${d} and estado <> 'cancelado') confirmados,
        (select count(distinct e.pedido_id)::int from pedido_eventos e join pedidos p on p.id = e.pedido_id where p.canal <> 'mostrador' and e.estado in ('entregado', 'entregado_con_faltantes') and e.creado_en >= ${d}) entregados,
        (select count(distinct pedido_id)::int from pedido_eventos where estado = 'entregado_con_faltantes' and creado_en >= ${d}) con_faltantes,
        (select count(distinct pedido_id)::int from pedido_eventos where estado = 'cancelado' and creado_en >= ${d}) cancelados,
        (select count(*)::int from solicitudes_producto where creado_en >= ${d}) demanda,
        (select count(*)::int from contactos_web where creado_en >= ${d}) contactos`,
    sql<{ motivo: string; n: number }[]>`
      select coalesce(split_part(p.motivo_cancelacion, ':', 1), 'Sin motivo') motivo, count(*)::int n
      from pedidos p where p.estado = 'cancelado'
        and exists (select 1 from pedido_eventos e where e.pedido_id = p.id and e.estado = 'cancelado' and e.creado_en >= ${d})
      group by 1 order by 2 desc`,
    // Mediana de horas por etapa, pedidos en línea creados en el periodo (o en 30 días si el periodo es "hoy")
    sql<Etapa[]>`
      with base as (
        select p.id, p.creado_en, p.cotizacion_solicitada_en sol, p.confirmado_en conf, p.aceptado_en acep,
          (select min(c.cargada_en) from cotizaciones_proveedor c where c.pedido_id = p.id) cot,
          (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'comprado_proveedor') comp,
          (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'surtido') surt,
          (select min(e.creado_en) from pedido_eventos e where e.pedido_id = p.id and e.estado = 'en_ruta') ruta,
          (select min(x.llegada_en) from paradas_ruta x where x.pedido_id = p.id and x.tipo = 'entrega') lleg,
          (select min(x.entregada_en) from entregas x where x.pedido_id = p.id and x.estado = 'entregada') entr
        from pedidos p where p.canal <> 'mostrador' and p.creado_en >= ${p === "hoy" ? sql`now() - interval '30 days'` : d}
      ), t as (
                  select 1 o, 'Pedido → pedimos cotización' etapa, extract(epoch from sol - creado_en) / 3600 h from base
        union all select 2, 'Proveedor responde (existencias)', extract(epoch from cot - coalesce(sol, creado_en)) / 3600 from base
        union all select 3, 'Respuesta → confirmamos al cliente', extract(epoch from conf - cot) / 3600 from base
        union all select 4, 'Confirmado → cliente acepta', extract(epoch from acep - conf) / 3600 from base
        union all select 5, 'Aceptado → compra al proveedor', extract(epoch from comp - acep) / 3600 from base
        union all select 6, 'Compra → recolectado (surtido)', extract(epoch from surt - coalesce(comp, acep)) / 3600 from base
        union all select 7, 'Surtido → sale a ruta', extract(epoch from ruta - surt) / 3600 from base
        union all select 8, 'Traslado al cliente', extract(epoch from coalesce(lleg, entr) - ruta) / 3600 from base
        union all select 9, 'Espera con el cliente', extract(epoch from entr - lleg) / 3600 from base
        union all select 10, 'Aceptado → entregado (surtir)', extract(epoch from entr - acep) / 3600 from base
        union all select 11, 'Total: pedido → entregado', extract(epoch from entr - creado_en) / 3600 from base
      )
      select etapa, round((percentile_cont(0.5) within group (order by h))::numeric, 2)::float horas, count(h)::int pedidos
      from t where h is not null and h >= 0 group by o, etapa order by o`,
    // Rutas del periodo con su costo: km × costo por km del vehículo + horas × costo por hora del chofer,
    // ambos con el promedio de los últimos 90 días (gasolina, servicios, reparaciones, seguro, casetas y nómina).
    sql<Ruta[]>`
      with pos as (
        select ruta_id, lat, lng, lag(lat) over w plat, lag(lng) over w plng
        from posiciones_ruta window w as (partition by ruta_id order by registrada_en)
      ), km as (
        select ruta_id, sum(6371 * 2 * asin(sqrt(power(sin(radians(lat - plat) / 2), 2) + cos(radians(plat)) * cos(radians(lat)) * power(sin(radians(lng - plng) / 2), 2)))) km
        from pos where plat is not null group by ruta_id
      ), base as (
        select r.*, coalesce(case when r.odometro_fin >= r.odometro_inicio then r.odometro_fin - r.odometro_inicio end, km.km, 0)::float km_ruta,
               greatest(extract(epoch from coalesce(r.terminada_en, now()) - r.iniciada_en) / 3600, 0)::float horas_ruta,
               km.km km_gps
        from rutas r left join km on km.ruta_id = r.id
      ), r90 as (select * from base where fecha >= (now() at time zone 'America/Mexico_City')::date - ${DIAS_COSTO}::int),
      costo_km as (
        select v.id vehiculo_id,
               coalesce((select sum(g.monto) from gastos g where g.vehiculo_id = v.id and g.categoria <> 'nomina'
                         and g.fecha >= (now() at time zone 'America/Mexico_City')::date - ${DIAS_COSTO}::int), 0)
               / nullif((select sum(km_ruta) from r90 where r90.vehiculo_id = v.id), 0) por_km
        from vehiculos v
      ), costo_hora as (
        select e.usuario_id chofer_id,
               coalesce(sum(g.monto) filter (where g.fecha >= (now() at time zone 'America/Mexico_City')::date - ${DIAS_COSTO}::int), 0)
               / nullif((select sum(horas_ruta) from r90 where r90.chofer_id = e.usuario_id), 0) por_hora
        from empleados e left join gastos g on g.empleado_id = e.id and g.categoria = 'nomina'
        where e.usuario_id is not null group by e.usuario_id
      )
      select b.id, to_char(b.fecha, 'YYYY-MM-DD') fecha, u.nombre chofer, v.nombre vehiculo, b.iniciada_en, b.terminada_en,
             round(coalesce(b.km_gps, 0)::numeric, 1)::float km,
             round(b.horas_ruta::numeric, 1)::float horas,
             (select count(*)::int from entregas e where e.ruta_id = b.id and e.estado = 'entregada') entregas,
             (select count(*)::int from entregas e where e.ruta_id = b.id and e.estado = 'en_ruta') pendientes,
             case when b.odometro_fin >= b.odometro_inicio then b.odometro_fin - b.odometro_inicio end km_odometro,
             round(ck.por_km::numeric, 2)::float costo_km, round(ch.por_hora::numeric, 2)::float costo_hora,
             round((coalesce(b.km_ruta * ck.por_km, 0) + coalesce(b.horas_ruta * ch.por_hora, 0))::numeric)::float costo,
             (ck.por_km is null or ch.por_hora is null) costo_incompleto,
             -- Planeado contra real: lo que calculó el planeador al armar la ruta y entregas que llegaron después de su hora límite.
             round(b.km_estimados::numeric, 1)::float km_plan, round((b.minutos_estimados / 60.0)::numeric, 1)::float horas_plan,
             (select count(*)::int from entregas e where e.ruta_id = b.id and e.estado = 'entregada' and e.hora_limite is not null and e.entregada_en > e.hora_limite) tarde
      from base b join usuarios_internos u on u.id = b.chofer_id left join vehiculos v on v.id = b.vehiculo_id
      left join costo_km ck on ck.vehiculo_id = b.vehiculo_id left join costo_hora ch on ch.chofer_id = b.chofer_id
      where b.fecha >= (${d} at time zone 'America/Mexico_City')::date
      order by b.fecha desc, u.nombre`,
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
    sql<{ id: string; nombre: string; tipo: string; gasto: number; rutas: number; km: number; entregas: number; km_odometro: number | null; litros: number; combustible: number; km_rastreador: number | null }[]>`
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
        (select count(*)::int from entregas e join rr on rr.id = e.ruta_id where rr.vehiculo_id = v.id and e.estado = 'entregada') entregas,
        (select sum(odometro_fin - odometro_inicio)::int from rr where rr.vehiculo_id = v.id and odometro_fin >= odometro_inicio) km_odometro,
        coalesce((select sum(g.litros) from gastos g where g.vehiculo_id = v.id and g.categoria = 'combustible' and g.fecha >= (${d} at time zone 'America/Mexico_City')::date), 0)::float litros,
        coalesce((select sum(g.monto) from gastos g where g.vehiculo_id = v.id and g.categoria = 'combustible' and g.fecha >= (${d} at time zone 'America/Mexico_City')::date), 0)::float combustible,
        (select round(sum(km)::numeric, 1)::float from (
          select 6371 * 2 * asin(sqrt(power(sin(radians(lat - lag(lat) over w) / 2), 2) + cos(radians(lag(lat) over w)) * cos(radians(lat)) * power(sin(radians(lng - lag(lng) over w) / 2), 2))) km
          from posiciones_vehiculo where vehiculo_id = v.id and registrada_en >= ${d} window w as (order by registrada_en)) x) km_rastreador
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
  return { estados, flujo: flujo[0], cancelados, etapas, rutas, finanzas: finanzas[0], gastos, flotilla, nomina, pendientes, ...(await extra) };
}

/** Mostrador, inventario, canales y paradas del chofer. */
async function datosExtra(p: Periodo) {
  const d = desde(p);
  const [canales, mostrador, formas, cortes, inventario, recolecciones, traslados, prueba] = await Promise.all([
    sql<{ canal: string; pedidos: number; ventas: number }[]>`
      select case when canal = 'mostrador' then 'Mostrador' else 'En línea' end canal, count(*)::int pedidos, coalesce(sum(total), 0)::float ventas
      from pedidos where confirmado_en >= ${d} and estado <> 'cancelado' group by 1 order by 1`,
    sql<{ tickets: number; ventas: number; costo: number }[]>`
      select count(*)::int tickets, coalesce(sum(p.total), 0)::float ventas,
             coalesce(sum((select sum(pp.costo_unitario * pp.cantidad) from pedido_partidas pp where pp.pedido_id = p.id)), 0)::float costo
      from pedidos p where p.canal = 'mostrador' and p.creado_en >= ${d} and p.estado <> 'cancelado'`,
    sql<{ forma: string; total: number }[]>`
      select g.forma, sum(g.monto)::float total from pagos g join pedidos p on p.id = g.pedido_id
      where p.canal = 'mostrador' and g.pagado_en >= ${d} group by 1 order by 2 desc`,
    sql<{ id: string; fecha: string; quien: string; esperado: number; contado: number }[]>`
      select c.id, to_char(c.cerrada_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI') fecha, u.nombre quien,
             (c.fondo + coalesce((select sum(monto) from pagos where caja_id = c.id and forma = 'efectivo'), 0))::float esperado,
             c.efectivo_contado::float contado
      from cajas c join usuarios_internos u on u.id = c.abierta_por where c.cerrada_en >= ${d} order by c.cerrada_en desc limit 10`,
    sql<{ valor: number; bajo: number; negativos: number; ajustes: number; perdida: number }[]>`
      select
        coalesce((select sum(greatest(e.cantidad, 0) * coalesce(pr.costo_promedio, 0)) from existencias e join productos pr on pr.id = e.producto_id
                  join almacenes a on a.id = e.almacen_id where a.tipo <> 'proveedor'), 0)::float valor,
        (select count(*)::int from existencias where minimo is not null and cantidad < minimo) bajo,
        (select count(*)::int from existencias where cantidad < 0) negativos,
        (select count(*)::int from movimientos_inventario where tipo = 'ajuste_conteo' and creado_en >= ${d}) ajustes,
        coalesce((select sum(m.cantidad * coalesce(pr.costo_promedio, 0)) from movimientos_inventario m join productos pr on pr.id = m.producto_id
                  where m.tipo = 'ajuste_conteo' and m.almacen_origen is not null and m.creado_en >= ${d}), 0)::float perdida`,
    sql<{ lugar: string; visitas: number; espera_min: number | null }[]>`
      select a.nombre lugar, count(*)::int visitas,
             round((percentile_cont(0.5) within group (order by extract(epoch from pr.salida_en - pr.llegada_en) / 60))::numeric)::float espera_min
      from paradas_ruta pr join almacenes a on a.id = pr.almacen_id
      where pr.tipo = 'recoleccion' and pr.salida_en is not null and pr.llegada_en >= ${d}
      group by a.nombre order by visitas desc`,
    // Tramo al cliente: de la salida anterior (otra parada o inicio de ruta) a la llegada; km con el GPS del teléfono.
    sql<{ tramos: number; min_mediana: number | null; km_mediana: number | null; km_total: number | null }[]>`
      with lleg as (
        select pr.id, pr.ruta_id, pr.llegada_en,
               coalesce((select max(x.salida_en) from paradas_ruta x where x.ruta_id = pr.ruta_id and x.salida_en <= pr.llegada_en), r.iniciada_en) salida
        from paradas_ruta pr join rutas r on r.id = pr.ruta_id
        where pr.tipo = 'entrega' and pr.llegada_en >= ${d}
      ), km as (
        select l.id, l.llegada_en, l.salida, (select sum(k) from (
          select 6371 * 2 * asin(sqrt(power(sin(radians(lat - lag(lat) over w) / 2), 2) + cos(radians(lag(lat) over w)) * cos(radians(lat)) * power(sin(radians(lng - lag(lng) over w) / 2), 2))) k
          from posiciones_ruta where ruta_id = l.ruta_id and registrada_en between l.salida and l.llegada_en window w as (order by registrada_en)) z) km
        from lleg l where l.salida is not null
      )
      select count(*)::int tramos,
             round((percentile_cont(0.5) within group (order by extract(epoch from llegada_en - salida) / 60))::numeric)::float min_mediana,
             round((percentile_cont(0.5) within group (order by km))::numeric, 1)::float km_mediana,
             round(sum(km)::numeric, 1)::float km_total
      from km`,
    sql<{ n: number }[]>`select count(*)::int n from datos_prueba`,
  ]);
  return { canales, mostrador: mostrador[0], formas, cortes, inventario: inventario[0], recolecciones, traslados: traslados[0], hayPrueba: prueba[0].n > 0 };
}
