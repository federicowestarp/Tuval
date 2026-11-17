import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marco } from "@/components/marco/Marco";
import { IconoCategoria } from "@/components/IconoCategoria";
import { TarjetaProducto } from "@/components/tienda/TarjetaProducto";
import { BotonAgregarFicha } from "@/components/tienda/BotonAgregarFicha";
import { Pastilla } from "@/components/ui";
import { CATEGORIAS, esCategoria } from "@/lib/categorias";
import { formatoMoneda, IVA, productoPorSku, relacionados } from "@/lib/catalogo";

export async function generateMetadata(props: PageProps<"/producto/[sku]">): Promise<Metadata> {
  const { sku } = await props.params;
  const p = await productoPorSku(sku);
  if (!p) return { title: "Producto" };
  const detalle = Object.values(p.atributos).join(" · ");
  return { title: p.nombre, description: `${p.nombre}${detalle ? ` · ${detalle}` : ""}. Pídelo en Tuval y te lo llevamos a tu obra.` };
}

/** Ficha de producto. Es también el destino de los QR de anaquel (tuval.mx/producto/SKU). */
export default function Ficha(props: PageProps<"/producto/[sku]">) {
  return (
    <Marco>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[28px] bg-niebla" />}>
          <Contenido params={props.params} />
        </Suspense>
      </main>
    </Marco>
  );
}

async function Contenido({ params }: Pick<PageProps<"/producto/[sku]">, "params">) {
  const { sku } = await params;
  const p = await productoPorSku(sku);
  if (!p) notFound();
  const cat = CATEGORIAS.find((c) => c.id === p.categoria_id);
  const otros = await relacionados(p.categoria_id, p.id);

  return (
    <>
      <nav className="mb-6 text-[13px] text-secundario">
        <Link href="/tienda" className="hover:text-azul">Tienda</Link>
        {cat && <> · <Link href={`/tienda?cat=${cat.id}`} className="hover:text-azul">{cat.nombre}</Link></>}
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-[28px] bg-piedra text-azul">
          {p.imagen_url
            // eslint-disable-next-line @next/next/no-img-element -- foto propia servida con caché pública
            ? <img src={p.imagen_url} alt={p.nombre} className="h-full w-full rounded-[28px] object-contain p-6" />
            : esCategoria(p.categoria_id) ? <IconoCategoria categoria={p.categoria_id} className="h-28 w-28" /> : <span className="text-secundario">Sin foto</span>}
        </div>
        <div className="flex flex-col">
          {cat && <p className="text-[13px] text-secundario">{cat.nombre}</p>}
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight sm:text-4xl">{p.nombre}</h1>
          <p className="mt-2 text-[13px] text-secundario">SKU {p.sku}</p>
          {Object.keys(p.atributos).length > 0 && (
            <dl className="mt-6 divide-y divide-linea rounded-[20px] bg-niebla px-5">
              {Object.entries(p.atributos).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 text-[15px]"><dt className="text-secundario">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              <div className="flex justify-between gap-4 py-3 text-[15px]"><dt className="text-secundario">Unidad</dt><dd className="font-medium">{p.unidad}</dd></div>
            </dl>
          )}
          <div className="mt-6">
            {p.precio != null ? (
              <>
                <p className="font-display text-4xl font-semibold tracking-[-0.02em]">{formatoMoneda(p.precio)}</p>
                <p className="text-[13px] text-secundario">Más IVA · {formatoMoneda(p.precio * (1 + IVA))} con IVA</p>
              </>
            ) : (
              <p className="text-[17px] text-secundario">Precio a confirmar</p>
            )}
          </div>
          <div className="mt-4"><Pastilla tono="borde">Entrega programada</Pastilla></div>
          <div className="mt-6"><BotonAgregarFicha producto={{ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad }} /></div>
          <p className="mt-4 text-[13px] text-secundario">Confirmamos existencias y hora de entrega antes de surtir.</p>
        </div>
      </div>

      {otros.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 font-display text-2xl font-semibold">También en {cat?.nombre ?? "la tienda"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {otros.map((o) => (
              <TarjetaProducto key={o.id} id={o.id} sku={o.sku} nombre={o.nombre} unidad={o.unidad} categoria={o.categoria_id} atributos={o.atributos} precio={o.precio} imagen={o.imagen_url} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
