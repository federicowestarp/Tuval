import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { TASA_IVA } from "@/lib/totales";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../../Navegacion";
import { describirUbicacion, ubicacionesDe } from "@/lib/plano";
import { Plano } from "@/components/Plano";
import { asignarUbicacion } from "../../plano/acciones";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Lo que ve el equipo al escanear la etiqueta de anaquel:
 * - Si hay inventario físico abierto que incluya el producto → directo a contarlo (a ciegas).
 * - Si no → ficha interna: precio, existencias por almacén y si está bajo el mínimo.
 */
export default function Escanear(props: PageProps<"/interno/escanear/[sku]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="etiquetas" />
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/interno/escanear/[sku]">["params"] }) {
  await connection();
  await requerirInterno("mostrador");
  const sku = decodeURIComponent((await params).sku);
  const [p] = await sql<{ id: string; sku: string; nombre: string; unidad: string | null; imagen_url: string | null; precio: number | null; costo: number | null }[]>`
    select p.id, p.sku, p.nombre, p.unidad, p.imagen_url, pr.precio::float precio, p.costo_promedio::float costo
    from productos p left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
    where upper(p.sku) = upper(${sku}) limit 1`;
  if (!p) notFound();

  // Inventario abierto: primero la tarjeta que aún tiene conteos pendientes.
  const [t] = await sql<{ id: string }[]>`
    select t.id from tarjetas_inventario t join inventarios_fisicos i on i.id = t.inventario_id
    where i.estado = 'abierto' and t.producto_id = ${p.id} order by (t.final is null) desc, i.creado_en desc limit 1`;
  if (t) redirect(`/interno/inventario-fisico/t/${t.id}`);

  const ubicaciones = await ubicacionesDe();
  const [aqui] = await sql<{ ubicacion_id: string | null }[]>`
    select e.ubicacion_id from existencias e join almacenes a on a.id = e.almacen_id where e.producto_id = ${p.id} and a.id = (select id from almacenes where tipo = 'sucursal' and activo order by creado_en limit 1)`;
  const ubic = ubicaciones.find((u) => u.id === aqui?.ubicacion_id) ?? null;
  const existencias = await sql<{ almacen: string; cantidad: number; minimo: number | null; ubicacion: string | null }[]>`
    select a.nombre almacen, e.cantidad::float cantidad, e.minimo::float minimo, u.codigo ubicacion
    from existencias e join almacenes a on a.id = e.almacen_id left join ubicaciones u on u.id = e.ubicacion_id
    where e.producto_id = ${p.id} and a.tipo in ('sucursal', 'cedis', 'obra') order by a.tipo, a.nombre`;

  return (
    <section className="space-y-4 rounded-[20px] bg-white p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imagen_url && <img src={p.imagen_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-contain" />}
        <div className="min-w-0">
          <p className="text-[13px] text-secundario">SKU {p.sku}</p>
          <h1 className="text-[20px] font-semibold leading-tight">{p.nombre}</h1>
        </div>
      </div>
      <div className="rounded-2xl bg-[#E8F1FB] p-3">
        <p className="text-[13px] text-secundario">Precio al público</p>
        <p className="text-[30px] font-bold leading-tight text-azul">{p.precio != null ? mx(p.precio * (1 + TASA_IVA)) : "Sin precio"}</p>
        {p.precio != null && <p className="text-[13px] text-secundario">IVA incluido · {mx(p.precio)} + IVA · por {p.unidad ?? "pieza"}</p>}
      </div>
      <div>
        <p className="mb-1 text-[14px] font-semibold">Existencias</p>
        {existencias.length === 0 ? <p className="text-[14px] text-secundario">Sin existencias registradas.</p> : (
          <ul className="divide-y divide-linea text-[15px]">
            {existencias.map((e) => {
              const bajo = e.minimo != null && e.cantidad < e.minimo;
              return (
                <li key={e.almacen} className="flex items-center justify-between py-2">
                  <span>{e.almacen}{e.ubicacion && <span className="text-[13px] text-secundario"> · {e.ubicacion}</span>}</span>
                  <span className={`font-semibold ${e.cantidad <= 0 ? "text-red-700" : bajo ? "text-amber-700" : "text-emerald-700"}`}>
                    {e.cantidad}{bajo ? ` · mín ${e.minimo}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-[14px] font-semibold">Dónde está: <span className="font-normal">{describirUbicacion(ubic, ubicaciones)}</span></p>
        {ubic && <Plano ubicaciones={ubicaciones} resaltar={ubic} compacto />}
        {ubicaciones.length > 0 && (
          <form action={asignarUbicacion} className="flex gap-2">
            <input type="hidden" name="producto_id" value={p.id} />
            <select name="ubicacion_id" defaultValue={ubic?.id ?? ""} aria-label="Cambiar ubicación" className="h-10 min-w-0 flex-1 rounded-full border border-linea bg-white px-3">
              <option value="">Sin ubicación</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.codigo}</option>)}
            </select>
            <button className="rounded-full border border-azul px-4 font-semibold text-azul">{ubic ? "Mover aquí" : "Asignar"}</button>
          </form>
        )}
      </div>
      <p className="rounded-xl bg-niebla p-3 text-[13px] text-secundario">No hay inventario físico abierto con este producto. Cuando se abra uno, este mismo QR te lleva directo a contarlo.</p>
      <Link href={`/interno/etiquetas?q=${encodeURIComponent(p.sku)}&todos=1&ver=1`} className="block text-center text-[14px] text-azul">Reimprimir etiqueta</Link>
    </section>
  );
}
