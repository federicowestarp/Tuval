import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { sucursal } from "@/lib/inventario";
import { describirUbicacion, ubicacionesDe } from "@/lib/plano";
import { TASA_IVA } from "@/lib/totales";
import { Plano } from "@/components/Plano";
import { normalizarBusqueda } from "@/lib/habla";
import { BuscarConVoz } from "./BuscarConVoz";
import { BotonAgregarFicha } from "@/components/tienda/BotonAgregarFicha";

export const metadata: Metadata = { title: "¿Dónde está?", robots: { index: false } };

// De dónde se busca: letrero con QR (celular del cliente), tablet de recepción o de un vendedor.
const ORIGENES = ["letrero", "recepcion", "vendedor"];
const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Quiosco de la tienda (tablet en recepción o en piso): el cliente busca una pieza y ve en el plano
 * en qué pasillo, anaquel y nivel está, con su precio. Sin iniciar sesión.
 */
export default function Donde(props: PageProps<"/donde">) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl space-y-5 bg-white px-4 py-8">
      <div>
        <p className="text-[14px] font-semibold uppercase tracking-wide text-azul">Tuval</p>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">¿Qué pieza buscas?</h1>
      </div>
      <Suspense fallback={<div className="h-14" />}><Buscador searchParams={props.searchParams} /></Suspense>
      <Suspense fallback={null}><Resultados searchParams={props.searchParams} /></Suspense>
      <p className="text-center text-[14px] text-secundario">¿No la encuentras? Pregunta a cualquier persona de Tuval y te acompañamos. Lo que agregues lo pagas en caja con tu código.</p>
    </main>
  );
}

async function Buscador({ searchParams }: { searchParams: PageProps<"/donde">["searchParams"] }) {
  const q = String((await searchParams).q ?? "").slice(0, 80);
  const o = String((await searchParams).o ?? "");
  return <BuscarConVoz key={q} inicial={q} origen={ORIGENES.includes(o) ? o : undefined} />;
}

async function Resultados({ searchParams }: { searchParams: PageProps<"/donde">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 80);
  if (!q) return null;
  const origen = ORIGENES.includes(String(sp.o)) ? String(sp.o) : "web";
  const s = await sucursal();
  // Lo dicho o escrito → búsquedas de catálogo ("codo de media" → "codo 1/2"), de específica a general.
  const variantes = normalizarBusqueda(q);
  const [ubicaciones] = await Promise.all([ubicacionesDe(s.id)]);
  let productos: { id: string; nombre: string; sku: string; unidad: string | null; precio: number | null; cantidad: number; ubicacion_id: string | null }[] = [];
  let usada = "";
  for (const v of variantes) {
    const palabras = v.split(/\s+/).filter(Boolean).slice(0, 6);
    if (!palabras.length) continue;
    productos = await sql<typeof productos>`
      select p.id, p.nombre, p.sku, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float cantidad, e.ubicacion_id
      from productos p
      left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
      left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
      where p.activo and ${palabras.map((w) => sql`(translate(lower(p.nombre), 'áéíóúüñ', 'aeiouun') like ${"%" + w + "%"} or lower(p.sku) like ${"%" + w + "%"})`).reduce((x, y) => sql`${x} and ${y}`)}
      order by (coalesce(e.cantidad, 0) > 0) desc, (e.ubicacion_id is not null) desc, p.nombre limit 6`;
    if (productos.length) { usada = v; break; }
  }
  // Medir uso y detectar lo que piden y no tenemos (pasa a Demanda no surtida, sin duplicar en 24 h).
  const conExistencia = productos.filter((p) => p.cantidad > 0).length;
  await sql`insert into busquedas_tienda (texto, usada, resultados, con_existencia, origen) values (${q}, ${usada || null}, ${productos.length}, ${conExistencia}, ${origen})`;
  if (conExistencia === 0) await sql`
    insert into solicitudes_producto (descripcion, cantidad, origen, notas, producto_id)
    select ${q}, 1, 'buscador_tienda', ${productos.length ? "Buscado en tienda: está en catálogo pero sin existencia en sucursal" : "Buscado en tienda: no está en catálogo"}, ${productos[0]?.id ?? null}
    where not exists (select 1 from solicitudes_producto where origen = 'buscador_tienda' and lower(descripcion) = lower(${q}) and creado_en > now() - interval '24 hours')`;
  const nota = usada && usada !== q.toLowerCase().trim() ? <p className="text-[14px] text-secundario">Buscamos: “{usada}”</p> : null;
  if (productos.length === 0) return <p className="rounded-[20px] bg-niebla p-5 text-[17px]">No encontramos “{q}”. Pregunta en recepción: podemos conseguirla.</p>;
  return (
    <>
    {nota}
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
            {p.cantidad > 0 && <BotonAgregarFicha producto={{ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad ?? "pieza" }} />}
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
    </>
  );
}
