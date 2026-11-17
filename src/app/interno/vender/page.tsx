import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../Navegacion";
import { VentaAsistida } from "./VentaAsistida";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Venta asistida (tablet del vendedor, sin lugar fijo) y lo vendido por cada vendedor. */
export default function Vender() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="vender" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Venta asistida</h1>
        <VentaAsistida />
        <Suspense fallback={<Esqueleto />}><PorVendedor /></Suspense>
      </main>
    </div>
  );
}

async function PorVendedor() {
  await connection();
  const yo = await requerirInterno("mostrador");
  const todos = puede(yo.rol, "supervisor");
  const filas = await sql<{ nombre: string; hoy: number; mes: number; ventas_mes: number }[]>`
    select u.nombre,
      coalesce(sum(p.total) filter (where (p.creado_en at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date), 0)::float hoy,
      coalesce(sum(p.total), 0)::float mes, count(*)::int ventas_mes
    from pedidos p join usuarios_internos u on u.id = p.vendedor_id
    where p.canal = 'mostrador' and p.estado <> 'cancelado'
      and p.creado_en >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'
      and (${todos} or u.id = ${yo.id})
    group by u.nombre order by mes desc`;
  if (filas.length === 0) return null;
  return (
    <section className="rounded-[20px] bg-white p-4">
      <h2 className="mb-2 font-semibold">{todos ? "Ventas por vendedor" : "Mis ventas"} · este mes</h2>
      <table className="tabla w-full text-[14px]">
        <thead className="text-left text-secundario"><tr><th>Vendedor</th><th className="text-right">Hoy</th><th className="text-right">Mes</th><th className="text-right">Tickets</th></tr></thead>
        <tbody className="divide-y divide-linea tabular-nums">
          {filas.map((f) => <tr key={f.nombre}><td>{f.nombre}</td><td className="text-right">{mx(f.hoy)}</td><td className="text-right">{mx(f.mes)}</td><td className="text-right">{f.ventas_mes}</td></tr>)}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-secundario">Incluye lo que cobra caja de carritos armados por cada vendedor y lo que vende cada cajero directo. Con IVA.</p>
    </section>
  );
}
