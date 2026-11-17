import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { describirUbicacion, ordenRecorrido, ubicacionesDe } from "@/lib/plano";
import { Plano } from "@/components/Plano";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../../Navegacion";
import { SurtirPartida } from "./SurtirPartida";

/** Lista de surtido de un pedido: en orden de recorrido, con plano y nivel; cada pieza se escanea y se descuenta. */
export default function Surtir(props: PageProps<"/interno/surtido/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="surtido" />
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/interno/surtido/[id]">["params"] }) {
  await connection();
  await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await sql<{ folio: string; estado: string; almacen: string | null; cliente: string | null }[]>`
    select folio, estado, almacen_surtido almacen, contacto_nombre cliente from pedidos where id = ${id} and surtir_en_sucursal_desde is not null`;
  if (!p) notFound();
  const ubicaciones = await ubicacionesDe(p.almacen ?? undefined);
  const partidas = (await sql<{ id: string; sku: string; nombre: string; unidad: string; cantidad: number; surtida: number; ubicacion_id: string | null; existencia: number; imagen_url: string | null }[]>`
    select pp.id, pr.sku, pr.nombre, coalesce(pr.unidad, 'pieza') unidad, pp.cantidad::float cantidad, pp.cantidad_surtida::float surtida, e.ubicacion_id,
           coalesce(e.cantidad, 0)::float existencia, pr.imagen_url
    from pedido_partidas pp join productos pr on pr.id = pp.producto_id
    left join existencias e on e.producto_id = pp.producto_id and e.almacen_id = ${p.almacen}
    where pp.pedido_id = ${id}`).map((x) => ({ ...x, ubic: ubicaciones.find((u) => u.id === x.ubicacion_id) ?? null }))
    .sort((a, b) => Number(a.surtida >= a.cantidad) - Number(b.surtida >= b.cantidad) || ordenRecorrido(a.ubic, b.ubic, ubicaciones));
  const hechas = partidas.filter((x) => x.surtida >= x.cantidad).length;
  const siguiente = partidas.find((x) => x.surtida < x.cantidad);

  return (
    <>
      <div>
        <Link href="/interno/surtido" className="text-[14px] text-azul">← Por surtir</Link>
        <h1 className="text-[26px] font-semibold tracking-tight">Surtir {p.folio}</h1>
        <p className="text-[15px] text-secundario">{p.cliente ?? ""} · {hechas}/{partidas.length} partidas{p.estado === "surtido" ? " · completo ✓" : ""}</p>
      </div>
      {p.estado === "surtido" && <p className="rounded-[20px] bg-emerald-50 p-4 font-semibold text-emerald-800">Pedido surtido ✓ Ya puede salir a ruta o entregarse.</p>}
      <ol className="space-y-3">
        {partidas.map((x) => {
          const lista = x.surtida >= x.cantidad;
          const actual = x.id === siguiente?.id;
          return (
            <li key={x.id} className={`space-y-3 rounded-[20px] bg-white p-4 ${lista ? "opacity-60" : ""} ${actual ? "ring-2 ring-[#E8590C]" : ""}`}>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.imagen_url && <img src={x.imagen_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{x.nombre}</p>
                  <p className="text-[13px] text-secundario">SKU {x.sku} · {lista ? "completa ✓" : `toma ${x.cantidad - x.surtida} ${x.unidad}`}{x.existencia < x.cantidad - x.surtida && !lista ? ` · ojo: el sistema dice ${x.existencia}` : ""}</p>
                  <p className={`mt-1 text-[14px] font-semibold ${x.ubic ? "text-[#E8590C]" : "text-amber-800"}`}>{describirUbicacion(x.ubic, ubicaciones)}</p>
                </div>
              </div>
              {actual && x.ubic && <Plano ubicaciones={ubicaciones} resaltar={x.ubic} compacto />}
              {!lista && <SurtirPartida partidaId={x.id} sku={x.sku} nombre={x.nombre} falta={x.cantidad - x.surtida} unidad={x.unidad} />}
            </li>
          );
        })}
      </ol>
    </>
  );
}
