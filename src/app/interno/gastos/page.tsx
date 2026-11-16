import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { hoyMx } from "@/lib/ruta";
import { urlArchivo } from "@/lib/url-archivo";
import { pesos } from "@/components/interno/Indicadores";
import { NavegacionInterna } from "../Navegacion";
import { FormGasto } from "./FormGasto";
import { borrarGasto } from "./acciones";

export default function Gastos() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="gastos" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">Gastos</h1>
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("admin");
  const [vehiculos, empleados, gastos] = await Promise.all([
    sql<{ id: string; nombre: string }[]>`select id, nombre from vehiculos where activo order by nombre`,
    sql<{ id: string; nombre: string }[]>`select id, nombre from empleados where activo order by nombre`,
    sql<{ id: string; fecha: string; categoria: string; concepto: string; monto: number; vehiculo: string | null; empleado: string | null; comprobante_id: string | null }[]>`
      select g.id, to_char(g.fecha, 'YYYY-MM-DD') fecha, g.categoria, g.concepto, g.monto::float monto, v.nombre vehiculo, e.nombre empleado, g.comprobante_id
      from gastos g left join vehiculos v on v.id = g.vehiculo_id left join empleados e on e.id = g.empleado_id
      order by g.fecha desc, g.creado_en desc limit 100`,
  ]);
  return (
    <>
      <section className="rounded-[20px] bg-white p-5"><FormGasto vehiculos={vehiculos} empleados={empleados} hoy={hoyMx()} /></section>
      <section className="rounded-[20px] bg-white p-5">
        <h2 className="mb-2 font-semibold">Últimos gastos</h2>
        {gastos.length === 0 ? <p className="text-[14px] text-secundario">Sin gastos registrados.</p> : (
          <ul className="divide-y divide-linea text-[14px]">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.concepto}</p>
                  <p className="text-[12px] text-secundario">{g.fecha} · {g.categoria}{g.vehiculo && ` · ${g.vehiculo}`}{g.empleado && ` · ${g.empleado}`}
                    {g.comprobante_id && <> · <a href={urlArchivo(g.comprobante_id)} target="_blank" className="text-azul">comprobante</a></>}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums font-semibold">{pesos(g.monto)}</span>
                  <form action={borrarGasto}><input type="hidden" name="id" value={g.id} /><button className="text-[12px] text-secundario hover:text-red-700">Borrar</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
