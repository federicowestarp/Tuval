import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { sucursal } from "@/lib/inventario";
import { ubicacionesDe } from "@/lib/plano";
import { Plano } from "@/components/Plano";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../Navegacion";
import { asignarUbicacion, borrarUbicacion, crearUbicaciones } from "./acciones";

/** Plano de la tienda: alta de pasillos/anaqueles/niveles y qué producto vive en cada lugar. */
export default function PlanoTienda(props: PageProps<"/interno/plano">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="plano" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido searchParams={props.searchParams} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/plano">["searchParams"] }) {
  await connection();
  const yo = await requerirInterno("mostrador");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const s = await sucursal();
  const ubicaciones = await ubicacionesDe(s.id);
  const [sinUbicacion, porUbicacion, buscados] = await Promise.all([
    sql<{ n: number }[]>`select count(*)::int n from existencias e join productos p on p.id = e.producto_id where e.almacen_id = ${s.id} and e.cantidad > 0 and p.activo and e.ubicacion_id is null`,
    sql<{ ubicacion_id: string; productos: string[] }[]>`
      select e.ubicacion_id, array_agg(p.nombre order by p.nombre) productos from existencias e join productos p on p.id = e.producto_id
      where e.almacen_id = ${s.id} and e.ubicacion_id is not null group by e.ubicacion_id`,
    sql<{ id: string; sku: string; nombre: string; ubicacion_id: string | null; cantidad: number }[]>`
      select p.id, p.sku, p.nombre, e.ubicacion_id, coalesce(e.cantidad, 0)::float cantidad
      from productos p left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
      where p.activo and (${q} <> '' and (p.nombre ilike ${"%" + q + "%"} or p.sku ilike ${"%" + q + "%"})
                          or ${q} = '' and e.cantidad > 0 and e.ubicacion_id is null)
      order by p.nombre limit 25`,
  ]);
  const supervisa = puede(yo.rol, "supervisor");
  return (
    <>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Plano y ubicaciones</h1>
        <p className="text-[15px] text-secundario">Cada producto en su pasillo, anaquel y nivel (1 = abajo). Lo usan el surtido guiado, el chequeo de anaquel y el quiosco “¿Dónde está?”.</p>
      </div>
      <Plano ubicaciones={ubicaciones} />

      {supervisa && (
        <form action={crearUbicaciones} className="grid gap-2 rounded-[20px] bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <p className="font-semibold sm:col-span-4">Agregar pasillo</p>
          <input name="pasillo" required placeholder="Pasillo (ej. 1)" className="h-11 rounded-full border border-linea px-4" />
          <input name="anaqueles" required placeholder="Anaqueles (ej. A-D)" className="h-11 rounded-full border border-linea px-4" />
          <input name="niveles" type="number" min={1} max={12} defaultValue={4} aria-label="Niveles por anaquel" className="h-11 rounded-full border border-linea px-4" />
          <button className="h-11 rounded-full bg-azul px-5 font-semibold text-white">Agregar</button>
          <p className="text-[13px] text-secundario sm:col-span-4">Crea un código por nivel: P1-A-1 … P1-D-4. El nivel se cuenta desde abajo.</p>
        </form>
      )}

      <section className="space-y-3 rounded-[20px] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Asignar productos a su lugar</h2>
          {sinUbicacion[0].n > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-[13px] font-semibold text-amber-800">{sinUbicacion[0].n} con existencia sin ubicación</span>}
        </div>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar producto o SKU (vacío = los que no tienen lugar)" className="h-11 flex-1 rounded-full border border-linea px-4" /><button className="rounded-full border border-azul px-4 font-semibold text-azul">Buscar</button></form>
        {ubicaciones.length === 0 ? <p className="text-[14px] text-secundario">Primero agrega los pasillos.</p> : (
          <ul className="divide-y divide-linea">
            {buscados.map((p) => (
              <li key={p.id}>
                <form action={asignarUbicacion} className="flex flex-wrap items-center gap-2 py-2 text-[14px]">
                  <input type="hidden" name="producto_id" value={p.id} />
                  <span className="min-w-0 flex-1">{p.nombre} <span className="text-secundario">· {p.sku} · {p.cantidad} pzas</span></span>
                  <select name="ubicacion_id" defaultValue={p.ubicacion_id ?? ""} aria-label={`Ubicación de ${p.nombre}`} className="h-9 rounded-full border border-linea bg-white px-3">
                    <option value="">Sin ubicación</option>
                    {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.codigo}</option>)}
                  </select>
                  <button className="rounded-full bg-azul px-3 py-1.5 font-semibold text-white">Guardar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ubicaciones.length > 0 && (
        <section className="rounded-[20px] bg-white p-4">
          <h2 className="mb-2 font-semibold">Ubicaciones</h2>
          <ul className="grid gap-1 text-[13px] sm:grid-cols-2">
            {ubicaciones.map((u) => {
              const prods = porUbicacion.find((x) => x.ubicacion_id === u.id)?.productos ?? [];
              return (
                <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-niebla px-2 py-1">
                  <span className="min-w-0 truncate"><span className="font-mono font-semibold">{u.codigo}</span> {prods.length ? `· ${prods.join(", ")}` : <span className="text-secundario">· vacío</span>}</span>
                  {supervisa && prods.length === 0 && <form action={borrarUbicacion}><input type="hidden" name="id" value={u.id} /><button className="text-secundario" aria-label={`Borrar ${u.codigo}`}>✕</button></form>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
