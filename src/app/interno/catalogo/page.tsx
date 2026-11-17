import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../Navegacion";
import { FormCatalogo } from "./FormCatalogo";
import { desactivarOrigen } from "./acciones";

export default function Catalogo() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="catalogo" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Catálogo</h1>
        <Suspense fallback={<Esqueleto />}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("admin");
  const origenes = await sql<{ origen: string | null; activos: number; total: number; con_precio: number }[]>`
    select p.origen, count(*) filter (where p.activo)::int activos, count(*)::int total,
           count(pr.precio) filter (where p.activo)::int con_precio
    from productos p
    left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    group by p.origen order by total desc`;
  return (
    <>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-2 font-semibold">En la tienda</h2>
        {origenes.length === 0 ? <p className="text-sm text-secundario">Sin productos todavía.</p> : (
          <ul className="divide-y divide-linea">
            {origenes.map((o) => (
              <li key={o.origen ?? "-"} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                <span><span className="font-semibold">{o.origen ?? "sin origen"}</span> · {o.activos} activos de {o.total} · {o.con_precio} con precio</span>
                {o.origen && o.activos > 0 && (
                  <form action={desactivarOrigen}>
                    <input type="hidden" name="origen" value={o.origen} />
                    <button className="text-[14px] text-secundario hover:text-azul">Quitar de la tienda</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-3 font-semibold">Importar desde CSV</h2>
        <FormCatalogo />
      </section>
    </>
  );
}
