import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Marco } from "@/components/marco/Marco";
import { VaciarCarrito } from "@/components/carrito/VaciarCarrito";
import { ListaProductosPedido } from "@/components/ListaProductosPedido";
import { Progreso } from "@/components/Progreso";
import { EnCamino } from "@/components/EnCamino";
import { IconoChat, IconoPin } from "@/components/Iconos";
import { clasesBoton } from "@/components/ui";
import { obtenerPedido, ligaWhatsApp, lugar } from "@/lib/pedidos";
import { etapaCliente } from "@/lib/estados";
import { describirPromesa } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { urlBase } from "@/lib/url";
import { PLAZOS, vigencia } from "@/lib/seguimiento";
import { Aceptar } from "./Aceptar";
import { CompartirRecoger } from "./CompartirRecoger";
import QRCode from "qrcode";
import { urlPanel } from "@/lib/etiqueta";

export default function SeguimientoPedido(props: PageProps<"/pedido/[id]">) {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[20px] bg-niebla" />}>
          <Contenido params={props.params} searchParams={props.searchParams} />
        </Suspense>
      </main>
    </Marco>
  );
}

async function Contenido({ params, searchParams }: Pick<PageProps<"/pedido/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const nuevo = (await searchParams).nuevo === "1";
  const pedido = await obtenerPedido(id);
  if (!pedido) notFound();

  const actual = etapaCliente(pedido.estado);
  const porConfirmar = !pedido.confirmado_en;
  const vencida = pedido.estado === "recibido" && !!pedido.confirmado_en && !pedido.aceptado_en &&
    (await vigencia(pedido.id)).vencida;
  const recoger = pedido.tipo_entrega === "recoger";
  // Para recoger no hay "en ruta": en cuanto el material está en sucursal, está listo para recoger con su QR.
  const listoRecoger = recoger && (pedido.estado === "surtido" || pedido.estado === "en_ruta");
  const qrRecoger = listoRecoger ? await QRCode.toString(urlPanel(`/interno/recoger/${pedido.token_receptor}`), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const titulo =
    actual === -1 ? "Pedido cancelado." :
    listoRecoger ? "Listo para recoger." :
    pedido.estado === "entregado_con_faltantes" ? "Entregado con faltantes." :
    actual === 3 ? "Entregado." :
    actual === 2 ? "Va en camino." :
    actual === 1 ? "Preparando tu pedido." :
    nuevo ? "¡Listo! Recibimos tu pedido." : "Pedido recibido.";
  const sub =
    pedido.estado === "entregado_con_faltantes" ? "Ya estamos resolviendo lo que faltó." :
    actual === 0 && porConfirmar ? "Estamos confirmando precios y existencias. Te escribimos por WhatsApp." : null;

  const otraPersonaRecibe = pedido.recibe_telefono && pedido.recibe_telefono !== pedido.contacto_telefono;
  const ligaReceptor = `${await urlBase()}/entrega/${pedido.token_receptor}`;

  return (
    <div className="space-y-8">
      {nuevo && <VaciarCarrito />}
      <div>
        <p className="text-[13px] font-medium text-secundario">
          {pedido.folio} · {pedido.tipo_entrega === "obra" ? "Obra" : pedido.tipo_entrega === "recoger" ? "Recoger" : "Domicilio"}
          {pedido.zona && ` · ${lugar(pedido)}`}
        </p>
        <h1 className="mt-1 font-display text-[34px] font-semibold leading-tight">{titulo}</h1>
        {sub && <p className="mt-2 text-[17px] text-secundario">{sub}</p>}
      </div>

      {vencida && (
        <div className="rounded-[20px] bg-niebla p-5">
          <p className="font-semibold">Esta cotización venció</p>
          <p className="mt-1 text-[15px] text-secundario">Los precios y existencias se respetan {PLAZOS.venceDias} días. Escríbenos y te la reconfirmamos hoy.</p>
        </div>
      )}

      {actual >= 0 && <Progreso actual={listoRecoger ? 2 : actual} recoger={recoger} recuerdo={String(pedido.id)} />}

      {listoRecoger && qrRecoger && (
        <div className="flex flex-col items-center gap-3 rounded-[24px] bg-[#E8F1FB] p-6 text-center">
          <p className="text-[18px] font-semibold">Enseña este código en caja</p>
          <div className="h-56 w-56 rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrRecoger }} />
          <p className="font-mono text-[15px] font-semibold text-azul">{pedido.folio}</p>
          <p className="text-[14px] text-secundario">Tu material ya está en la sucursal. Revisas las piezas con nosotros, firmas y listo.</p>
          <CompartirRecoger pedidoId={pedido.id} folio={pedido.folio} inicial={pedido.recibe_nombre && pedido.recibe_nombre !== pedido.contacto_nombre ? pedido.recibe_nombre : ""} />
        </div>
      )}

      {pedido.estado === "recibido" && pedido.confirmado_en && !pedido.aceptado_en && !vencida && <Aceptar pedidoId={pedido.id} />}

      {!recoger && <EnCamino pedidoId={pedido.id} estado={pedido.estado} />}

      {actual >= 0 && actual < 3 && pedido.entrega_fecha && pedido.entrega_ventana && (
        <div className="rounded-[20px] bg-niebla p-5">
          <p className="text-[13px] text-secundario">Llega</p>
          <p className="text-xl font-semibold">{describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana }).replace(/^Llega /, "").replace(/^./, (c) => c.toUpperCase())}</p>
          {porConfirmar && <p className="mt-1 text-[13px] text-secundario">Sujeto a confirmar existencias</p>}
        </div>
      )}

      {actual >= 0 && actual < 3 && pedido.zona === "otro" && (
        <div className="rounded-[20px] bg-niebla p-5">
          <p className="text-[13px] text-secundario">Envío a {pedido.entidad ?? "tu estado"}</p>
          <p className="text-xl font-semibold">{pedido.confirmado_en ? "Te confirmamos la fecha por WhatsApp" : "Te confirmamos fecha y costo de envío"}</p>
        </div>
      )}

      {pedido.direccion_entrega && (
        <div className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-niebla text-azul"><IconoPin className="h-5 w-5" /></span>
          <div className="text-[15px]">
            <p className="font-semibold">{pedido.direccion_entrega}</p>
            <p className="text-secundario">Recibe {pedido.recibe_nombre} · {pedido.recibe_telefono}</p>
            {pedido.sin_recepcion_solicitada && <p className="text-secundario">Se puede dejar sin recepción, con foto.</p>}
          </div>
        </div>
      )}

      {otraPersonaRecibe && actual >= 0 && actual < 3 && (
        <a
          href={ligaWhatsApp(pedido.recibe_telefono!, `Hola ${pedido.recibe_nombre}, te va a llegar material de Tuval (pedido ${pedido.folio}). Aquí ves cuándo llega y confirmas lo que recibas: ${ligaReceptor}`)}
          target="_blank"
          className={clasesBoton("principal", "grande", true)}
        >
          <IconoChat className="h-5 w-5" /> Compartir entrega con {pedido.recibe_nombre?.split(" ")[0]}
        </a>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl font-semibold">Productos</h2>
        <ListaProductosPedido pedido={pedido} />
        <div className="mt-4 flex items-baseline justify-between border-t border-linea pt-4">
          <span className="text-secundario">{pedido.comprobante === "factura" ? "Total con factura" : "Total"}</span>
          {porConfirmar ? (
            <span className="text-[15px] text-secundario">Por confirmar</span>
          ) : (
            <span className="font-display text-2xl font-semibold">{formatoMoneda(pedido.total)}</span>
          )}
        </div>
      </section>

      <p className="text-center text-[13px] text-secundario">Guarda esta página para ver tu pedido. También está en Pedidos.</p>
    </div>
  );
}
