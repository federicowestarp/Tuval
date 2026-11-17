import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { paramLealtad } from "@/lib/lealtad";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { pesos } from "@/components/interno/Indicadores";
import { campo } from "@/components/ui";
import { NavegacionInterna } from "../Navegacion";
import { crearCliente, guardarRecomendados } from "./acciones";

export default function Clientes(props: PageProps<"/interno/clientes">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="clientes" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Clientes</h1>
        <Suspense fallback={null}><ProgramaRecomendados /></Suspense>
        <Suspense fallback={<Esqueleto />}><Contenido searchParams={props.searchParams} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/clientes">["searchParams"] }) {
  await connection();
  await requerirInterno("operador");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filtro = sp.ver === "credito" ? sql`and c.credito_activo` : sp.ver === "saldo" ? sql`and saldo.saldo > 0` : sql``;
  const palabras = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
  const filas = await sql<{ id: string; nombre: string; razon_social: string | null; telefono: string | null; desde: string; pedidos: number; comprado: number; ultima: string | null; saldo: number; credito: boolean; lista: string | null; puntos: number }[]>`
    with saldo as (
      select p.cliente_id, sum(p.total - coalesce((select sum(monto) from pagos g where g.pedido_id = p.id and g.estado = 'confirmado'), 0)) saldo
      from pedidos p where p.a_credito and p.estado <> 'cancelado' group by 1
    )
    select c.id, c.nombre, c.razon_social, c.telefono, to_char(c.creado_en, 'YYYY-MM-DD') desde,
           (select count(*)::int from pedidos p where p.cliente_id = c.id and p.estado <> 'cancelado') pedidos,
           coalesce((select sum(total) from pedidos p where p.cliente_id = c.id and p.estado in ('entregado', 'entregado_con_faltantes')), 0)::float comprado,
           (select to_char(max(creado_en), 'YYYY-MM-DD') from pedidos p where p.cliente_id = c.id) ultima,
           coalesce(saldo.saldo, 0)::float saldo, c.credito_activo credito, l.nombre lista,
           coalesce((select sum(puntos) from movimientos_puntos m where m.cliente_id = c.id), 0)::int puntos
    from clientes c left join saldo on saldo.cliente_id = c.id left join listas_precio l on l.id = c.lista_precio_id
    where c.activo ${filtro}
      ${palabras.map((w) => sql`and unaccent(lower(c.nombre || ' ' || coalesce(c.razon_social, '') || ' ' || coalesce(c.rfc, '') || ' ' || coalesce(c.telefono, ''))) like unaccent(${"%" + w + "%"})`).reduce((a, b) => sql`${a} ${b}`, sql``)}
    order by (select max(creado_en) from pedidos p where p.cliente_id = c.id) desc nulls last, c.nombre
    limit 100`;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Nombre, razón social, RFC o teléfono" className="h-10 flex-1 rounded-full border border-linea bg-white px-4" />
          <select name="ver" defaultValue={typeof sp.ver === "string" ? sp.ver : ""} className="h-10 rounded-full border border-linea bg-white px-3"><option value="">Todos</option><option value="credito">Con crédito</option><option value="saldo">Con saldo</option></select>
          <button className="h-10 rounded-full bg-azul px-4 font-semibold text-white">Buscar</button>
        </form>
        <details className="rounded-[20px] bg-white p-3">
          <summary className="cursor-pointer font-semibold text-azul">+ Nuevo cliente</summary>
          <form action={crearCliente} className="mt-2 grid gap-2">
            <input name="nombre" required placeholder="Nombre o empresa" className={campo} />
            <input name="telefono" inputMode="tel" placeholder="Teléfono (WhatsApp)" className={campo} />
            <input name="rfc" placeholder="RFC (opcional)" className={campo} />
            <input name="codigo" placeholder="Código de quien lo recomendó (opcional)" className={campo} />
            <button className="rounded-full bg-azul px-4 py-2 font-semibold text-white">Crear</button>
          </form>
        </details>
      </div>
      <section className="overflow-x-auto rounded-[20px] bg-white p-4">
        {filas.length === 0 ? <p className="text-[14px] text-secundario">Sin clientes con este filtro.</p> : (
          <table className="tabla w-full min-w-[760px] text-left text-[14px]">
            <thead className="text-[12px] text-secundario"><tr><th className="pb-2">Cliente</th><th>Teléfono</th><th>Cliente desde</th><th className="text-right">Pedidos</th><th className="text-right">Comprado</th><th>Última compra</th><th className="text-right">Saldo</th><th className="text-right">Puntos</th></tr></thead>
            <tbody className="divide-y divide-linea">
              {filas.map((c) => (
                <tr key={c.id} className="hover:bg-niebla">
                  <td className="py-2"><Link href={`/interno/clientes/${c.id}`} className="font-semibold text-azul">{c.nombre}</Link>
                    <span className="block text-[12px] text-secundario">{[c.razon_social, c.lista, c.credito && "crédito"].filter(Boolean).join(" · ")}</span></td>
                  <td>{c.telefono ?? "—"}</td><td>{c.desde}</td>
                  <td className="text-right tabular-nums">{c.pedidos}</td><td className="text-right tabular-nums">{pesos(c.comprado)}</td>
                  <td>{c.ultima ?? "—"}</td>
                  <td className={`text-right tabular-nums ${c.saldo > 0 ? "font-semibold text-red-700" : ""}`}>{c.saldo ? pesos(c.saldo) : "—"}</td>
                  <td className="text-right tabular-nums">{c.puntos || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/** Interruptor del programa de recomendados (solo admin). */
async function ProgramaRecomendados() {
  await connection();
  const yo = await requerirInterno("operador");
  if (!puede(yo.rol, "admin")) return null;
  const p = await paramLealtad();
  const activo = p.recomendados_activo === 1;
  return (
    <form action={guardarRecomendados} className="flex flex-wrap items-center gap-3 rounded-[20px] bg-white p-4 text-[14px]">
      <span className="font-semibold">Programa de recomendados</span>
      <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${activo ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{activo ? "Activo" : "En pausa"}</span>
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <label className="flex items-center gap-1 text-secundario">Máximo por cliente al mes <input name="tope" type="number" min={0} max={100} defaultValue={p.recomendados_max_mes ?? 5} className="h-9 w-16 rounded-full border border-linea px-2 text-center" /></label>
      <button className={`rounded-full px-4 py-1.5 font-semibold ${activo ? "border border-amber-600 text-amber-700" : "bg-azul text-white"}`}>{activo ? "Pausar" : "Activar"}</button>
      <span className="w-full text-[12px] text-secundario">En pausa: no se piden ni se muestran códigos y no se dan recompensas por recomendar. Los puntos por compra siguen igual.</span>
    </form>
  );
}
