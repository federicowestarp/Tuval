import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Sello } from "@/components/Sello";
import { IconoCategoria } from "@/components/IconoCategoria";
import { CATEGORIAS, buscar } from "@/lib/catalogo-demo";

export default function Inicio(props: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="flex-1 bg-azul" />}>
      <Contenido searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const resultados = buscar(q, cat);

  return (
    <>
      <header className="bg-azul">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-4 text-sm text-white">
            <Link href="/pedido/DEMO-0001" className="hidden sm:inline hover:text-cian">Mis pedidos</Link>
            <span className="rounded-full bg-white px-4 py-2 font-semibold text-azul">Carrito</span>
          </nav>
        </div>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-6">
          <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">¿Qué necesitas para tu obra?</h1>
          <form className="mt-6 flex max-w-2xl gap-2" action="/">
            <input
              name="q"
              defaultValue={q}
              placeholder='Busca por producto, medida o SKU… (ej. cople 1/2")'
              className="w-full rounded-lg bg-white px-4 py-3 text-base text-profundo outline-none ring-cian focus:ring-4"
            />
            <button className="rounded-lg bg-cian px-5 py-3 font-semibold text-profundo">Buscar</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-cian px-3 py-1 text-xs font-semibold text-profundo">Entrega en Puebla</span>
            <span className="rounded-full border border-white px-3 py-1 text-xs font-semibold text-white">Factura o nota</span>
          </div>
        </section>
      </header>

      <main className="flex-1 bg-niebla">
        <section className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 py-6 sm:grid-cols-6">
          {CATEGORIAS.map((c) => (
            <Link
              key={c.id}
              href={cat === c.id ? "/" : `/?cat=${c.id}`}
              className={`flex flex-col items-start gap-3 rounded-xl p-4 text-azul transition ${cat === c.id ? "bg-cianclaro ring-2 ring-cian" : "bg-white hover:ring-2 hover:ring-cian"}`}
            >
              <IconoCategoria categoria={c.id} />
              <span className="text-sm font-semibold">{c.nombre}</span>
            </Link>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12">
          <p className="mb-3 text-sm text-acero">
            {resultados.length} producto{resultados.length === 1 ? "" : "s"} · catálogo de demostración
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resultados.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-xl border border-cianclaro bg-white">
                <div className="p-4">
                  <Sello tipo="Entrega programada" />
                  <div className="mt-3" />
                  <h2 className="font-semibold">{p.nombre}</h2>
                  <p className="mt-1 text-xs text-acero">
                    {Object.entries(p.atributos).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </p>
                  <p className="mt-3 font-display text-2xl font-bold text-azul">$ [PRECIO]</p>
                  <button className="mt-3 w-full rounded-lg bg-azul py-2 text-sm font-semibold text-white">Agregar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-profundo py-6 text-center text-xs text-white">
        Tubería, equipos y eléctrico. Todo, a tiempo.
      </footer>
    </>
  );
}
