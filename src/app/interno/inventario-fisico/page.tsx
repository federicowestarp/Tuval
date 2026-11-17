import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { clasesBoton } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { crearInventario } from "./acciones";

export default function InventarioFisico() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="conteo" />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("mostrador");
  const [inventarios, almacenes] = await Promise.all([
    sql<{ id: string; nombre: string; almacen: string; estado: string; tarjetas: number; terminadas: number; creado: string }[]>`
      select i.id, i.nombre, a.nombre almacen, i.estado,
             (select count(*)::int from tarjetas_inventario t where t.inventario_id = i.id) tarjetas,
             (select count(*)::int from tarjetas_inventario t where t.inventario_id = i.id and t.final is not null) terminadas,
             to_char(i.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY') creado
      from inventarios_fisicos i join almacenes a on a.id = i.almacen_id order by i.creado_en desc limit 30`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from almacenes where activo and tipo in ('sucursal', 'cedis', 'obra') order by nombre`,
  ]);
  return (
    <>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Inventario físico</h1>
        <p className="text-[15px] text-secundario">Tarjetas con folio y QR · dos conteos ciegos por personas distintas · un tercero si no coinciden.</p>
      </div>
      {puede(yo.rol, "supervisor") && (
        <form action={crearInventario} className="grid gap-2 rounded-[20px] bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
          <select name="almacen_id" aria-label="Almacén" className="h-11 rounded-full border border-linea bg-white px-3">
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <input name="nombre" placeholder="Nombre (ej. Inventario anual 2026)" className="h-11 rounded-full border border-linea px-4" />
          <button className={clasesBoton("principal", "normal")}>Abrir inventario</button>
          <label className="flex items-center gap-2 text-[14px] text-secundario sm:col-span-3">
            <input type="checkbox" name="todos" className="h-4 w-4" /> Incluir todo el catálogo activo (no solo lo que el sistema dice que hay en ese almacén)
          </label>
          <p className="text-[13px] text-secundario sm:col-span-3">Al abrirlo se congela lo que dice el sistema. Mientras se cuenta, evita mover mercancía de ese almacén.</p>
        </form>
      )}
      <ul className="space-y-2">
        {inventarios.map((i) => (
          <li key={i.id}>
            <Link href={`/interno/inventario-fisico/${i.id}`} className="flex items-center justify-between gap-3 rounded-[20px] bg-white p-4">
              <span>
                <span className="block font-semibold">{i.nombre}</span>
                <span className="text-[14px] text-secundario">{i.almacen} · {i.creado} · {i.terminadas}/{i.tarjetas} tarjetas</span>
              </span>
              <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${i.estado === "abierto" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{i.estado === "abierto" ? "Contando" : "Cerrado"}</span>
            </Link>
          </li>
        ))}
        {inventarios.length === 0 && <li className="rounded-[20px] bg-white p-4 text-secundario">Aún no hay inventarios físicos.</li>}
      </ul>
    </>
  );
}
