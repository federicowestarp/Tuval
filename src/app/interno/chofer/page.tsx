import { sql } from "@/lib/db";
import { Suspense } from "react";
import { connection } from "next/server";
import { requerirInterno } from "@/lib/equipo";
import { paradasPendientes, rutaDeHoy } from "@/lib/ruta";
import { describirPromesa } from "@/lib/corte";
import { ligaMapa, ligaWhatsApp, lugar } from "@/lib/pedidos";
import { urlArchivo } from "@/lib/url-archivo";
import { clasesBoton } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { iniciarRuta, salirAEntregar, terminarRuta } from "./acciones";
import { Entregar } from "./Entregar";
import { Rastreo } from "./Rastreo";

export default function Chofer() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="chofer" />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno();
  const [ruta, paradas, vehiculos] = await Promise.all([
    rutaDeHoy(yo.id), paradasPendientes(),
    sql<{ id: string; nombre: string }[]>`select id, nombre from vehiculos where activo order by nombre`,
  ]);
  const activa = !!ruta?.iniciada_en && !ruta.terminada_en;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Ruta de hoy</h1>
          <p className="text-[14px] text-secundario">{paradas.length} entrega{paradas.length === 1 ? "" : "s"} pendiente{paradas.length === 1 ? "" : "s"}</p>
        </div>
        <form action={activa ? terminarRuta : iniciarRuta} className="flex items-center gap-2">
          {!activa && vehiculos.length > 0 && (
            <select name="vehiculo_id" aria-label="Vehículo" required className="h-11 rounded-full border border-linea bg-white px-3 text-[14px]">
              <option value="">Vehículo…</option>
              {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          )}
          <button className={clasesBoton(activa ? "secundario" : "principal", "normal")}>{activa ? "Terminar ruta" : "Iniciar ruta"}</button>
        </form>
      </div>
      {activa && <Rastreo />}

      {paradas.length === 0 && <p className="rounded-[20px] bg-white p-6 text-center text-secundario">No hay entregas pendientes.</p>}

      {paradas.map((p) => (
        <article key={p.id} className="space-y-3 rounded-[20px] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{p.folio} <span className="text-[13px] font-normal text-secundario">· {lugar(p)}</span></p>
              <p className="text-[13px] text-secundario">
                {p.entrega_fecha && p.entrega_ventana ? describirPromesa({ fecha: p.entrega_fecha, ventana: p.entrega_ventana }) : ""}
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
          ) : (
            <Entregar pedidoId={p.id} permiteSinRecepcion={p.sin_recepcion_solicitada} recibeNombre={p.recibe_nombre} />
          )}
        </article>
      ))}
    </>
  );
}
