import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { pesos } from "@/components/interno/Indicadores";
import { campo } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { crearLista, guardarMargenes, precioFijo, recalcularTodo } from "./acciones";

export default function Precios(props: PageProps<"/interno/precios">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="precios" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Listas de precios</h1>
        <p className="text-[14px] text-secundario">Precio sin IVA = costo ÷ (1 − margen). El margen es sobre la venta (25% → de cada $100 vendidos, $25 son utilidad). Costo: costo promedio del inventario o, si no hay, el menor costo de proveedor. Se recalcula solo cuando cambia un costo; los precios fijos no se tocan.</p>
        <Suspense fallback={<Esqueleto />}><Contenido searchParams={props.searchParams} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/precios">["searchParams"] }) {
  await connection();
  await requerirInterno("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [listas, categorias, margenes, sinCosto, productos] = await Promise.all([
    sql<{ id: string; nombre: string; descripcion: string | null; margen_base: number | null; con_precio: number; clientes: number }[]>`
      select l.id, l.nombre, l.descripcion, l.margen_base::float margen_base,
             (select count(*)::int from precios p where p.lista_id = l.id) con_precio,
             (select count(*)::int from clientes c where c.lista_precio_id = l.id) clientes
      from listas_precio l where l.activa order by (l.nombre = 'Público') desc, l.nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from categorias order by orden, nombre`,
    sql<{ lista_id: string; categoria_id: string; margen: number }[]>`select lista_id, categoria_id, margen::float margen from margenes_lista`,
    sql<{ n: number }[]>`select count(*)::int n from productos p where p.activo and p.costo_promedio is null and not exists (select 1 from productos_proveedor pp where pp.producto_id = p.id and pp.costo > 0)`,
    q.length >= 2 ? sql<{ id: string; nombre: string; sku: string; costo: number | null; precios: { lista: string; precio: number; fijo: boolean }[] }[]>`
      select p.id, p.nombre, p.sku, coalesce(p.costo_promedio, (select min(costo) from productos_proveedor pp where pp.producto_id = p.id and pp.costo > 0))::float costo,
             coalesce((select json_agg(json_build_object('lista', pr.lista_id, 'precio', pr.precio, 'fijo', pr.fijo)) from precios pr where pr.producto_id = p.id), '[]') precios
      from productos p where p.activo and unaccent(lower(p.nombre || ' ' || p.sku)) like unaccent(lower(${"%" + q + "%"})) order by p.nombre limit 20` : Promise.resolve([]),
  ]);
  const m = (l: string, c: string) => margenes.find((x) => x.lista_id === l && x.categoria_id === c)?.margen;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <form action={recalcularTodo}><button className="rounded-full bg-azul px-4 py-2 font-semibold text-white">Recalcular todos los precios</button></form>
        {sinCosto[0].n > 0 && <p className="text-[14px] text-amber-800">{sinCosto[0].n} productos sin costo: no se les puede calcular precio hasta tener cotización o entrada de mercancía.</p>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {listas.map((l) => (
          <form key={l.id} action={guardarMargenes} className="space-y-2 rounded-[20px] bg-white p-5">
            <input type="hidden" name="lista" value={l.id} />
            <h2 className="font-semibold">{l.nombre}</h2>
            <p className="text-[12px] text-secundario">{l.descripcion ?? ""} {l.con_precio} productos con precio · {l.clientes} clientes</p>
            <label className="flex items-center justify-between gap-2 text-[14px] font-semibold">Margen base <input name="margen_base" defaultValue={l.margen_base != null ? Math.round(l.margen_base * 1000) / 10 : ""} placeholder="%" className="h-9 w-20 rounded-lg border border-linea px-2 text-right" /></label>
            <ul className="divide-y divide-linea text-[14px]">
              {categorias.map((c) => {
                const v = m(l.id, c.id);
                return <li key={c.id} className="flex items-center justify-between gap-2 py-1">{c.nombre}<input name={`cat_${c.id}`} defaultValue={v != null ? Math.round(v * 1000) / 10 : ""} placeholder={l.margen_base != null ? `${Math.round(l.margen_base * 1000) / 10}` : "%"} className="h-8 w-20 rounded-lg border border-linea px-2 text-right" /></li>;
              })}
            </ul>
            <button className="w-full rounded-full border border-azul px-4 py-2 font-semibold text-azul">Guardar y recalcular</button>
          </form>
        ))}
      </div>
      <details className="rounded-[20px] bg-white p-5">
        <summary className="cursor-pointer font-semibold">+ Nueva lista</summary>
        <form action={crearLista} className="mt-2 flex flex-wrap gap-2"><input name="nombre" placeholder="Nombre" className={campo} /><input name="descripcion" placeholder="Para quién es" className={campo} /><button className="rounded-full bg-azul px-4 font-semibold text-white">Crear</button></form>
      </details>
      <section className="space-y-3 rounded-[20px] bg-white p-5">
        <h2 className="font-semibold">Precio fijo por producto</h2>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar producto" className="h-10 flex-1 rounded-full border border-linea px-4" /><button className="h-10 rounded-full bg-azul px-4 font-semibold text-white">Buscar</button></form>
        {productos.map((p) => (
          <div key={p.id} className="rounded-xl bg-niebla p-3 text-[14px]">
            <p className="font-semibold">{p.nombre} <span className="font-normal text-secundario">· {p.sku} · costo {p.costo != null ? pesos(p.costo) : "sin costo"}</span></p>
            <div className="mt-1 flex flex-wrap gap-2">
              {listas.map((l) => {
                const pr = p.precios.find((x) => x.lista === l.id);
                const margen = pr && p.costo ? Math.round((1 - p.costo / pr.precio) * 1000) / 10 : null;
                return (
                  <form key={l.id} action={precioFijo} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1">
                    <input type="hidden" name="lista" value={l.id} /><input type="hidden" name="producto" value={p.id} />
                    <span className="text-[12px]">{l.nombre}: {pr ? `${pesos(pr.precio * 1.16)} c/IVA${margen != null ? ` · ${margen}%` : ""}${pr.fijo ? " · fijo" : ""}` : "—"}</span>
                    <input name="precio_con_iva" placeholder="fijo c/IVA" className="h-7 w-24 rounded border border-linea px-1 text-right" />
                    <button className="text-[12px] text-azul">OK</button>
                  </form>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
