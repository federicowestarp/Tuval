import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { VaciarCarrito } from "@/components/carrito/VaciarCarrito";
import { obtenerPedido } from "@/lib/pedidos";
import { ETAPAS_CLIENTE, etapaCliente } from "@/lib/estados";
import { describirPromesa, ZONAS } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";

export default function SeguimientoPedido(props: PageProps<"/pedido/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul"><Encabezado /></header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-acero">Cargando pedido…</p>}>
          <Contenido params={props.params} searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params, searchParams }: Pick<PageProps<"/pedido/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const nuevo = (await searchParams).nuevo === "1";
  const pedido = await obtenerPedido(id);
  if (!pedido) notFound();

  const actual = etapaCliente(pedido.estado);
  const sinPrecio = pedido.partidas.some((p) => p.precio_unitario == null);
  const titulo =
    actual === -1 ? "Pedido cancelado" : actual === 3 ? "Pedido entregado" : actual === 2 ? "Tu pedido va en camino" : nuevo ? "¡Recibimos tu pedido!" : "Tu pedido";

  return (
    <>
      {nuevo && <VaciarCarrito />}
      <h1 className="font-display text-2xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-acero">
        Pedido {pedido.folio} · {ZONAS.find((z) => z.id === pedido.zona)?.nombre} · {pedido.tipo_entrega === "obra" ? "Obra" : "Domicilio"}
      </p>

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

      {actual >= 0 && actual < 3 && (
        <p className="mt-4 rounded-xl bg-white p-4 font-semibold">
          {describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana })}
        </p>
      )}

      <section className="mt-4 rounded-xl bg-white p-4">
        <h2 className="font-semibold">Productos</h2>
        <ul className="mt-2 divide-y divide-cianclaro text-sm">
          {pedido.partidas.map((p) => (
            <li key={p.sku} className="flex justify-between gap-3 py-2">
              <span>{p.cantidad} × {p.nombre}</span>
              <span className="text-acero">{p.precio_unitario != null ? formatoMoneda(p.precio_unitario * p.cantidad) : "por confirmar"}</span>
            </li>
          ))}
        </ul>
        {sinPrecio ? (
          <p className="mt-3 text-sm text-acero">Te confirmamos el total por WhatsApp al {pedido.contacto_telefono}.</p>
        ) : (
          <p className="mt-3 text-right font-display text-xl font-bold text-azul">Total {formatoMoneda(pedido.total)}</p>
        )}
        <p className="mt-1 text-xs text-acero">{pedido.comprobante === "factura" ? "Con factura" : "Con nota"}</p>
      </section>

      <p className="mt-6 text-xs text-acero">
        Guarda esta liga para ver cómo va tu pedido. Al recibir podrás confirmar partida por partida y reportar faltantes.
        {pedido.sin_recepcion_solicitada && " Autorizaste entrega sin recepción: el chofer dejará foto con ubicación como comprobante."}
      </p>
    </>
  );
}
