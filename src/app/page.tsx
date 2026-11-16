import { Suspense } from "react";
import Link from "next/link";
import { Encabezado } from "@/components/Encabezado";
import { Sello } from "@/components/Sello";
import { IconoCategoria } from "@/components/IconoCategoria";
import { BotonAgregar } from "@/components/carrito/BotonAgregar";
import { CATEGORIAS, esCategoria } from "@/lib/categorias";
import { buscarProductos, formatoMoneda } from "@/lib/catalogo";

export default function Inicio(props: PageProps<"/">) {
  return (
    <>
      <header className="bg-azul">
        <Encabezado />
        <Suspense fallback={<div className="h-48" />}>
          <Buscador searchParams={props.searchParams} />
        </Suspense>
      </header>
      <main className="flex-1 bg-niebla">
        <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-6 text-sm text-acero">Cargando catálogo…</p>}>
          <Catalogo searchParams={props.searchParams} />
        </Suspense>
      </main>
      <footer className="bg-profundo py-6 text-center text-xs text-white">
        Tubería, equipos y eléctrico. Todo, a tiempo. · Entregas en Puebla, Atlixco y Tlaxcala
      </footer>
    </>
  );
}

type SP = PageProps<"/">["searchParams"];

async function leer(searchParams: SP) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = esCategoria(sp.cat) ? sp.cat : undefined;
  return { q, cat };
}

async function Buscador({ searchParams }: { searchParams: SP }) {
  const { q, cat } = await leer(searchParams);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-6">
      <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">¿Qué necesitas para tu obra?</h1>
      <form className="mt-6 flex max-w-2xl gap-2" action="/">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input
          name="q"
          defaultValue={q}
          placeholder='Busca por producto, medida o SKU… (ej. cople 1/2")'
          className="w-full rounded-lg bg-white px-4 py-3 text-base text-profundo outline-none ring-cian focus:ring-4"
        />
        <button className="rounded-lg bg-cian px-5 py-3 font-semibold text-profundo">Buscar</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-cian px-3 py-1 text-xs font-semibold text-profundo">Puebla · Atlixco · Tlaxcala</span>
        <span className="rounded-full border border-white px-3 py-1 text-xs font-semibold text-white">Factura o nota</span>
      </div>
    </section>
  );
}

async function Catalogo({ searchParams }: { searchParams: SP }) {
  const { q, cat } = await leer(searchParams);
  const productos = await buscarProductos(q, cat);
  const enlace = (c?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("cat", c);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <section className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 py-6 sm:grid-cols-6">
        {CATEGORIAS.map((c) => (
          <Link
            key={c.id}
            href={enlace(cat === c.id ? undefined : c.id)}
            className={`flex flex-col items-start gap-3 rounded-xl p-4 text-azul transition ${cat === c.id ? "bg-cianclaro ring-2 ring-cian" : "bg-white hover:ring-2 hover:ring-cian"}`}
          >
            <IconoCategoria categoria={c.id} />
            <span className="text-sm font-semibold">{c.nombre}</span>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <p className="mb-3 text-sm text-acero">
          {productos.length} producto{productos.length === 1 ? "" : "s"}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {productos.map((p) => (
            <article key={p.id} className="flex flex-col rounded-xl border border-cianclaro bg-white p-4">
              <div><Sello tipo="Entrega programada" /></div>
              <h2 className="mt-3 font-semibold">{p.nombre}</h2>
              <p className="mt-1 text-xs text-acero">
                {[...Object.entries(p.atributos).map(([k, v]) => `${k}: ${v}`), `SKU ${p.sku}`].join(" · ")}
              </p>
              <p className="mt-3 font-display text-2xl font-bold text-azul">
                {p.precio != null ? formatoMoneda(p.precio) : <span className="text-base">Precio por confirmar</span>}
              </p>
              <div className="mt-auto">
                <BotonAgregar producto={{ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad }} />
              </div>
            </article>
          ))}
        </div>
        {productos.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-sm">
            No encontramos eso. Prueba con otra medida o escríbenos y lo conseguimos.
          </p>
        )}
      </section>
    </>
  );
}
