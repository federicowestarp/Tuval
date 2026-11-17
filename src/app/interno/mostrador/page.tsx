import { Esqueleto } from "@/components/interno/Esqueleto";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { sucursal } from "@/lib/inventario";
import { campo, clasesBoton, etiqueta } from "@/components/ui";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../Navegacion";
import { PuntoDeVenta } from "./PuntoDeVenta";
import type { ProductoInventario } from "./InventarioFocos";
import { abrirCaja, cerrarCaja } from "./acciones";

export default function Mostrador() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="mostrador" />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("mostrador");
  const s = await sucursal();
  const [caja] = await sql<{ id: string; abierta_en: Date; fondo: number; quien: string }[]>`
    select c.id, c.abierta_en, c.fondo::float fondo, u.nombre quien
    from cajas c join usuarios_internos u on u.id = c.abierta_por
    where c.almacen_id = ${s.id} and c.cerrada_en is null limit 1`;

  if (!caja) {
    return (
      <section className="mx-auto max-w-md space-y-4 rounded-[20px] bg-white p-6">
        <h1 className="font-display text-2xl font-semibold">Abrir caja · {s.nombre}</h1>
        <Link href="/interno/mostrador/cortes" className="text-[14px] text-azul">Ver cortes de caja anteriores ›</Link>
        <form action={abrirCaja} className="space-y-3">
          <div><label className={etiqueta} htmlFor="fondo">Fondo de caja (efectivo inicial)</label><input id="fondo" name="fondo" inputMode="decimal" defaultValue="0" className={campo} /></div>
          <button className={clasesBoton("principal", "grande", true)}>Abrir caja</button>
        </form>
      </section>
    );
  }

  const [porForma, ventas, inventario, categorias] = await Promise.all([
    sql<{ forma: string; total: number; n: number }[]>`
      select forma, sum(monto)::float total, count(*)::int n from pagos where caja_id = ${caja.id} group by forma order by forma`,
    sql<{ id: string; folio: string; total: number; hora: string; comprobante: string }[]>`
      select p.id, p.folio, p.total::float total, to_char(p.creado_en at time zone 'America/Mexico_City', 'HH24:MI') hora, p.comprobante
      from pedidos p join pagos g on g.pedido_id = p.id where g.caja_id = ${caja.id} order by p.creado_en desc limit 15`,
    sql<ProductoInventario[]>`
      select p.id, p.sku, p.nombre, p.unidad, pr.precio::float precio, coalesce(e.cantidad, 0)::float existencia, p.codigo_barras,
             p.costo_promedio::float costo, p.categoria_id, e.minimo::float minimo, p.imagen_url
      from productos p
      left join precios pr on pr.producto_id = p.id and pr.lista_id = (select id from listas_precio where nombre = 'Público')
      left join existencias e on e.producto_id = p.id and e.almacen_id = ${s.id}
      where p.activo order by p.nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from categorias order by orden, nombre`,
  ]);
  const efectivo = porForma.find((f) => f.forma === "efectivo")?.total ?? 0;
  const esperado = caja.fondo + efectivo;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">Mostrador · {s.nombre}</h1>
        <p className="text-[13px] text-secundario">Caja abierta por {caja.quien} · fondo {pesos(caja.fondo)} · <Link href="/interno/mostrador/cortes" className="text-azul">Cortes anteriores</Link></p>
      </div>
      <PuntoDeVenta inventario={inventario} categorias={categorias} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[20px] bg-white p-5">
          <h2 className="mb-2 font-semibold">Ventas de este turno</h2>
          {ventas.length === 0 ? <p className="text-[14px] text-secundario">Aún no hay ventas.</p> : (
            <ul className="divide-y divide-linea text-[14px]">
              {ventas.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span>{v.hora} · {v.folio} · {v.comprobante}</span>
                  <span className="flex items-center gap-3"><strong className="tabular-nums">{pesos(v.total)}</strong><Link href={`/interno/mostrador/ticket/${v.id}`} target="_blank" className="text-azul">Ticket</Link></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3 rounded-[20px] bg-white p-5">
          <h2 className="font-semibold">Corte de caja</h2>
          <ul className="text-[14px]">
            {porForma.map((f) => <li key={f.forma} className="flex justify-between"><span className="capitalize">{f.forma} ({f.n})</span><span className="tabular-nums">{pesos(f.total)}</span></li>)}
            <li className="mt-1 flex justify-between border-t border-linea pt-1 font-semibold"><span>Efectivo esperado en caja</span><span className="tabular-nums">{pesos(esperado)}</span></li>
          </ul>
          <form action={cerrarCaja} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="id" value={caja.id} />
            <input name="contado" inputMode="decimal" placeholder="Efectivo contado" required className={campo} />
            <button className={clasesBoton("secundario", "normal")}>Cerrar caja</button>
            <input name="notas" placeholder="Notas (opcional)" className={`${campo} sm:col-span-2`} />
          </form>
        </section>
      </div>
    </>
  );
}
