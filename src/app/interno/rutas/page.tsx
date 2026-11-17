import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { hoyMx } from "@/lib/ruta";
import { horaLimiteSql, ligasDeRuta, parametrosOperacion } from "@/lib/rutas-plan";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { armarRuta, guardarParametroRuta, guardarUbicacion, quitarDeRuta, reoptimizar } from "./acciones";

const hora = (d: Date | null) => (d ? new Date(d).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }) : "—");
/** Hora y, si no es el día de la ruta, también el día (p. ej. "mar 17, 02:00 p.m."). */
const horaDia = (d: Date | null, fecha: string) => {
  if (!d) return "—";
  const dia = new Date(new Date(d).getTime() - 6 * 3600_000).toISOString().slice(0, 10);
  return dia === fecha ? hora(d) : new Date(d).toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function Rutas(props: PageProps<"/interno/rutas">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="rutas" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido searchParams={props.searchParams} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/rutas">["searchParams"] }) {
  await connection();
  const yo = await requerirInterno("operador");
  const sp = await searchParams;
  const fecha = typeof sp.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyMx();
  const p = await parametrosOperacion();
  const [listos, choferes, vehiculos, almacenes, rutas, params] = await Promise.all([
    sql<{ id: string; folio: string; estado: string; municipio: string | null; direccion: string | null; ventana: string | null; entrega_fecha: string | null; limite: Date | null; con_pin: boolean; piezas: number; asignado: string | null }[]>`
      select p.id, p.folio, p.estado, coalesce(d.municipio, p.entidad) municipio, p.direccion_entrega direccion, p.entrega_ventana ventana,
             to_char(p.entrega_fecha, 'YYYY-MM-DD') entrega_fecha, ${horaLimiteSql(p)} limite, (p.lat is not null) con_pin,
             (select coalesce(sum(cantidad), 0)::float from pedido_partidas where pedido_id = p.id) piezas,
             (select u.nombre from entregas e join rutas r on r.id = e.ruta_id join usuarios_internos u on u.id = r.chofer_id
              where e.pedido_id = p.id and e.estado = 'programada' limit 1) asignado
      from pedidos p left join direcciones d on d.id = p.direccion_id
      where p.canal <> 'mostrador' and p.tipo_entrega <> 'recoger' and p.estado in ('comprado_proveedor', 'surtido')
        and not exists (select 1 from entregas e where e.pedido_id = p.id and e.estado = 'en_ruta')
      order by ${horaLimiteSql(p)} nulls last, p.creado_en`,
    sql<{ id: string; nombre: string; rol: string }[]>`select id, nombre, rol::text rol from usuarios_internos where activo order by (rol = 'chofer') desc, nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from vehiculos where activo order by nombre`,
    sql<{ id: string; nombre: string; lat: number | null; lng: number | null }[]>`
      select id, nombre, lat, lng from almacenes where activo and tipo in ('proveedor', 'sucursal', 'cedis') and nombre not ilike '%prueba%' order by tipo, nombre`,
    sql<{ id: string; chofer: string; vehiculo: string | null; origen: string | null; salida: Date | null; km: number | null; minutos: number | null }[]>`
      select r.id, u.nombre chofer, v.nombre vehiculo, a.nombre origen, r.salida_planeada salida, r.km_estimados::float km, r.minutos_estimados minutos
      from rutas r join usuarios_internos u on u.id = r.chofer_id left join vehiculos v on v.id = r.vehiculo_id left join almacenes a on a.id = r.origen_almacen_id
      where r.fecha = ${fecha} and exists (select 1 from entregas e where e.ruta_id = r.id) order by u.nombre`,
    sql<{ clave: string; valor: number; descripcion: string; supuesto: boolean }[]>`select clave, valor::float valor, descripcion, supuesto from parametros_operacion order by clave`,
  ]);
  const paradas = rutas.length ? await sql<{ ruta_id: string; entrega: string; orden: number | null; folio: string; estado: string; direccion: string | null; eta: Date | null; limite: Date | null; km: number | null; con_pin: boolean; pedido: string }[]>`
    select e.ruta_id, e.id entrega, e.orden_en_ruta orden, p.folio, p.estado, p.direccion_entrega direccion, e.eta, e.hora_limite limite, e.km_tramo::float km, (p.lat is not null) con_pin, p.id pedido
    from entregas e join pedidos p on p.id = e.pedido_id where e.ruta_id = any(${rutas.map((r) => r.id)}::uuid[]) and e.estado in ('programada', 'en_ruta')
    order by e.orden_en_ruta nulls last` : [];
  const ligas = Object.fromEntries(await Promise.all(rutas.map(async (r) => [r.id, await ligasDeRuta(r.id)] as const)));
  const sinUbicacion = almacenes.filter((a) => a.lat == null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Planear rutas</h1>
        <form className="flex items-center gap-2"><input type="date" name="fecha" defaultValue={fecha} className="h-10 rounded-full border border-linea bg-white px-3" /><button className="h-10 rounded-full bg-azul px-4 font-semibold text-white">Ver</button></form>
      </div>

      {sinUbicacion.length > 0 && (
        <section className="rounded-[20px] bg-amber-50 p-4 text-[14px] ring-1 ring-amber-200">
          <p className="font-semibold">Falta la ubicación de: {sinUbicacion.map((a) => a.nombre).join(", ")}</p>
          <p className="text-secundario">Sin ella la ruta no puede calcular el primer tramo desde la bodega. Pega la liga de Google Maps o “latitud, longitud”.</p>
          {sinUbicacion.map((a) => (
            <form key={a.id} action={guardarUbicacion} className="mt-2 flex gap-2">
              <input type="hidden" name="almacen" value={a.id} />
              <input name="ubicacion" placeholder={`Ubicación de ${a.nombre}`} className="h-10 flex-1 rounded-full border border-linea bg-white px-4" />
              <button className="rounded-full bg-azul px-4 font-semibold text-white">Guardar</button>
            </form>
          ))}
        </section>
      )}

      <form action={armarRuta} className="space-y-3 rounded-[20px] bg-white p-5">
        <h2 className="font-semibold">1 · Pedidos listos para recoger y entregar</h2>
        {listos.length === 0 ? <p className="text-[14px] text-secundario">No hay pedidos comprados o surtidos pendientes de ruta.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {listos.map((x) => (
              <li key={x.id}>
                <label className="flex cursor-pointer items-start gap-3 py-2.5">
                  <input type="checkbox" name="pedido_id" value={x.id} defaultChecked={!x.asignado && (!x.entrega_fecha || x.entrega_fecha <= fecha)} className="mt-1 h-5 w-5" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{x.folio}</span> · {x.estado === "surtido" ? "ya surtido" : "por recoger con proveedor"} · {x.municipio ?? "—"} · {x.piezas} pzas
                    <span className="block truncate text-secundario">{x.direccion ?? "sin dirección"}</span>
                    <span className="text-[12px] text-secundario">
                      {x.entrega_fecha ? `Entrega ${x.entrega_fecha} ${x.ventana === "tarde" ? "tarde" : "mañana"} · límite ${hora(x.limite)}` : "Sin fecha prometida"}
                      {!x.con_pin && <span className="font-semibold text-red-700"> · sin ubicación en mapa</span>}
                      {x.asignado && <span className="font-semibold text-azul"> · ya asignado a {x.asignado}</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <h2 className="pt-2 font-semibold">2 · Chofer, vehículo y salida</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <div><label className={etiqueta} htmlFor="chofer_id">Chofer</label><select id="chofer_id" name="chofer_id" required className={campo}>{choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.rol !== "chofer" ? ` (${c.rol})` : ""}</option>)}</select></div>
          <div><label className={etiqueta} htmlFor="vehiculo_id">Vehículo</label><select id="vehiculo_id" name="vehiculo_id" className={campo}><option value="">—</option>{vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select></div>
          <div><label className={etiqueta} htmlFor="origen_id">Sale de / recoge en</label><select id="origen_id" name="origen_id" className={campo}>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.lat == null ? " (sin ubicación)" : ""}</option>)}</select></div>
          <div><label className={etiqueta} htmlFor="hora_salida">Hora de salida</label><input id="hora_salida" name="hora_salida" type="time" defaultValue={`${String(p.hora_salida).padStart(2, "0")}:00`} className={campo} /></div>
        </div>
        <input type="hidden" name="fecha" value={fecha} />
        <button disabled={listos.length === 0} className={clasesBoton("principal", "grande", true)}>Asignar y armar ruta</button>
        <p className="text-[12px] text-secundario">Orden: primero la hora límite de cada entrega y, dentro de eso, la cercanía. Tiempos estimados con distancia × {p.factor_calle} y {p.velocidad_kmh} km/h, {p.minutos_parada} min por entrega y {p.minutos_recoleccion} min de recolección.</p>
      </form>

      {rutas.map((r) => {
        const st = paradas.filter((x) => x.ruta_id === r.id);
        const tarde = st.filter((x) => x.eta && x.limite && new Date(x.eta) > new Date(x.limite)).length;
        return (
          <section key={r.id} id={`ruta-${r.id}`} className="space-y-3 rounded-[20px] bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Ruta de {r.chofer} · {r.vehiculo ?? "sin vehículo"} · sale {hora(r.salida)} de {r.origen ?? "—"}</h2>
              <p className="text-[14px] text-secundario">{st.length} entregas · ~{r.km ?? 0} km · ~{Math.round((r.minutos ?? 0) / 60 * 10) / 10} h{tarde > 0 && <strong className="text-red-700"> · {tarde} llegaría(n) tarde</strong>}</p>
            </div>
            <ol className="divide-y divide-linea text-[14px]">
              {st.map((x) => {
                const late = x.eta && x.limite && new Date(x.eta) > new Date(x.limite);
                return (
                  <li key={x.entrega} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-azul text-[12px] font-semibold text-white">{x.orden}</span>
                      <Link href={`/interno/pedidos/${x.pedido}`} className="font-semibold text-azul">{x.folio}</Link> · {x.direccion ?? "sin dirección"}
                      {!x.con_pin && <span className="font-semibold text-red-700"> · sin ubicación</span>}</span>
                    <span className="flex items-center gap-3 tabular-nums">
                      <span className={late ? "font-semibold text-red-700" : ""}>llega ~{hora(x.eta)} / límite {horaDia(x.limite, fecha)}</span>
                      {x.km != null && <span className="text-secundario">{x.km} km</span>}
                      {x.estado !== "en_ruta" && <form action={quitarDeRuta}><input type="hidden" name="entrega" value={x.entrega} /><button className="text-[13px] text-secundario hover:text-red-700">Quitar</button></form>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2">
              {ligas[r.id].map((l, i) => <a key={l} href={l} target="_blank" className={clasesBoton("principal", "chico")}>Abrir en Google Maps{ligas[r.id].length > 1 ? ` · tramo ${i + 1}` : ""}</a>)}
              <Link href={`/interno/rutas/${r.id}/orden`} target="_blank" className={clasesBoton("secundario", "chico")}>Orden de recolección</Link>
              <form action={reoptimizar}><input type="hidden" name="ruta" value={r.id} /><button className={clasesBoton("secundario", "chico")}>Reoptimizar</button></form>
            </div>
          </section>
        );
      })}

      {puede(yo.rol, "admin") && (
        <details className="rounded-[20px] bg-white p-5 text-[14px]">
          <summary className="cursor-pointer font-semibold">Supuestos de tiempo {params.some((x) => x.supuesto) && <span className="text-amber-800">(hay valores iniciales por confirmar)</span>}</summary>
          <ul className="mt-2 divide-y divide-linea">
            {params.map((x) => (
              <li key={x.clave} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{x.descripcion}{x.supuesto && <span className="ml-2 rounded-full bg-amber-100 px-2 text-[12px] text-amber-900">supuesto</span>}</span>
                <form action={guardarParametroRuta} className="flex gap-1"><input type="hidden" name="clave" value={x.clave} /><input name="valor" defaultValue={x.valor} inputMode="decimal" className="h-9 w-24 rounded-lg border border-linea px-2 text-right" /><button className="text-azul">Guardar</button></form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
