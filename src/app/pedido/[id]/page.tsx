import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { VaciarCarrito } from "@/components/carrito/VaciarCarrito";
import { ListaProductosPedido } from "@/components/ListaProductosPedido";
import { obtenerPedido, ligaWhatsApp } from "@/lib/pedidos";
import { ETAPAS_CLIENTE, etapaCliente } from "@/lib/estados";
import { describirPromesa, ZONAS } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { urlBase } from "@/lib/url";

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
  const porConfirmar = !pedido.confirmado_en;
  const titulo =
    actual === -1 ? "Pedido cancelado" : pedido.estado === "entregado_con_faltantes" ? "Entregado con faltantes: ya estamos en eso" : actual === 3 ? "Pedido entregado" : actual === 2 ? "Tu pedido va en camino" : nuevo ? "¡Recibimos tu pedido!" : "Tu pedido";

  // Acceso para quien recibe (residente u otra persona): mismo seguimiento + confirmar lo que llegó.
  const otraPersonaRecibe = pedido.recibe_telefono && pedido.recibe_telefono !== pedido.contacto_telefono;
  const base = await urlBase();
  const ligaReceptor = `${base}/entrega/${pedido.token_receptor}`;

  return (
    <>
      {nuevo && <VaciarCarrito />}
      <h1 className="font-display text-2xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-acero">
        Pedido {pedido.folio}
        {pedido.zona && ` · ${ZONAS.find((z) => z.id === pedido.zona)?.nombre}`}
        {` · ${pedido.tipo_entrega === "obra" ? "Obra" : pedido.tipo_entrega === "recoger" ? "Recoger" : "Domicilio"}`}
      </p>

      {actual >= 0 && (
        <ol className="mt-6 space-y-4 rounded-xl bg-white p-5">
          {ETAPAS_CLIENTE.map((e, i) => (
            <li key={e} className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${i < actual ? "bg-cian" : i === actual ? "bg-azul ring-4 ring-cianclaro" : "bg-cianclaro"}`} />
              <span className={i <= actual ? "font-semibold" : "text-acero"}>
                {e}
                {i === 0 && actual === 0 && porConfirmar && <span className="block text-xs font-normal text-acero">Estamos confirmando precios y existencias</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {actual >= 0 && actual < 3 && pedido.entrega_fecha && pedido.entrega_ventana && (
        <p className="mt-4 rounded-xl bg-white p-4 font-semibold">
          {describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana })}
          {porConfirmar && <span className="block text-xs font-normal text-acero">Sujeto a confirmación de existencias</span>}
        </p>
      )}

      {pedido.direccion_entrega && (
        <section className="mt-4 rounded-xl bg-white p-4 text-sm">
          <p className="font-semibold">Entrega en</p>
          <p className="text-acero">{pedido.direccion_entrega}</p>
          <p className="mt-1">Recibe: {pedido.recibe_nombre} · {pedido.recibe_telefono}</p>
          {pedido.sin_recepcion_solicitada && <p className="mt-1 text-xs text-acero">Autorizaste entrega sin recepción: el chofer dejará foto con ubicación.</p>}
        </section>
      )}

      <section className="mt-4 rounded-xl bg-white p-4">
        <h2 className="font-semibold">Productos</h2>
        <ListaProductosPedido pedido={pedido} />
        {porConfirmar ? (
          <p className="mt-3 text-sm text-acero">Te confirmamos el total por WhatsApp al {pedido.contacto_telefono}.</p>
        ) : (
          <p className="mt-3 text-right font-display text-xl font-bold text-azul">Total {formatoMoneda(pedido.total)}</p>
        )}
        <p className="mt-1 text-xs text-acero">{pedido.comprobante === "factura" ? "Con factura" : "Con nota"}</p>
      </section>

      {otraPersonaRecibe && actual >= 0 && actual < 3 && (
        <a
          href={ligaWhatsApp(
            pedido.recibe_telefono!,
            `Hola ${pedido.recibe_nombre}, te va a llegar material de Tuval (pedido ${pedido.folio}). Aquí ves cómo va la entrega y confirmas lo que recibas: ${ligaReceptor}`,
          )}
          target="_blank"
          className="mt-4 block rounded-xl bg-cian p-4 text-center font-bold text-profundo"
        >
          Enviar acceso de entrega a {pedido.recibe_nombre}
        </a>
      )}

      <p className="mt-6 text-xs text-acero">Guarda esta liga para ver cómo va tu pedido.</p>
    </>
  );
}
