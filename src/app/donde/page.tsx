import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { sucursal } from "@/lib/inventario";
import { describirUbicacion, ubicacionesDe } from "@/lib/plano";
import { TASA_IVA } from "@/lib/totales";
import { Plano } from "@/components/Plano";

export const metadata: Metadata = { title: "¿Dónde está?", robots: { index: false } };

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Quiosco de la tienda (tablet en recepción o en piso): el cliente busca una pieza y ve en el plano
 * en qué pasillo, anaquel y nivel está, con su precio. Sin iniciar sesión.
 */
export default function Donde(props: PageProps<"/donde">) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-5 bg-white px-4 py-8">
      <div>
        <p className="text-[14px] font-semibold uppercase tracking-wide text-azul">Tuval</p>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">¿Qué pieza buscas?</h1>
      </div>
      <form className="flex gap-2">
        <input name="q" autoFocus placeholder="Ej. codo 1/2, válvula de bola, teflón" className="h-14 min-w-0 flex-1 rounded-full border-2 border-linea px-5 text-[18px]" />
        <button className="h-14 rounded-full bg-azul px-6 text-[17px] font-semibold text-white">Buscar</button>
      </form>
      <Suspense fallback={null}><Resultados searchParams={props.searchParams} /></Suspense>
      <p className="text-center text-[14px] text-secundario">¿No la encuentras? Pregunta en recepción y te acompañamos.</p>
    </main>
  );
}

async function Resultados({ searchParams }: { searchParams: PageProps<"/donde">["searchParams"] }) {
  await connection();
  const q = String((await searchParams).q ?? "").trim().slice(0, 80);
  if (!q) return null;
  const s = await sucursal();
  // Sin acentos: “valvula” encuentra “Válvula”.
  const palabras = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean).slice(0, 5);
  const [ubicaciones, productos] = await Promise.all([
    ubicacionesDe(s.id),
    sql<{ id: string; nombre: string; sku: string; unidad: string | null; precio: number | null; cantidad: number; ubicacion_id: string | null }[]>`
      select p.id, p.nombre, p.sku, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float cantidad, e.ubicacion_id
      from productos p
      left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
      left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
      where p.activo and ${palabras.map((w) => sql`(translate(lower(p.nombre), 'áéíóúüñ', 'aeiouun') like ${"%" + w + "%"} or lower(p.sku) like ${"%" + w + "%"})`).reduce((a, b) => sql`${a} and ${b}`)}
      order by (coalesce(e.cantidad, 0) > 0) desc, (e.ubicacion_id is not null) desc, p.nombre limit 6`,
  ]);
  if (productos.length === 0) return <p className="rounded-[20px] bg-niebla p-5 text-[17px]">No encontramos “{q}”. Pregunta en recepción: podemos conseguirla.</p>;
  return (
    <ul className="space-y-4">
      {productos.map((p, i) => {
        const u = ubicaciones.find((x) => x.id === p.ubicacion_id) ?? null;
        return (
          <li key={p.id} className="space-y-3 rounded-[24px] bg-niebla p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[20px] font-semibold leading-tight">{p.nombre}</p>
                <p className="text-[14px] text-secundario">SKU {p.sku}</p>
              </div>
              {p.precio != null && <p className="text-[26px] font-bold text-azul">{mx(p.precio * (1 + TASA_IVA))}<span className="block text-right text-[12px] font-normal text-secundario">IVA incluido · {p.unidad ?? "pieza"}</span></p>}
            </div>
            {p.cantidad <= 0 ? <p className="font-semibold text-amber-800">Por ahora no hay en tienda. Pídela en recepción y te la conseguimos.</p>
              : u ? (
                <>
                  <p className="text-[18px] font-semibold text-[#E8590C]">{describirUbicacion(u, ubicaciones)}</p>
                  {i === 0 && <Plano ubicaciones={ubicaciones} resaltar={u} />}
                </>
              ) : <p className="font-semibold">Hay en tienda. Pregunta en recepción y te la damos.</p>}
          </li>
        );
      })}
    </ul>
  );
}
