import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ListaProductosPedido } from "@/components/ListaProductosPedido";
import { obtenerPedidoPorTokenReceptor } from "@/lib/pedidos";
import { ETAPAS_CLIENTE, etapaCliente } from "@/lib/estados";
import { describirPromesa } from "@/lib/corte";
import { FormularioRecepcion } from "./FormularioRecepcion";

/** Acceso de quien recibe (residente de obra, encargado): ve la entrega y confirma lo que llegó. Sin precios. */
export default function Entrega(props: PageProps<"/entrega/[token]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul px-4 py-4"><Link href="/"><Logo /></Link></header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-acero">Cargando…</p>}>
          <Contenido params={props.params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: Pick<PageProps<"/entrega/[token]">, "params">) {
  const { token } = await params;
  const pedido = await obtenerPedidoPorTokenReceptor(token);
  if (!pedido) notFound();
  const actual = etapaCliente(pedido.estado);
  const puedeConfirmar = (pedido.estado === "en_ruta" || pedido.estado === "entregado") && !pedido.recepcion_confirmada_en;

  return (
    <>
      <p className="text-sm text-acero">Hola {pedido.recibe_nombre}</p>
      <h1 className="font-display text-2xl font-bold">Entrega del pedido {pedido.folio}</h1>
      <p className="mt-1 text-sm text-acero">{pedido.direccion_entrega}</p>

      {actual >= 0 && (
        <ol className="mt-6 space-y-4 rounded-xl bg-white p-5">
          {ETAPAS_CLIENTE.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${i < actual ? "bg-cian" : i === actual ? "bg-azul ring-4 ring-cianclaro" : "bg-cianclaro"}`} />
              <span className={i <= actual ? "font-semibold" : "text-acero"}>{e}</span>
            </li>
          ))}
        </ol>
      )}
      {actual >= 0 && actual < 3 && pedido.entrega_fecha && pedido.entrega_ventana && (
        <p className="mt-4 rounded-xl bg-white p-4 font-semibold">{describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana })}</p>
      )}

      <section className="mt-4 rounded-xl bg-white p-4">
        <h2 className="font-semibold">Material</h2>
        <ListaProductosPedido pedido={{ ...pedido, adjuntos: [] }} conPrecios={false} />
      </section>

      {puedeConfirmar && <FormularioRecepcion token={token} partidas={pedido.partidas} />}
      {pedido.recepcion_confirmada_en && (
        <p className="mt-4 rounded-xl bg-cianclaro p-4 text-sm font-semibold">
          Recepción confirmada{pedido.estado === "entregado_con_faltantes" ? " con faltantes: ya estamos en eso." : "."}
        </p>
      )}
    </>
  );
}
