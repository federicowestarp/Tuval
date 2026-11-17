import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../Navegacion";
import { FormCatalogo } from "./FormCatalogo";
import { FotoProducto } from "./FotoProducto";
import { desactivarOrigen } from "./acciones";

export default function Catalogo(props: PageProps<"/interno/catalogo">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="catalogo" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Catálogo</h1>
        <Suspense fallback={<Esqueleto />}>
          <Contenido searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/catalogo">["searchParams"] }) {
  await connection();
  await requerirInterno("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sinFoto = sp.foto !== "todas";
  const palabras = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const [productosFoto, conteoFotos] = await Promise.all([
    sql<{ id: string; sku: string; nombre: string; imagen_url: string | null }[]>`
      select p.id, p.sku, p.nombre, p.imagen_url from productos p
      where p.activo ${sinFoto ? sql`and p.imagen_url is null` : sql``}
        ${palabras.map((w) => sql`and (lower(p.nombre) like ${"%" + w + "%"} or lower(p.sku) like ${"%" + w + "%"})`).reduce((a, b) => sql`${a} ${b}`, sql``)}
      order by p.nombre limit 60`,
    sql<{ con: number; total: number }[]>`select count(imagen_url)::int con, count(*)::int total from productos where activo`,
  ]);
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
      <section className="space-y-3 rounded-[20px] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Fotos de productos</h2>
          <p className="text-[13px] text-secundario">{conteoFotos[0].con} de {conteoFotos[0].total} con foto</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar producto…" className="h-10 flex-1 rounded-full border border-linea px-4" />
          <select name="foto" defaultValue={sinFoto ? "sin" : "todas"} className="h-10 rounded-full border border-linea px-3"><option value="sin">Sin foto</option><option value="todas">Todos</option></select>
          <button className="h-10 rounded-full bg-azul px-4 font-semibold text-white">Ver</button>
        </form>
        <p className="text-[13px] text-secundario">Toca un cuadro para tomar o elegir la foto. Se reduce sola antes de subir; mejor con fondo claro y el producto centrado.</p>
        {productosFoto.length === 0 ? <p className="text-[14px] text-secundario">{sinFoto ? "Todos los productos de esta búsqueda ya tienen foto." : "Sin resultados."}</p> : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {productosFoto.map((p) => <FotoProducto key={p.id} id={p.id} nombre={p.nombre} sku={p.sku} url={p.imagen_url} />)}
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
