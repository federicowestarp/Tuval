import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { Imprimir } from "../../../mostrador/ticket/[id]/Imprimir";

/** Orden de recolección del chofer: qué recoger por pedido (con casillas) y en qué orden se entrega. */
export default function Orden(props: PageProps<"/interno/rutas/[id]/orden">) {
  return <Suspense fallback={null}><Contenido params={props.params} /></Suspense>;
}

async function Contenido({ params }: { params: PageProps<"/interno/rutas/[id]/orden">["params"] }) {
  await connection();
  await requerirInterno();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r] = await sql<{ chofer: string; fecha: string; vehiculo: string | null; origen: string | null }[]>`
    select u.nombre chofer, to_char(r.fecha, 'DD/MM/YYYY') fecha, v.nombre vehiculo, a.nombre origen
    from rutas r join usuarios_internos u on u.id = r.chofer_id left join vehiculos v on v.id = r.vehiculo_id left join almacenes a on a.id = r.origen_almacen_id
    where r.id = ${id}`;
  if (!r) notFound();
  const pedidos = await sql<{ orden: number | null; folio: string; estado: string; direccion: string | null; recibe: string | null; partidas: { nombre: string; sku: string; cantidad: number }[] }[]>`
    select e.orden_en_ruta orden, p.folio, p.estado, p.direccion_entrega direccion, p.recibe_nombre recibe,
           coalesce((select json_agg(json_build_object('nombre', pr.nombre, 'sku', pr.sku, 'cantidad', pp.cantidad) order by pr.nombre)
                     from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = p.id), '[]') partidas
    from entregas e join pedidos p on p.id = e.pedido_id where e.ruta_id = ${id} and e.estado in ('programada', 'en_ruta') order by e.orden_en_ruta nulls last`;
  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-[13px] text-black">
      <h1 className="text-xl font-bold">Orden de recolección y entrega</h1>
      <p>{r.fecha} · Chofer: {r.chofer} · {r.vehiculo ?? "sin vehículo"} · Recoge en: {r.origen ?? "—"}</p>
      {pedidos.map((p) => (
        <section key={p.folio} className="mt-4 break-inside-avoid border-t border-black pt-2">
          <p className="font-bold">{p.orden ?? "—"}. {p.folio} {p.estado === "surtido" ? "(ya surtido)" : "(recoger con proveedor)"}</p>
          <p>{p.direccion ?? "sin dirección"} · Recibe: {p.recibe ?? "—"}</p>
          <table className="mt-1 w-full">
            <tbody>
              {p.partidas.map((x, i) => (
                <tr key={i} className="border-b border-gray-300"><td className="w-6">☐</td><td className="w-14 font-bold">{x.cantidad}</td><td>{x.nombre}</td><td className="text-right text-gray-600">{x.sku}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="mt-8">Firma chofer: ____________________ &nbsp;&nbsp; Entregó (bodega): ____________________</p>
      <Imprimir />
    </main>
  );
}
