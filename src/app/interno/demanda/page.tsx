import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { listarDemanda } from "@/lib/interno";
import { requerirInterno } from "@/lib/equipo";
import { NavegacionInterna } from "../Navegacion";
import { actualizarSolicitud, avisarCliente } from "./acciones";
import { FormAlta } from "./FormAlta";
import { BotonWhatsApp } from "../pedidos/[id]/BotonWhatsApp";
import { sql } from "@/lib/db";

const ORIGEN: Record<string, string> = {
  cliente_fuera_catalogo: "Cliente: no está en catálogo",
  proveedor_sin_existencia: "Proveedor sin existencia",
  lista_cliente: "Lista del cliente",
  interno: "Interno",
  mostrador: "Mostrador",
  buscador_tienda: "Buscador de la tienda",
};
const ESTADOS: [string, string][] = [
  ["nueva", "Nueva"], ["buscando", "Buscando"], ["conseguida", "Conseguida"],
  ["agregada_catalogo", "En catálogo"], ["no_conseguible", "No se consigue"],
];

export default function Demanda(props: PageProps<"/interno/demanda">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="demanda" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Demanda no surtida</h1>
        <p className="text-sm text-secundario">Lo que nos piden y no tenemos. Ordenado por cuántas veces lo han pedido.</p>
        <Suspense fallback={<p className="mt-4 text-sm text-secundario">Cargando…</p>}>
          <Lista searchParams={props.searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Lista({ searchParams }: { searchParams: PageProps<"/interno/demanda">["searchParams"] }) {
  await connection();
  await requerirInterno("operador");
  const sp = await searchParams;
  const estado = typeof sp.estado === "string" && ESTADOS.some(([e]) => e === sp.estado) ? sp.estado : undefined;
  const [grupos, uso] = await Promise.all([
    listarDemanda(estado),
    sql<{ origen: string; total: number; sin: number }[]>`
      select origen, count(*)::int total, count(*) filter (where con_existencia = 0)::int sin
      from busquedas_tienda where creado_en > now() - interval '30 days' group by origen order by total desc`,
  ]);
  const totalBusquedas = uso.reduce((a, x) => a + x.total, 0);
  const ORIGEN_BUSQUEDA: Record<string, string> = { web: "Sitio", letrero: "Letrero (celular)", recepcion: "Tablet de recepción", vendedor: "Tablet de vendedor" };

  return (
    <>
      {totalBusquedas > 0 && (
        <section className="mt-4 rounded-xl bg-white p-4 text-sm">
          <p className="font-semibold">Buscador de la tienda · últimos 30 días: {totalBusquedas} búsquedas</p>
          <p className="text-secundario">{uso.map((x) => `${ORIGEN_BUSQUEDA[x.origen] ?? x.origen}: ${x.total} (${Math.round((x.sin / x.total) * 100)}% sin existencia)`).join(" · ")}</p>
        </section>
      )}
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/interno/demanda" className={`rounded-full px-3 py-1 ${!estado ? "bg-azul text-white" : "bg-white"}`}>Abiertas</Link>
        {ESTADOS.map(([e, n]) => (
          <Link key={e} href={`/interno/demanda?estado=${e}`} className={`rounded-full px-3 py-1 ${estado === e ? "bg-azul text-white" : "bg-white"}`}>{n}</Link>
        ))}
      </nav>
      {grupos.length === 0 && <p className="mt-4 rounded-xl bg-white p-6">Nada por aquí.</p>}
      <div className="mt-4 space-y-3">
        {grupos.map((g) => (
          <article key={g.ids[0]} className="rounded-xl bg-white p-4">
            <p className="font-semibold">
              {g.descripcion}
              <span className="ml-2 rounded-full bg-niebla px-2 py-0.5 text-xs text-tinta">
                {g.veces} {g.veces === 1 ? "vez" : "veces"} · {g.clientes} cliente{g.clientes === 1 ? "" : "s"}
              </span>
            </p>
            <p className="text-xs text-secundario">
              {g.cantidad_total != null && `${g.cantidad_total} piezas en total · `}
              {g.origenes.map((o) => ORIGEN[o]).join(" / ")} · último {new Date(g.ultima).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
              {g.pedidos.length > 0 && " · "}
              {g.pedidos.slice(0, 6).map((p, i) => (
                <span key={p.id}>{i > 0 && ", "}<Link href={`/interno/pedidos/${p.id}`} className="underline">{p.folio}</Link></span>
              ))}
            </p>
            <form action={actualizarSolicitud} className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto]">
              <input type="hidden" name="ids" value={g.ids.join(",")} />
              <select name="estado" defaultValue={g.estado} className="rounded-lg border border-linea px-2 py-2 text-sm">
                {ESTADOS.map(([e, n]) => <option key={e} value={e}>{n}</option>)}
              </select>
              <input name="proveedor_alterno" defaultValue={g.proveedor_alterno ?? ""} placeholder="¿Quién lo vende?" className="rounded-lg border border-linea px-2 py-2 text-sm" />
              <input name="notas" defaultValue={g.notas ?? ""} placeholder="Notas (precio, tiempo, marca…)" className="rounded-lg border border-linea px-2 py-2 text-sm" />
              <button className="rounded-lg bg-azul px-3 py-2 text-sm font-semibold text-white">Guardar</button>
            </form>
            {g.contactos.length > 0 && (
              <div className={`mt-2 rounded-lg p-2 text-sm ${g.hay_existencia || g.estado === "conseguida" || g.estado === "agregada_catalogo" ? "bg-emerald-50" : "bg-niebla"}`}>
                <p className="font-semibold">
                  {g.hay_existencia || g.estado === "conseguida" || g.estado === "agregada_catalogo" ? "Ya lo tenemos: avisa a quien lo pidió" : "Dejaron su celular para que les avisemos"}
                  <span className="ml-1 font-normal text-secundario">({g.contactos.filter((c) => !c.avisado).length} por avisar)</span>
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {g.contactos.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span>{c.nombre && !/^cliente /i.test(c.nombre) ? c.nombre : c.telefono}</span>
                      {c.avisado ? <span className="text-emerald-700">avisado ✓</span> : <BotonWhatsApp accion={avisarCliente} id={c.id} texto="Avisar" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {g.estado !== "agregada_catalogo" && <div className="mt-2"><FormAlta ids={g.ids} descripcion={g.descripcion} /></div>}
          </article>
        ))}
      </div>
    </>
  );
}
