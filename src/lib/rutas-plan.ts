import type postgres from "postgres";
import { sql } from "@/lib/db";
import { ligasGoogleMaps, planearRuta, type Punto } from "@/lib/planear-ruta";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql o transacción
type Tx = postgres.Sql<any> | postgres.TransactionSql<any>;

export type ParamOperacion = { hora_limite_manana: number; hora_limite_tarde: number; hora_salida: number; velocidad_kmh: number; factor_calle: number; minutos_parada: number; minutos_recoleccion: number; capacidad_moto_piezas?: number };

export async function parametrosOperacion(tx: Tx = sql): Promise<ParamOperacion> {
  const f = await tx<{ clave: string; valor: number }[]>`select clave, valor::float valor from parametros_operacion`;
  return Object.fromEntries(f.map((x) => [x.clave, x.valor])) as ParamOperacion;
}

/** Hora límite de entrega en SQL a partir de fecha + ventana (mañana/tarde) en hora de México. */
export const horaLimiteSql = (p: ParamOperacion) => sql`
  case when p.entrega_fecha is null then null
       else ((p.entrega_fecha + make_interval(hours => (case when p.entrega_ventana = 'tarde' then ${p.hora_limite_tarde} else ${p.hora_limite_manana} end)::int))
             at time zone 'America/Mexico_City') end`;

/** Recalcula el orden, horas estimadas y km de una ruta planeada y los guarda. */
export async function replanear(tx: Tx, rutaId: string) {
  const p = await parametrosOperacion(tx);
  const [r] = await tx<{ salida: Date | null; lat: number | null; lng: number | null; fecha: string }[]>`
    select r.salida_planeada salida, a.lat, a.lng, to_char(r.fecha, 'YYYY-MM-DD') fecha
    from rutas r left join almacenes a on a.id = r.origen_almacen_id where r.id = ${rutaId}`;
  if (!r) return;
  const paradas = await tx<{ entrega: string; lat: number | null; lng: number | null; limite: Date | null }[]>`
    select e.id entrega, p.lat, p.lng, ${horaLimiteSql(p)} limite
    from entregas e join pedidos p on p.id = e.pedido_id where e.ruta_id = ${rutaId} and e.estado in ('programada', 'en_ruta')`;
  // Salida: la planeada; si se va a recoger a bodega, se suma el tiempo de recolección.
  const salida = new Date((r.salida ?? new Date(`${r.fecha}T${String(p.hora_salida).padStart(2, "0")}:00:00-06:00`)).getTime() + p.minutos_recoleccion * 60_000);
  const origen: Punto | null = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null;
  const plan = planearRuta(origen, salida, paradas.map((x) => ({ id: x.entrega, punto: x.lat != null && x.lng != null ? { lat: x.lat, lng: x.lng } : null, limite: x.limite })),
    { velocidadKmh: p.velocidad_kmh, factorCalle: p.factor_calle, minutosParada: p.minutos_parada });
  for (const x of plan.paradas) {
    const lim = paradas.find((y) => y.entrega === x.id)?.limite ?? null;
    await tx`update entregas set orden_en_ruta = ${x.orden}, eta = ${x.eta}, km_tramo = ${x.kmTramo}, hora_limite = ${lim} where id = ${x.id}`;
  }
  await tx`update rutas set km_estimados = ${plan.km}, minutos_estimados = ${plan.minutos + p.minutos_recoleccion}, planeada_en = now() where id = ${rutaId}`;
}

/** Ligas de Google Maps de una ruta, en el orden planeado (desde la bodega de salida). */
export async function ligasDeRuta(rutaId: string) {
  const [r] = await sql<{ lat: number | null; lng: number | null }[]>`
    select a.lat, a.lng from rutas r left join almacenes a on a.id = r.origen_almacen_id where r.id = ${rutaId}`;
  const puntos = await sql<{ lat: number; lng: number }[]>`
    select p.lat, p.lng from entregas e join pedidos p on p.id = e.pedido_id
    where e.ruta_id = ${rutaId} and e.estado in ('programada', 'en_ruta') and p.lat is not null and p.lng is not null order by e.orden_en_ruta`;
  return ligasGoogleMaps(r?.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null, puntos);
}
