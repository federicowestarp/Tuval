import { Esqueleto } from "@/components/interno/Esqueleto";
import { JalarParaActualizar } from "@/components/JalarParaActualizar";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { sucursal } from "@/lib/inventario";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../Navegacion";
import { Contar, Recibir } from "./Capturas";
import { fijarMinimo } from "./acciones";
import { COLOR_FOCO, NOMBRE_FOCO, focoDe } from "@/lib/focos";

const PESTANAS = [
  { id: "existencias", texto: "Existencias" },
  { id: "recibir", texto: "Recibir mercancía" },
  { id: "contar", texto: "Conteo" },
  { id: "movimientos", texto: "Movimientos" },
] as const;

const TIPO: Record<string, string> = {
  entrada_compra: "Entrada", salida_venta: "Venta", traspaso: "Traspaso", ajuste_conteo: "Ajuste por conteo", retiro_obra: "Retiro de obra", devolucion: "Devolución",
};

export default function Inventario(props: PageProps<"/interno/inventario">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="inventario" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <JalarParaActualizar>
        <Suspense fallback={<Esqueleto />}><Contenido searchParams={props.searchParams} /></Suspense>
        </JalarParaActualizar>
      </main>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: PageProps<"/interno/inventario">["searchParams"] }) {
  await connection();
  await requerirInterno("mostrador");
  const sp = await searchParams;
  const tab = PESTANAS.find((t) => t.id === sp.tab)?.id ?? "existencias";
  const s = await sucursal();
  const [resumen] = await sql<{ productos: number; valor: number; bajo: number; negativos: number }[]>`
    select count(*) filter (where e.cantidad <> 0)::int productos,
           coalesce(sum(greatest(e.cantidad, 0) * coalesce(p.costo_promedio, 0)), 0)::float valor,
           count(*) filter (where e.minimo is not null and e.cantidad < e.minimo)::int bajo,
           count(*) filter (where e.cantidad < 0)::int negativos
    from existencias e join productos p on p.id = e.producto_id where e.almacen_id = ${s.id}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Inventario · {s.nombre}</h1>
          <p className="text-[13px] text-secundario">{resumen.productos} productos con existencia · valor a costo {pesos(resumen.valor)} · {resumen.bajo} agotándose · {resumen.negativos} negativos</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-full bg-white p-1 text-[14px] font-semibold">
          {PESTANAS.map((t) => (
            <Link key={t.id} href={`/interno/inventario?tab=${t.id}`} className={`rounded-full px-3.5 py-1.5 ${t.id === tab ? "bg-azul text-white" : "text-secundario hover:text-azul"}`}>{t.texto}</Link>
          ))}
        </nav>
      </div>
      <section className="rounded-[20px] bg-white p-5">
        {tab === "existencias" && <Existencias almacen={s.id} q={typeof sp.q === "string" ? sp.q : ""} ver={typeof sp.ver === "string" ? sp.ver : ""} />}
        {tab === "recibir" && <Recibir proveedores={await sql<{ id: string; nombre: string }[]>`select id, nombre from proveedores order by nombre`} />}
        {tab === "contar" && <Contar />}
        {tab === "movimientos" && <Movimientos almacen={s.id} />}
      </section>
    </>
  );
}

async function Existencias({ almacen, q, ver }: { almacen: string; q: string; ver: string }) {
  const palabras = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const filtroTexto = palabras.length ? palabras.map((w) => sql`and (lower(p.nombre) like ${"%" + w + "%"} or lower(p.sku) like ${"%" + w + "%"})`).reduce((a, b) => sql`${a} ${b}`) : sql``;
  const filtroVer = ver === "bajo" ? sql`and e.minimo is not null and e.cantidad < e.minimo and e.cantidad > 0` : ver === "agotados" ? sql`and coalesce(e.cantidad, 0) <= 0` : ver === "negativos" ? sql`and e.cantidad < 0` : ver === "todos" ? sql`` : sql`and e.cantidad is not null`;
  const filas = await sql<{ id: string; sku: string; nombre: string; cantidad: number | null; minimo: number | null; costo: number | null }[]>`
    select p.id, p.sku, p.nombre, e.cantidad::float cantidad, e.minimo::float minimo, p.costo_promedio::float costo
    from productos p left join existencias e on e.producto_id = p.id and e.almacen_id = ${almacen}
    where p.activo ${filtroTexto} ${filtroVer}
    order by (e.cantidad < coalesce(e.minimo, -1e9)) desc nulls last, p.nombre limit 200`;
  const filtros = [["", "Con movimiento"], ["bajo", "Agotándose (bajo el mínimo)"], ["agotados", "Agotados"], ["negativos", "Negativos (revisar)"], ["todos", "Todo el catálogo"]];
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="existencias" />
        <input name="q" defaultValue={q} placeholder="Buscar…" className="h-10 flex-1 rounded-full border border-linea px-4" />
        <select name="ver" defaultValue={ver} className="h-10 rounded-full border border-linea px-3">{filtros.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        <button className="h-10 rounded-full bg-azul px-4 font-semibold text-white">Ver</button>
      </form>
      {filas.length === 0 ? <p className="text-[14px] text-secundario">Sin productos con este filtro. Usa “Recibir mercancía” para dar entrada.</p> : (
        <div className="overflow-x-auto">
          <table className="tabla w-full text-[14px]">
            <thead className="text-left text-[12px] text-secundario"><tr><th className="py-2 font-semibold">Producto</th><th className="text-right font-semibold">Existencia</th><th className="text-right font-semibold">Mínimo</th><th className="text-right font-semibold">Costo prom.</th><th className="text-right font-semibold">Valor</th></tr></thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span title={NOMBRE_FOCO[focoDe({ existencia: f.cantidad ?? 0, minimo: f.minimo })]} className={`h-3 w-3 shrink-0 rounded-full ${COLOR_FOCO[focoDe({ existencia: f.cantidad ?? 0, minimo: f.minimo })]}`} />
                      <span className="min-w-0"><span className="block max-w-[22rem] truncate">{f.nombre}</span><span className="text-[12px] text-secundario">{f.sku}</span></span>
                    </span>
                  </td>
                  <td className={`text-right tabular-nums font-semibold ${(f.cantidad ?? 0) <= 0 ? "text-red-700" : f.minimo != null && (f.cantidad ?? 0) < f.minimo ? "text-amber-700" : ""}`}>{f.cantidad ?? 0}</td>
                  <td className="text-right">
                    <form action={fijarMinimo} className="inline-flex justify-end">
                      <input type="hidden" name="producto_id" value={f.id} />
                      <input name="minimo" aria-label="Mínimo" defaultValue={f.minimo ?? ""} inputMode="decimal" className="h-8 w-16 rounded-lg border border-linea text-center" />
                    </form>
                  </td>
                  <td className="text-right tabular-nums">{f.costo != null ? pesos(f.costo) : "—"}</td>
                  <td className="text-right tabular-nums">{f.costo != null && f.cantidad ? pesos(Math.max(0, f.cantidad) * f.costo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-secundario">Verde: hay · Amarillo: se está agotando (bajo el mínimo) · Rojo: agotado. Para fijar un mínimo, escríbelo y presiona Enter; sin mínimo, un producto nunca sale en amarillo.</p>
        </div>
      )}
    </div>
  );
}

async function Movimientos({ almacen }: { almacen: string }) {
  const filas = await sql<{ id: number; fecha: string; tipo: string; nombre: string; cantidad: number; entra: boolean; referencia: string | null; nota: string | null; quien: string | null }[]>`
    select m.id, to_char(m.creado_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI') fecha, m.tipo, p.nombre, m.cantidad::float cantidad,
           (m.almacen_destino = ${almacen}) entra, m.referencia, m.nota, u.nombre quien
    from movimientos_inventario m join productos p on p.id = m.producto_id left join usuarios_internos u on u.id = m.usuario_id
    where m.almacen_origen = ${almacen} or m.almacen_destino = ${almacen}
    order by m.creado_en desc limit 100`;
  if (filas.length === 0) return <p className="text-[14px] text-secundario">Sin movimientos.</p>;
  return (
    <ul className="divide-y divide-linea text-[14px]">
      {filas.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0"><span className="block truncate">{m.nombre}</span><span className="text-[12px] text-secundario">{m.fecha} · {TIPO[m.tipo] ?? m.tipo}{m.referencia && ` · ${m.referencia}`}{m.nota && ` · ${m.nota}`}{m.quien && ` · ${m.quien}`}</span></span>
          <span className={`tabular-nums font-semibold ${m.entra ? "text-azul" : ""}`}>{m.entra ? "+" : "−"}{m.cantidad}</span>
        </li>
      ))}
    </ul>
  );
}
