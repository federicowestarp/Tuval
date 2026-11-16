import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/marco/Marco";
import { Buscador } from "@/components/tienda/Buscador";
import { TarjetaProducto } from "@/components/tienda/TarjetaProducto";
import { BotonBuscarlo } from "@/components/carrito/BotonBuscarlo";
import { IconoCategoria } from "@/components/IconoCategoria";
import { CATEGORIAS, esCategoria } from "@/lib/categorias";
import { buscarProductos } from "@/lib/catalogo";

type SP = PageProps<"/tienda">["searchParams"];

export const metadata = { title: "Tienda", description: "Tubería, conexiones, válvulas, equipos y material eléctrico. Busca por producto o medida." };

export default function Tienda(props: PageProps<"/tienda">) {
  return (
    <Marco>
      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h1 className="font-display text-[34px] font-semibold sm:text-5xl">Tienda</h1>
        <div className="sticky top-14 z-30 -mx-4 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <Suspense fallback={<div className="h-12 rounded-full bg-niebla" />}>
            <BuscadorConParametros searchParams={props.searchParams} />
          </Suspense>
        </div>
        <Suspense fallback={<Esqueleto />}>
          <Resultados searchParams={props.searchParams} />
        </Suspense>
      </main>
    </Marco>
  );
}

async function leer(searchParams: SP) {
  const sp = await searchParams;
  return { q: typeof sp.q === "string" ? sp.q : "", cat: esCategoria(sp.cat) ? sp.cat : undefined };
}

async function BuscadorConParametros({ searchParams }: { searchParams: SP }) {
  const { q } = await leer(searchParams);
  return <Buscador inicial={q} />;
}

function Esqueleto() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-[20px] bg-niebla" />)}
    </div>
  );
}

async function Resultados({ searchParams }: { searchParams: SP }) {
  const { q, cat } = await leer(searchParams);
  const productos = await buscarProductos(q, cat);
  const liga = (c?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("cat", c);
    return p.size ? `/tienda?${p}` : "/tienda";
  };

  return (
    <>
      <nav className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" aria-label="Categorías">
        <Link href={liga()} className={`flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-medium transition ${!cat ? "bg-azul text-white" : "bg-niebla text-azul"}`}>
          Todo
        </Link>
        {CATEGORIAS.map((c) => (
          <Link
            key={c.id}
            href={liga(cat === c.id ? undefined : c.id)}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full pl-3 pr-4 text-[14px] font-medium transition ${cat === c.id ? "bg-azul text-white" : "bg-niebla text-azul"}`}
          >
            <IconoCategoria categoria={c.id} className="h-5 w-5" />
            {c.nombre}
          </Link>
        ))}
      </nav>

      {productos.length > 0 ? (
        <>
          <p className="mt-4 text-[13px] text-secundario">{productos.length} producto{productos.length === 1 ? "" : "s"}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {productos.map((p) => (
              <TarjetaProducto key={p.id} id={p.id} sku={p.sku} nombre={p.nombre} unidad={p.unidad} categoria={p.categoria_id} atributos={p.atributos} precio={p.precio} />
            ))}
          </div>
          <div className="my-12 rounded-[20px] bg-niebla p-6 text-center">
            <p className="font-semibold">¿No encuentras algo?</p>
            <p className="mt-1 text-[15px] text-secundario">Pídelo igual. Lo conseguimos con nuestros proveedores.</p>
            <Link href="/lista" className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-5 text-[15px] font-semibold text-azul ring-1 ring-linea">Pedir con lista o foto</Link>
          </div>
        </>
      ) : (
        <div className="my-12 rounded-[20px] bg-niebla p-8 text-center">
          <p className="font-display text-2xl font-semibold">No lo tenemos en catálogo… todavía.</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-secundario">Pídelo y lo buscamos con nuestros proveedores. Te confirmamos precio y entrega.</p>
          {q && <BotonBuscarlo texto={q} />}
        </div>
      )}
    </>
  );
}
