import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { asegurarChequeosHoy } from "@/lib/chequeo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../Navegacion";
import { resolverChequeo } from "./acciones";
import { Chequear } from "./Chequear";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Chequeo aleatorio de anaquel: unos cuantos productos al día, conteo ciego, diferencias a supervisión. */
export default function Chequeo() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="chequeo" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("mostrador");
  await asegurarChequeosHoy();
  const supervisa = puede(yo.rol, "supervisor");
  const [hoy, diferencias, resumen] = await Promise.all([
    sql<{ id: string; sku: string; nombre: string; ubicacion: string | null; contado: boolean }[]>`
      select c.id, p.sku, p.nombre, u.codigo ubicacion, c.contado is not null contado
      from chequeos_anaquel c join productos p on p.id = c.producto_id
      left join existencias e on e.producto_id = c.producto_id and e.almacen_id = c.almacen_id left join ubicaciones u on u.id = e.ubicacion_id
      where c.fecha = (now() at time zone 'America/Mexico_City')::date order by c.contado is not null, u.codigo nulls last, p.nombre`,
    supervisa ? sql<{ id: string; nombre: string; sku: string; esperado: number; contado: number; etiqueta_ok: boolean; quien: string | null; fecha: string; costo: number | null }[]>`
      select c.id, p.nombre, p.sku, c.esperado::float esperado, c.contado::float contado, c.etiqueta_ok, u.nombre quien, to_char(c.fecha, 'DD/MM') fecha, p.costo_promedio::float costo
      from chequeos_anaquel c join productos p on p.id = c.producto_id left join usuarios_internos u on u.id = c.usuario_id
      where c.contado is not null and c.revisado_en is null and (c.contado <> c.esperado or not c.etiqueta_ok) order by c.contado_en desc` : Promise.resolve([]),
    sql<{ total: number; exactos: number }[]>`
      select count(*)::int total, count(*) filter (where contado = esperado)::int exactos
      from chequeos_anaquel where contado is not null and fecha > (now() at time zone 'America/Mexico_City')::date - 30`,
  ]);
  const pendientes = hoy.filter((c) => !c.contado);
  const r = resumen[0];
  return (
    <>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Chequeo de anaquel</h1>
        <p className="text-[15px] text-secundario">Hoy: {hoy.length - pendientes.length}/{hoy.length} revisados. Escanea la etiqueta y cuenta lo que hay. No se muestra lo que dice el sistema.</p>
        {r.total > 0 && <p className="text-[14px] text-secundario">Últimos 30 días: {Math.round((r.exactos / r.total) * 100)}% exactos ({r.exactos} de {r.total}).</p>}
      </div>
      {pendientes.length === 0 ? <p className="rounded-[20px] bg-white p-4 text-emerald-700">Chequeo de hoy completo ✓</p> : (
        <ul className="space-y-2">{pendientes.map((c) => <Chequear key={c.id} id={c.id} sku={c.sku} nombre={c.nombre} ubicacion={c.ubicacion} />)}</ul>
      )}
      {supervisa && diferencias.length > 0 && (
        <section className="space-y-2 rounded-[20px] bg-white p-4">
          <h2 className="font-semibold">Por revisar (supervisión)</h2>
          <ul className="divide-y divide-linea">
            {diferencias.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                <span className="min-w-0">
                  <span className="font-semibold">{d.nombre}</span> <span className="text-secundario">· {d.fecha} · {d.quien ?? "—"}</span>
                  <span className="block">Sistema {d.esperado}, contado <strong className={d.contado < d.esperado ? "text-red-700" : ""}>{d.contado}</strong>
                    {d.costo != null && d.contado !== d.esperado && <> · {mx((d.contado - d.esperado) * d.costo)}</>}
                    {!d.etiqueta_ok && <span className="text-amber-800"> · etiqueta faltante o equivocada</span>}</span>
                </span>
                <span className="flex gap-2">
                  {d.contado !== d.esperado && <form action={resolverChequeo}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="resolucion" value="ajustado" /><button className="rounded-full bg-azul px-3 py-1.5 font-semibold text-white">Ajustar a {d.contado}</button></form>}
                  <form action={resolverChequeo}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="resolucion" value="sin_ajuste" /><button className="rounded-full border border-linea px-3 py-1.5">{d.contado !== d.esperado ? "Sin ajuste" : "Visto"}</button></form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
