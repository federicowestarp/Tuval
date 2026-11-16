import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { obtenerPedido, ligaWhatsApp, ligaMapa, lugar } from "@/lib/pedidos";
import { compararPedido, renglonesSinAsignar, ultimaCotizacion } from "@/lib/interno";
import { NOMBRE_INTERNO, SIGUIENTE } from "@/lib/estados";
import { describirPromesa } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { urlArchivo } from "@/lib/url-archivo";
import { urlBase } from "@/lib/url";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../../Navegacion";
import { cambiarEstado } from "../acciones";
import { agregarRenglonesAlPedido, asignarRenglon } from "./acciones";
import { FormConfirmar, FormCotizacion } from "./Formularios";

export default function DetallePedido(props: PageProps<"/interno/pedidos/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="pedidos" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}>
          <Contenido params={props.params} />
        </Suspense>
      </main>
    </div>
  );
}

const caja = "rounded-xl bg-white p-4";

async function Contenido({ params }: Pick<PageProps<"/interno/pedidos/[id]">, "params">) {
  await connection();
  await requerirInterno("operador");
  const { id } = await params;
  const pedido = await obtenerPedido(id);
  if (!pedido) notFound();
  const [comparacion, sueltos, base, cotizacionId] = await Promise.all([compararPedido(id), renglonesSinAsignar(id), urlBase(), ultimaCotizacion(id)]);
  const siguiente = SIGUIENTE[pedido.estado];
  const ligaCliente = `${base}/pedido/${pedido.id}`;
  const promesa = pedido.entrega_fecha && pedido.entrega_ventana ? describirPromesa({ fecha: pedido.entrega_fecha, ventana: pedido.entrega_ventana }) : pedido.zona === "otro" ? `Envío a ${pedido.entidad ?? "otro estado"}: fecha y costo por confirmar` : "Recoger";
  const pendientes = pedido.especiales.filter((e) => e.estado === "nueva" || e.estado === "buscando");
  const mensajeConfirmacion =
    `Hola ${pedido.contacto_nombre}, tu pedido ${pedido.folio} de Tuval está confirmado. ` +
    `Total: ${formatoMoneda(pedido.total)} (IVA incluido). ${promesa}.` +
    (pendientes.length ? ` Seguimos buscando: ${pendientes.map((e) => e.descripcion).join(", ")}.` : "") +
    ` Seguimiento: ${ligaCliente}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {pedido.folio} <span className="ml-2 rounded-full bg-piedra px-2 py-0.5 align-middle text-sm text-tinta">{NOMBRE_INTERNO[pedido.estado]}</span>
          </h1>
          <p className="text-sm text-secundario">
            {promesa} · {pedido.comprobante} · {pedido.confirmado_en ? `confirmado · ${formatoMoneda(pedido.total)}` : "por confirmar"}
          </p>
        </div>
        <div className="flex gap-2">
          {siguiente && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={pedido.id} />
              <input type="hidden" name="estado" value={siguiente} />
              <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">→ {NOMBRE_INTERNO[siguiente]}</button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={caja}>
          <h2 className="font-semibold">Cliente</h2>
          <p className="text-sm">{pedido.contacto_nombre} · {pedido.contacto_telefono}</p>
          <a href={ligaWhatsApp(pedido.contacto_telefono, `Hola ${pedido.contacto_nombre}, te escribimos de Tuval por tu pedido ${pedido.folio}.`)} target="_blank" className="text-sm text-azul underline">WhatsApp al cliente</a>
          {pedido.notas && <p className="mt-2 text-sm">Notas: {pedido.notas}</p>}
        </section>
        <section className={caja}>
          <h2 className="font-semibold">Entrega {pedido.zona && `· ${lugar(pedido)}`}</h2>
          <div className="mt-1 flex gap-3">
            {pedido.foto_fachada_id && (
              <a href={urlArchivo(pedido.foto_fachada_id)} target="_blank">
                {/* eslint-disable-next-line @next/next/no-img-element -- archivo propio */}
                <img src={urlArchivo(pedido.foto_fachada_id)} alt="Fachada" className="h-20 w-20 rounded-md object-cover" />
              </a>
            )}
            <div className="text-sm">
              <p>{pedido.direccion_entrega ?? "Recoger en sucursal"}</p>
              <p>Recibe: {pedido.recibe_nombre} · {pedido.recibe_telefono} · prefiere {pedido.preferencia_contacto === "telefono" ? "llamada" : "WhatsApp"}</p>
              {pedido.sin_recepcion_solicitada && <p className="font-semibold">Se puede dejar sin recepción (foto obligatoria)</p>}
              {pedido.lat != null && pedido.lng != null && (
                <a href={ligaMapa(pedido.lat, pedido.lng)} target="_blank" className="text-azul underline">Abrir ubicación en mapa</a>
              )}
            </div>
          </div>
        </section>
      </div>

      {(pedido.adjuntos.length > 0 || pedido.especiales.length > 0) && (
        <section className={caja}>
          <h2 className="font-semibold">Para capturar o buscar</h2>
          {pedido.adjuntos.map((a) => (
            <p key={a.archivo_id} className="text-sm">
              <a href={urlArchivo(a.archivo_id)} target="_blank" className="text-azul underline">📄 {a.nombre}</a> — lista del cliente: captúrala como partidas.
            </p>
          ))}
          {pedido.especiales.map((e) => (
            <p key={e.id} className="text-sm">
              {e.cantidad} × {e.descripcion} <span className="rounded-full bg-piedra px-2 text-xs">{e.estado}</span>
            </p>
          ))}
          <Link href="/interno/demanda" className="mt-2 inline-block text-sm text-azul underline">Gestionar en Demanda →</Link>
        </section>
      )}

      <section className={caja}>
        <h2 className="font-semibold">1 · Cotización de Emmsa</h2>
        <FormCotizacion pedidoId={pedido.id} />
        {sueltos.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{sueltos.length} renglón(es) de la cotización no están en el pedido</p>
              <form action={agregarRenglonesAlPedido}>
                <input type="hidden" name="pedido_id" value={pedido.id} />
                <button className="rounded-full bg-azul px-4 py-2 text-sm font-semibold text-white">Agregarlos todos al pedido</button>
              </form>
            </div>
            <p className="text-xs text-secundario">Útil cuando el pedido llegó en foto o lista: se dan de alta como “por clasificar” con su código de Emmsa. O asigna uno por uno:</p>
            {sueltos.map((s) => (
              <form key={s.id} action={asignarRenglon} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="pedido_id" value={pedido.id} />
                <input type="hidden" name="renglon_id" value={s.id} />
                <span>{s.codigo_proveedor} · {s.descripcion} · {formatoMoneda(s.precio_unitario)}</span>
                <select name="partida_id" className="rounded-lg border border-linea px-2 py-1">
                  {pedido.partidas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <button className="rounded-lg border border-azul px-3 py-1 text-azul">Asignar</button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className={caja}>
        <h2 className="mb-2 font-semibold">2 · Comparar y confirmar</h2>
        {comparacion.length > 0 ? (
          <FormConfirmar
            // Se reinicia cuando cambia la cotización, para pre-marcar lo que Emmsa no tiene.
            key={cotizacionId ?? "sin-cotizacion"}
            pedidoId={pedido.id}
            renglones={comparacion}
            confirmado={!!pedido.confirmado_en}
          />
        ) : (
          <p className="text-sm text-secundario">El pedido no tiene partidas de catálogo todavía.</p>
        )}
      </section>

      {pedido.confirmado_en && (
        <section className={caja}>
          <h2 className="font-semibold">3 · Avisar al cliente</h2>
          <p className="mt-1 rounded-lg bg-niebla p-3 text-sm">{mensajeConfirmacion}</p>
          <a href={ligaWhatsApp(pedido.contacto_telefono, mensajeConfirmacion)} target="_blank" className="mt-2 inline-block rounded-full bg-azul px-4 py-2 font-semibold text-white">
            Enviar por WhatsApp
          </a>
        </section>
      )}
    </>
  );
}
