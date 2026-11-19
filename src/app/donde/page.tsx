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
import { AvisarCelular } from "./AvisarCelular";
import Link from "next/link";
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
      <p className="text-center text-[14px] text-secundario">¿No la encuentras en el anaquel? Cualquier persona de Tuval te acompaña. Lo que agregues lo pagas en caja con tu código.</p>
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
  let productos: { id: string; nombre: string; sku: string; unidad: string | null; precio: number | null; cantidad: number; ubicacion_id: string | null; imagen_url: string | null }[] = [];
  let usada = "";
  for (const v of variantes) {
    const palabras = v.split(/\s+/).filter(Boolean).slice(0, 6);
    if (!palabras.length) continue;
    productos = await sql<typeof productos>`
      select p.id, p.nombre, p.sku, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float cantidad, e.ubicacion_id, p.imagen_url
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
  // Lo que no tenemos le aparece al equipo (caja, vendedores y dirección) sin que el cliente tenga que ir a recepción.
  const [faltante] = conExistencia === 0 ? await sql<{ id: string }[]>`
    with ya as (select id from solicitudes_producto where origen = 'buscador_tienda' and lower(descripcion) = lower(${q}) and creado_en > now() - interval '24 hours' limit 1),
    nueva as (
      insert into solicitudes_producto (descripcion, cantidad, origen, notas, producto_id)
      select ${q}, 1, 'buscador_tienda', ${productos.length ? "Buscado en tienda: está en catálogo pero sin existencia en sucursal" : "Buscado en tienda: no está en catálogo"}, ${productos[0]?.id ?? null}
      where not exists (select 1 from ya) returning id)
    select id from nueva union all select id from ya limit 1` : [];
  const avisoFaltante = faltante && (
    <div className="space-y-3 rounded-[24px] bg-[#FFF6E5] p-5">
      <p className="text-[18px] font-semibold">{productos.length ? "Esa pieza no la tenemos en tienda ahorita." : `No tenemos “${q}” en tienda ahorita.`}</p>
      <p className="text-[15px]">Ya le avisamos al equipo: la vamos a buscar con nuestros proveedores y te la conseguimos. No necesitas ir a recepción.</p>
      <AvisarCelular solicitudId={faltante.id} />
    </div>
  );
  const nota = usada && usada !== q.toLowerCase().trim() ? <p className="text-[14px] text-secundario">Buscamos: “{usada}”</p> : null;
  if (productos.length === 0) return avisoFaltante;
  return (
    <>
    {nota}
    {avisoFaltante}
    <ul className="space-y-4">
      {productos.map((p, i) => {
        const u = ubicaciones.find((x) => x.id === p.ubicacion_id) ?? null;
        return (
          <li key={p.id} className="space-y-3 rounded-[24px] bg-niebla p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/producto/${encodeURIComponent(p.sku)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto propia del catálogo */}
                  {p.imagen_url ? <img src={p.imagen_url} alt="" className="h-full w-full object-contain" /> : <span className="text-[11px] text-secundario">Sin foto</span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-[19px] font-semibold leading-tight">{p.nombre}</span>
                  <span className="block text-[14px] text-secundario">SKU {p.sku} · <span className="text-azul">Ver ficha ›</span></span>
                </span>
              </Link>
              {p.precio != null && <p className="w-full text-[26px] font-bold text-azul sm:w-auto sm:text-right">{mx(p.precio * (1 + TASA_IVA))}<span className="block text-[12px] font-normal text-secundario">IVA incluido · {p.unidad ?? "pieza"}</span></p>}
            </div>
            {p.cantidad > 0 && <BotonAgregarFicha producto={{ id: p.id, sku: p.sku, nombre: p.nombre, unidad: p.unidad ?? "pieza" }} />}
            {p.cantidad <= 0 ? <p className="font-semibold text-amber-800">Por ahora no hay en tienda; ya avisamos al equipo para conseguirla.</p>
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
