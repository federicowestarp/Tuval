import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const ETAPAS = ["Pedido recibido", "Comprado a proveedor", "Surtido", "En ruta", "Entregado"] as const;

/** Seguimiento de pedido (demostración: el estado real vendrá de la base de datos). */
export default function SeguimientoPedido(props: PageProps<"/pedido/[folio]">) {
  return (
    <Suspense fallback={<div className="flex-1 bg-niebla" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/pedido/[folio]">["params"] }) {
  const { folio } = await params;
  const actual = 3; // demo: "En ruta"

  return (
    <div className="flex min-h-full flex-1 flex-col bg-niebla">
      <header className="bg-azul px-4 py-4">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Tu pedido va en camino</h1>
        <p className="mt-1 text-sm text-acero">Pedido {folio} · Obra [OBRA]</p>
        <ol className="mt-6 space-y-4 rounded-xl bg-white p-5">
          {ETAPAS.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span
                className={`h-4 w-4 rounded-full ${i < actual ? "bg-cian" : i === actual ? "bg-azul ring-4 ring-cianclaro" : "bg-cianclaro"}`}
              />
              <span className={i <= actual ? "font-semibold" : "text-acero"}>{e}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-white p-4 text-sm">Llega hoy entre [HORA] y [HORA]</p>
        <p className="mt-6 text-xs text-acero">
          Al recibir podrás confirmar partida por partida y reportar faltantes. Si autorizaste entrega sin recepción, el
          chofer deja foto con ubicación como comprobante.
        </p>
      </main>
    </div>
  );
}
