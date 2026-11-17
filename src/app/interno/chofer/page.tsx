import { Esqueleto } from "@/components/interno/Esqueleto";
import { sql } from "@/lib/db";
import { Suspense } from "react";
import { connection } from "next/server";
import { requerirInterno } from "@/lib/equipo";
import { hoyMx, paradasPendientes, rutaDeHoy } from "@/lib/ruta";
import { ligasDeRuta } from "@/lib/rutas-plan";
import { describirPromesa } from "@/lib/corte";
import { ligaMapa, ligaWhatsApp, lugar } from "@/lib/pedidos";
import { urlArchivo } from "@/lib/url-archivo";
import { clasesBoton } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { iniciarRuta, llegarARecoger, llegueConCliente, salirAEntregar, salirDeRecoger, terminarRuta } from "./acciones";
import { ConUbicacion } from "./ConUbicacion";
import { FormCombustible } from "./FormCombustible";
import { Entregar } from "./Entregar";
import { FacturaProveedor } from "./FacturaProveedor";
import { Rastreo } from "./Rastreo";

export default function Chofer() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="chofer" />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno();
  const [ruta, paradas, vehiculos, bodegas, porRecoger] = await Promise.all([
    rutaDeHoy(yo.id), paradasPendientes(yo.id),
    sql<{ id: string; nombre: string }[]>`select id, nombre from vehiculos where activo order by nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from almacenes where activo and tipo in ('proveedor', 'sucursal', 'cedis') and nombre not ilike '%prueba%' order by (tipo = 'proveedor') desc, nombre`,
    sql<{ id: string; folio: string; piezas: number; lugar: string | null; oc: string | null }[]>`
      select p.id, p.folio, (select coalesce(sum(cantidad), 0)::float from pedido_partidas where pedido_id = p.id) piezas, p.entidad lugar,
        (select folio from ordenes_compra o where o.pedido_id = p.id and o.estado <> 'cancelada' order by o.creado_en desc limit 1) oc
      from pedidos p where p.estado = 'comprado_proveedor'
        -- Con ruta planeada, solo lo asignado a este chofer.
        and (not exists (select 1 from rutas r join entregas e on e.ruta_id = r.id where r.chofer_id = ${yo.id} and r.fecha = ${hoyMx()})
             or exists (select 1 from rutas r join entregas e on e.ruta_id = r.id where r.chofer_id = ${yo.id} and r.fecha = ${hoyMx()} and e.pedido_id = p.id))
      order by p.creado_en`,
  ]);
  const activa = !!ruta?.iniciada_en && !ruta.terminada_en;
  const ligas = ruta ? await ligasDeRuta(ruta.id) : [];
  const [abierta] = ruta ? await sql<{ id: string; almacen: string; desde: string }[]>`
    select pr.id, a.nombre almacen, to_char(pr.llegada_en at time zone 'America/Mexico_City', 'HH24:MI') desde
    from paradas_ruta pr join almacenes a on a.id = pr.almacen_id
    where pr.ruta_id = ${ruta.id} and pr.tipo = 'recoleccion' and pr.salida_en is null limit 1` : [];

  return (
    <>
      <div className="space-y-3 rounded-[20px] bg-white p-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Ruta de hoy</h1>
          <p className="text-[14px] text-secundario">{paradas.length} entrega{paradas.length === 1 ? "" : "s"} pendiente{paradas.length === 1 ? "" : "s"} · {porRecoger.length} por recoger</p>
        </div>
        {activa ? (
          <form action={terminarRuta} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input name="odometro" inputMode="numeric" placeholder="Odómetro al terminar (km)" className="h-11 w-full min-w-0 rounded-full border border-linea px-4 text-[15px]" />
            <button className={`${clasesBoton("secundario", "normal")} whitespace-nowrap`}>Terminar ruta</button>
            <label className="col-span-2 text-[13px] text-secundario">Foto del odómetro (opcional) <input name="foto_odometro" type="file" accept="image/*" capture="environment" className="mt-1 block text-sm" /></label>
          </form>
        ) : (
          <form action={iniciarRuta} className="grid gap-2 sm:grid-cols-2">
            {vehiculos.length > 0 && (
              <select name="vehiculo_id" aria-label="Vehículo" required className="h-11 rounded-full border border-linea bg-white px-3 text-[15px]">
                <option value="">Vehículo…</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            )}
            <input name="odometro" inputMode="numeric" placeholder="Odómetro al salir (km)" required={vehiculos.length > 0} className="h-11 rounded-full border border-linea px-4 text-[15px]" />
            <label className="text-[13px] text-secundario sm:col-span-2">Foto del odómetro (opcional) <input name="foto_odometro" type="file" accept="image/*" capture="environment" className="mt-1 block text-sm" /></label>
            <button className={`${clasesBoton("principal", "normal")} sm:col-span-2`}>Iniciar ruta</button>
          </form>
        )}
        {activa && <Rastreo />}
        {ligas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ligas.map((l, i) => <a key={l} href={l} target="_blank" className={clasesBoton("principal", "chico")}>Abrir ruta en Google Maps{ligas.length > 1 ? ` · tramo ${i + 1}` : ""}</a>)}
            {ruta && <a href={`/interno/rutas/${ruta.id}/orden`} target="_blank" className={clasesBoton("secundario", "chico")}>Orden de recolección</a>}
          </div>
        )}
      </div>

      {(porRecoger.length > 0 || abierta) && (
        <section className="space-y-3 rounded-[20px] bg-white p-4">
          <h2 className="font-semibold">Recoger con proveedor</h2>
          {abierta && porRecoger.some((p) => p.oc) && (
            <div className="space-y-1.5">
              <p className="text-[14px]">Sube la factura de cada pedido (XML de preferencia) para que el sistema la revise contra la orden:</p>
              {porRecoger.filter((p) => p.oc).map((p) => <FacturaProveedor key={p.id} pedidoId={p.id} folio={`${p.folio} · ${p.oc}`} />)}
            </div>
          )}
          {abierta ? (
            <form action={salirDeRecoger} className="space-y-2">
              <input type="hidden" name="parada_id" value={abierta.id} />
              <p className="text-[14px]">En <strong>{abierta.almacen}</strong> desde las {abierta.desde}. Marca lo que te entregaron:</p>
              {porRecoger.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-xl bg-niebla px-3 py-2 text-[15px]">
                  <input type="checkbox" name="pedido_id" value={p.id} defaultChecked className="h-5 w-5" />
                  {p.folio} · {p.piezas} pzas{p.lugar && ` · ${p.lugar}`}
                </label>
              ))}
              <button className={clasesBoton("principal", "grande", true)}>Recogí, ya salgo</button>
            </form>
          ) : (
            <form action={llegarARecoger} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select name="almacen_id" aria-label="Dónde recoges" className="h-11 w-full min-w-0 rounded-full border border-linea bg-white px-3 text-[15px]">
                {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
              <ConUbicacion className={clasesBoton("principal", "normal")}>Llegué</ConUbicacion>
              <p className="col-span-2 text-[13px] text-secundario">{porRecoger.map((p) => p.folio).join(", ")}</p>
            </form>
          )}
        </section>
      )}

      {activa && <FormCombustible />}

      {paradas.length === 0 && <p className="rounded-[20px] bg-white p-6 text-center text-secundario">No hay entregas pendientes.</p>}

      {paradas.map((p) => (
        <article key={p.id} className="space-y-3 rounded-[20px] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{p.folio} <span className="text-[13px] font-normal text-secundario">· {lugar(p)}</span></p>
              <p className="text-[13px] text-secundario">
                {p.entrega_fecha && p.entrega_ventana ? describirPromesa({ fecha: p.entrega_fecha, ventana: p.entrega_ventana }) : ""}{p.eta && ` · llegada estimada ${new Date(p.eta).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${p.estado === "en_ruta" ? "bg-cian text-sobrecian" : "bg-niebla text-tinta"}`}>
              {p.estado === "en_ruta" ? "En ruta" : "Listo para salir"}
            </span>
          </div>

          <div className="flex gap-3">
            {p.foto_fachada_id && (
              // eslint-disable-next-line @next/next/no-img-element -- archivo propio
              <img src={urlArchivo(p.foto_fachada_id)} alt="Entrada" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            )}
            <div className="text-[15px]">
              <p>{p.direccion_entrega}</p>
              <p className="text-secundario">Recibe {p.recibe_nombre} · {p.recibe_telefono}</p>
              {p.sin_recepcion_solicitada && <p className="text-[13px] font-semibold">Se puede dejar sin recepción (con foto)</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.lat != null && p.lng != null && (
              <a href={ligaMapa(p.lat, p.lng)} target="_blank" className={clasesBoton("secundario", "chico")}>Cómo llegar</a>
            )}
            {p.recibe_telefono && (
              p.preferencia_contacto === "telefono"
                ? <a href={`tel:${p.recibe_telefono}`} className={clasesBoton("secundario", "chico")}>Llamar</a>
                : <a href={ligaWhatsApp(p.recibe_telefono, `Hola ${p.recibe_nombre ?? ""}, soy el chofer de Tuval con tu pedido ${p.folio}. Voy en camino.`)} target="_blank" className={clasesBoton("secundario", "chico")}>WhatsApp</a>
            )}
          </div>

          <ul className="divide-y divide-linea text-[14px]">
            {p.partidas.map((x, i) => <li key={i} className="py-1.5"><span className="font-semibold">{x.cantidad}</span> × {x.nombre}</li>)}
          </ul>

          {p.estado === "surtido" ? (
            <form action={salirAEntregar}>
              <input type="hidden" name="pedido_id" value={p.id} />
              <button className={clasesBoton("principal", "grande", true)}>Salir a entregar</button>
            </form>
          ) : !p.llegado ? (
            <form action={llegueConCliente}>
              <input type="hidden" name="pedido_id" value={p.id} />
              <ConUbicacion className={clasesBoton("principal", "grande", true)}>Llegué con el cliente</ConUbicacion>
            </form>
          ) : (
            <Entregar pedidoId={p.id} permiteSinRecepcion={p.sin_recepcion_solicitada} recibeNombre={p.recibe_nombre} partidas={p.partidas} />
          )}
        </article>
      ))}
    </>
  );
}
