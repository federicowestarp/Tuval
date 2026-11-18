import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { demandaPorEstado, ligaWhatsApp, listarPedidos, lugar, pasoActual, tiempoDesde, type VistaPedidos } from "@/lib/pedidos";
import { Transcurrido } from "./Transcurrido";
import { PLAZOS, pendientesSeguimiento } from "@/lib/seguimiento";
import { NOMBRE_INTERNO, SIGUIENTE } from "@/lib/estados";
import { describirPromesa } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { cambiarEstado, reconfirmarProveedor, registrarRecordatorio } from "./acciones";
import { Cancelar } from "./Cancelar";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../Navegacion";

export default function PanelPedidos(props: PageProps<"/interno/pedidos">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="pedidos" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<Esqueleto />}>
          <Lista searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

const VISTAS: { id: VistaPedidos; texto: string }[] = [
  { id: "proceso", texto: "En proceso" },
  { id: "cerrados", texto: `Entregados y cancelados (${PLAZOS.archivarCerradoDias} días)` },
  { id: "archivo", texto: "Archivo" },
];

async function Lista({ searchParams }: { searchParams: PageProps<"/interno/pedidos">["searchParams"] }) {
  await connection(); // siempre en vivo, nunca prerenderizado
  await requerirInterno("operador");
  const sp = await searchParams;
  const vista = VISTAS.find((v) => v.id === sp.vista)?.id ?? "proceso";
  const [pedidos, porEstado, seg] = await Promise.all([listarPedidos(vista), demandaPorEstado(), pendientesSeguimiento()]);
  const pestanas = (
    <nav className="flex flex-wrap gap-1 rounded-full bg-white p-1 text-[14px] font-semibold">
      {VISTAS.map((v) => (
        <Link key={v.id} href={`/interno/pedidos?vista=${v.id}`} className={`rounded-full px-3.5 py-1.5 ${v.id === vista ? "bg-azul text-white" : "text-secundario hover:text-azul"}`}>{v.texto}</Link>
      ))}
    </nav>
  );
  const totalSeg = seg.porRecordar.length + seg.vencidas.length + seg.reconfirmar.length;
  const seguimiento = vista === "proceso" && totalSeg > 0 && (
    <section className="space-y-3 rounded-[20px] bg-white p-4">
      <p className="font-semibold">Seguimiento de cotizaciones <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] text-amber-800">{totalSeg}</span></p>
      {seg.porRecordar.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-niebla px-3 py-2 text-[14px]">
          <span><Link href={`/interno/pedidos/${x.id}`} className="font-semibold text-azul">{x.folio}</Link> · {x.contacto_nombre} · {formatoMoneda(x.total)} · sin respuesta hace {x.horas} h {x.recordatorios === 1 && "· 2.º recordatorio"}</span>
          <span className="flex gap-2">
            {x.contacto_telefono && <a target="_blank" href={ligaWhatsApp(x.contacto_telefono, `Hola ${x.contacto_nombre ?? ""}, te escribimos de Tuval por tu cotización ${x.folio} de ${formatoMoneda(x.total)}. ¿La confirmamos para surtirte? Los precios y existencias se mantienen hasta ${PLAZOS.venceDias} días.`)} className="rounded-full border border-azul px-3 py-1 font-semibold text-azul">WhatsApp</a>}
            <form action={registrarRecordatorio}><input type="hidden" name="id" value={x.id} /><button className="rounded-full bg-azul px-3 py-1 font-semibold text-white">Ya le escribí</button></form>
          </span>
        </div>
      ))}
      {seg.reconfirmar.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-niebla px-3 py-2 text-[14px]">
          <span><Link href={`/interno/pedidos/${x.id}`} className="font-semibold text-azul">{x.folio}</Link> · cotización del proveedor de hace {x.horas} h: <strong>reconfirma existencias y precio</strong> antes de comprar</span>
          <form action={reconfirmarProveedor}><input type="hidden" name="id" value={x.id} /><button className="rounded-full bg-azul px-3 py-1 font-semibold text-white">Ya reconfirmé</button></form>
        </div>
      ))}
      {seg.vencidas.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-niebla px-3 py-2 text-[14px]">
          <span><Link href={`/interno/pedidos/${x.id}`} className="font-semibold text-azul">{x.folio}</Link> · {x.contacto_nombre} · cotización <strong className="text-red-700">vencida</strong> ({Math.floor(x.horas / 24)} días sin aceptar)</span>
          <form action={cambiarEstado}>
            <input type="hidden" name="id" value={x.id} /><input type="hidden" name="estado" value="cancelado" /><input type="hidden" name="motivo" value="Cliente no respondió" />
            <button className="rounded-full border border-secundario px-3 py-1 text-secundario">Cerrar: no respondió</button>
          </form>
        </div>
      ))}
    </section>
  );
  const resumen = porEstado.length > 0 && (
    <section className="rounded-[20px] bg-white p-4">
      <p className="font-semibold">De dónde nos piden <span className="text-[13px] font-normal text-secundario">· últimos 90 días</span></p>
      <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
        {porEstado.map((e) => (
          <span key={e.entidad} className="rounded-full bg-niebla px-3 py-1">{e.entidad}: {e.pedidos} pedido{e.pedidos === 1 ? "" : "s"}{e.contactos > 0 && ` · ${e.contactos} contacto${e.contactos === 1 ? "" : "s"}`}</span>
        ))}
      </div>
    </section>
  );
  if (pedidos.length === 0) return <div className="space-y-3">{pestanas}{seguimiento}{resumen}<p className="rounded-xl bg-white p-6">{vista === "archivo" ? "El archivo está vacío." : "No hay pedidos."}</p></div>;

  return (
    <div className="space-y-3">
      {pestanas}
      {seguimiento}
      {resumen}
      {pedidos.map((p) => {
        const siguiente = SIGUIENTE[p.estado];
        const paso = pasoActual(p);
        const cerrado = ["entregado", "entregado_con_faltantes", "cancelado"].includes(p.estado);
        return (
          <article key={p.id} className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-semibold">
                <Link href={`/interno/pedidos/${p.id}`} className="text-azul underline">{p.folio}</Link>
                <span className="ml-2 rounded-full bg-piedra px-2 py-0.5 text-xs text-tinta">{NOMBRE_INTERNO[p.estado]}</span>
                {!p.confirmado_en && <span className="ml-2 rounded-full bg-cian px-2 py-0.5 text-xs text-sobrecian">Por confirmar</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                <span className="text-secundario">Llegó hace <strong className="text-tinta"><Transcurrido desde={new Date(p.creado_en).toISOString()} inicial={tiempoDesde(p.creado_en)} /></strong></span>
                {!cerrado && paso.paso !== "Llegó" && (
                  <span className="rounded-full bg-[#E8F1FB] px-2 text-azul">{paso.paso} · hace <strong><Transcurrido desde={paso.desde} inicial={tiempoDesde(paso.desde)} /></strong></span>
                )}
                {!cerrado && paso.paso === "Llegó" && <span className="rounded-full bg-amber-50 px-2 text-amber-800">Sin atender</span>}
              </p>
              <p className="mt-1 text-sm">
                {p.contacto_nombre} · {p.contacto_telefono} · {lugar(p)} · {p.tipo_entrega}
                {p.sin_recepcion_solicitada && " · sin recepción"}
              </p>
              <p className="text-sm text-secundario">{p.direccion_entrega}</p>
              <p className="mt-1 text-xs text-secundario">
                {p.entrega_fecha && p.entrega_ventana ? describirPromesa({ fecha: p.entrega_fecha, ventana: p.entrega_ventana }) : p.zona === "otro" ? "Envío foráneo: fecha por confirmar" : "Recoger"} · {p.piezas} pzas
                {p.especiales > 0 && ` · ${p.especiales} por buscar`}
                {p.adjuntos > 0 && ` · ${p.adjuntos} lista(s) adjunta(s)`}
                {" · "}{p.confirmado_en ? formatoMoneda(p.total) : p.sin_precio > 0 ? `${p.sin_precio} sin precio` : "sin confirmar"} · {p.comprobante}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/interno/pedidos/${p.id}`} className="rounded-lg border border-azul px-3 py-2 text-sm font-semibold text-azul">Abrir</Link>
              {siguiente === "comprado_proveedor" && p.reconfirmar ? (
                <form action={reconfirmarProveedor}>
                  <input type="hidden" name="id" value={p.id} />
                  <button title={`La cotización del proveedor tiene más de ${PLAZOS.reconfirmarHoras} h`} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Ya reconfirmé con proveedor</button>
                </form>
              ) : siguiente && (
                <form action={cambiarEstado}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="estado" value={siguiente} />
                  <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">→ {NOMBRE_INTERNO[siguiente]}</button>
                </form>
              )}
              {p.estado !== "entregado" && p.estado !== "entregado_con_faltantes" && p.estado !== "cancelado" && (
                <Cancelar id={p.id} />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
