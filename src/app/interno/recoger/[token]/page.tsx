import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { formatoMoneda } from "@/lib/catalogo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../../Navegacion";
import { EntregarSucursal } from "./EntregarSucursal";

/** Lo que abre el QR que el cliente enseña al recoger en sucursal. */
export default function Recoger(props: PageProps<"/interno/recoger/[token]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="mostrador" />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/interno/recoger/[token]">["params"] }) {
  await connection();
  await requerirInterno("mostrador");
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(token)) notFound();
  const [p] = await sql<{ id: string; folio: string; estado: string; tipo_entrega: string; contacto_nombre: string | null; contacto_telefono: string | null; recibe_nombre: string | null; total: number; aprobado_por: string | null; pagado: number }[]>`
    select p.id, p.folio, p.estado, p.tipo_entrega, p.contacto_nombre, p.contacto_telefono, p.recibe_nombre, p.total::float total, p.aprobado_por,
           coalesce((select sum(monto) from pagos g where g.pedido_id = p.id and g.estado = 'confirmado'), 0)::float pagado
    from pedidos p where p.token_receptor = ${token}`;
  if (!p) notFound();
  const partidas = await sql<{ id: string; nombre: string; cantidad: number }[]>`
    select pp.id, pr.nombre, pp.cantidad::float cantidad from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = ${p.id} order by pr.nombre`;
  const listo = p.tipo_entrega === "recoger" && (p.estado === "surtido" || p.estado === "en_ruta");
  return (
    <>
      <div>
        <Link href={`/interno/pedidos/${p.id}`} className="text-[14px] text-azul">Ver pedido {p.folio}</Link>
        <h1 className="text-[26px] font-semibold tracking-tight">Recoge {p.contacto_nombre ?? ""}</h1>
        <p className="text-[15px] text-secundario">{p.folio} · {p.contacto_telefono ?? ""} · {formatoMoneda(p.total)}</p>
      </div>
      {p.estado.startsWith("entregado") ? <p className="rounded-[20px] bg-emerald-50 p-5 font-semibold text-emerald-800">Este pedido ya se entregó.</p>
        : !listo ? <p className="rounded-[20px] bg-amber-50 p-5 font-semibold text-amber-800">{p.tipo_entrega !== "recoger" ? "Este pedido es con envío, no para recoger." : "El material todavía no está listo en sucursal."}</p>
        : !p.aprobado_por ? (
          <div className="rounded-[20px] bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">Falta cobrar {formatoMoneda(Math.max(0, p.total - p.pagado))}</p>
            <p className="text-[14px] text-amber-900">Regístralo en el pedido (o apruébalo a crédito) y vuelve a esta pantalla.</p>
            <Link href={`/interno/pedidos/${p.id}`} className="mt-2 inline-block rounded-full bg-azul px-4 py-2 font-semibold text-white">Ir a cobrar</Link>
          </div>
        ) : (
          <section className="rounded-[20px] bg-white p-4"><EntregarSucursal pedidoId={p.id} recibeNombre={p.recibe_nombre ?? p.contacto_nombre ?? ""} partidas={partidas} /></section>
        )}
    </>
  );
}
