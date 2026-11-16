import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ListaProductosPedido } from "@/components/ListaProductosPedido";
import { Progreso } from "@/components/Progreso";
import { IconoCheck } from "@/components/Iconos";
import { obtenerPedidoPorTokenReceptor } from "@/lib/pedidos";
import { etapaCliente } from "@/lib/estados";
import { describirPromesa } from "@/lib/corte";
import { FormularioRecepcion } from "./FormularioRecepcion";

/** Acceso de quien recibe (residente de obra, encargado): ve la entrega y confirma lo que llegó. Sin precios. */
export default function Entrega(props: PageProps<"/entrega/[token]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="border-b border-linea/70 px-4 py-3.5"><Link href="/"><Logo /></Link></header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-niebla" />}>
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
    <div className="space-y-8">
      <div>
        <p className="text-[15px] text-acero">Hola, {pedido.recibe_nombre?.split(" ")[0]}</p>
        <h1 className="mt-1 font-display text-[34px] font-bold leading-tight tracking-tight">
          {actual === 2 ? "Tu material va en camino." : actual === 3 ? "Material entregado." : "Material para tu obra."}
        </h1>
        <p className="mt-2 text-[15px] text-acero">Pedido {pedido.folio} · {pedido.direccion_entrega}</p>
      </div>

      {actual >= 0 && <Progreso actual={actual} />}

      {actual >= 0 && actual < 3 && pedido.entrega_fecha && pedido.entrega_ventana && (
        <div className="rounded-3xl bg-niebla p-5">
          <p className="text-[13px] text-acero">Llega</p>
          <p className="text-xl font-semibold">{describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana }).replace(/^Llega /, "").replace(/^./, (c) => c.toUpperCase())}</p>
        </div>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl font-bold">Material</h2>
        <ListaProductosPedido pedido={{ ...pedido, adjuntos: [] }} conPrecios={false} />
      </section>

      {puedeConfirmar && <FormularioRecepcion token={token} partidas={pedido.partidas} />}
      {pedido.recepcion_confirmada_en && (
        <div className="flex items-center gap-3 rounded-3xl bg-cianclaro p-5">
          <IconoCheck className="h-6 w-6 shrink-0" />
          <p className="font-semibold">
            Recepción confirmada{pedido.estado === "entregado_con_faltantes" ? ". Ya estamos resolviendo lo que faltó." : ". ¡Gracias!"}
          </p>
        </div>
      )}
    </div>
  );
}
