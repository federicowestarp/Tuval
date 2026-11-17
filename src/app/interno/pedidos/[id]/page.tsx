import { Esqueleto } from "@/components/interno/Esqueleto";
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
import { cambiarEstado, clienteAcepto, cotizacionSolicitada, reconfirmarProveedor, registrarCobro, surtirDeSucursal } from "../acciones";
import { PLAZOS, vigencia } from "@/lib/seguimiento";
import { Cancelar } from "../Cancelar";
import { sql } from "@/lib/db";
import { agregarRenglonesAlPedido, asignarRenglon } from "./acciones";
import { FormConfirmar, FormCotizacion } from "./Formularios";

export default function DetallePedido(props: PageProps<"/interno/pedidos/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="pedidos" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}>
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
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Todo en paralelo: una sola espera a la base.
  const [pedido, comparacion, sueltos, base, cotizacionId, cobros, [stock], vig] = await Promise.all([
    obtenerPedido(id), compararPedido(id), renglonesSinAsignar(id), urlBase(), ultimaCotizacion(id),
    sql<{ id: string; fecha: string; forma: string; monto: number; referencia_pasarela: string | null }[]>`
    select id, to_char(pagado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY') fecha, forma, monto::float monto, referencia_pasarela
    from pagos where pedido_id = ${id} order by pagado_en`,
    sql<{ alcanza: boolean; lineas: number }[]>`
    select count(*)::int lineas, coalesce(bool_and(coalesce(e.cantidad, 0) >= pp.cantidad), false) alcanza
    from pedido_partidas pp left join existencias e on e.producto_id = pp.producto_id
      and e.almacen_id = (select id from almacenes where tipo = 'sucursal' and activo order by creado_en limit 1)
    where pp.pedido_id = ${id}`,
    vigencia(id),
  ]);
  if (!pedido) notFound();
  const siguiente = SIGUIENTE[pedido.estado];
  const bloqueadoCompra = siguiente === "comprado_proveedor" && vig.reconfirmar;
  const hora = (d: Date | null) => d ? new Date(d).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
  const abierto = !["entregado", "entregado_con_faltantes", "cancelado"].includes(pedido.estado);
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
          {bloqueadoCompra ? (
            <form action={reconfirmarProveedor}>
              <input type="hidden" name="id" value={pedido.id} />
              <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Ya reconfirmé con proveedor</button>
            </form>
          ) : siguiente && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={pedido.id} />
              <input type="hidden" name="estado" value={siguiente} />
              <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">→ {NOMBRE_INTERNO[siguiente]}</button>
            </form>
          )}
          {!["entregado", "entregado_con_faltantes", "cancelado"].includes(pedido.estado) && <Cancelar id={pedido.id} />}
        </div>
      </div>

      {pedido.estado === "cancelado" && pedido.motivo_cancelacion && <p className="rounded-xl bg-white p-3 text-sm">Motivo de cancelación: <strong>{pedido.motivo_cancelacion}</strong></p>}

      {pedido.estado === "recibido" && (vig.reconfirmar || vig.vencida) && (
        <section className="rounded-xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          {vig.vencida && <p><strong>Cotización al cliente vencida:</strong> lleva {vig.diasCliente} días sin aceptar (vence a los {PLAZOS.venceDias}). Reconfirma con el proveedor y vuelve a mandarle el total, o ciérrala como “Cliente no respondió”.</p>}
          {vig.reconfirmar && <p><strong>Reconfirma existencias y precio con el proveedor:</strong> su cotización tiene {vig.horasProveedor} h (máximo {PLAZOS.reconfirmarHoras} h para comprar).</p>}
        </section>
      )}

      {abierto && (
        <section className={`${caja} flex flex-wrap items-center gap-2 text-sm`}>
          <span className="font-semibold">Avance:</span>
          {pedido.cotizacion_solicitada_en ? <span className="rounded-full bg-niebla px-3 py-1">Cotización pedida {hora(pedido.cotizacion_solicitada_en)}</span> : pedido.estado === "recibido" && (
            <form action={cotizacionSolicitada}><input type="hidden" name="id" value={pedido.id} /><button className="rounded-full border border-azul px-3 py-1 font-semibold text-azul">Ya pedí cotización al proveedor</button></form>
          )}
          {pedido.confirmado_en && (pedido.aceptado_en ? <span className="rounded-full bg-niebla px-3 py-1">Cliente aceptó {hora(pedido.aceptado_en)}</span> : (
            <form action={clienteAcepto}><input type="hidden" name="id" value={pedido.id} /><button className="rounded-full border border-azul px-3 py-1 font-semibold text-azul">Cliente aceptó</button></form>
          ))}
          {pedido.estado === "recibido" && pedido.confirmado_en && stock.lineas > 0 && stock.alcanza && (
            <form action={surtirDeSucursal}><input type="hidden" name="id" value={pedido.id} /><button className="rounded-full bg-azul px-3 py-1 font-semibold text-white">Surtir desde sucursal (hay existencia)</button></form>
          )}
        </section>
      )}

      <section className={caja}>
        <h2 className="font-semibold">Cobros</h2>
        {cobros.length === 0 ? <p className="text-sm text-secundario">Sin cobros registrados.</p> : (
          <ul className="text-sm">{cobros.map((c) => <li key={c.id}>{c.fecha} · {c.forma} · <strong>{formatoMoneda(c.monto)}</strong>{c.referencia_pasarela && ` · ${c.referencia_pasarela}`}</li>)}</ul>
        )}
        {pedido.confirmado_en && <p className="mt-1 text-sm text-secundario">Por cobrar: {formatoMoneda(Math.max(0, pedido.total - cobros.reduce((a, c) => a + c.monto, 0)))}</p>}
        <form action={registrarCobro} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={pedido.id} />
          <input name="monto" inputMode="decimal" placeholder="Monto" required className="w-32 rounded-lg border border-linea px-3 py-2 text-sm" />
          <select name="forma" className="rounded-lg border border-linea px-3 py-2 text-sm"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="credito">Crédito</option></select>
          <input name="referencia" placeholder="Referencia (opcional)" className="w-44 rounded-lg border border-linea px-3 py-2 text-sm" />
          <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">Registrar cobro</button>
        </form>
      </section>

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
