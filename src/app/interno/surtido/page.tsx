import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../Navegacion";

/** Pedidos que se surten desde la sucursal, pendientes de tomar del anaquel. */
export default function PorSurtir() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="surtido" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  await requerirInterno("mostrador");
  const pedidos = await sql<{ id: string; folio: string; cliente: string | null; partidas: number; listas: number; desde: string }[]>`
    select p.id, p.folio, p.contacto_nombre cliente,
           (select count(*)::int from pedido_partidas where pedido_id = p.id) partidas,
           (select count(*)::int from pedido_partidas where pedido_id = p.id and cantidad_surtida >= cantidad) listas,
           to_char(p.surtir_en_sucursal_desde at time zone 'America/Mexico_City', 'DD/MM HH24:MI') desde
    from pedidos p where p.surtir_en_sucursal_desde is not null and p.estado = 'recibido' order by p.surtir_en_sucursal_desde`;
  return (
    <>
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Por surtir</h1>
        <p className="text-[15px] text-secundario">Abre el pedido: te dice dónde está cada pieza y a qué nivel. Escanea la etiqueta para tomarla; se descuenta sola del inventario.</p>
      </div>
      {pedidos.length === 0 ? <p className="rounded-[20px] bg-white p-4 text-secundario">No hay pedidos por surtir.</p> : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link href={`/interno/surtido/${p.id}`} className="flex items-center justify-between gap-3 rounded-[20px] bg-white p-4">
                <span><span className="block font-semibold">{p.folio}</span><span className="text-[14px] text-secundario">{p.cliente ?? "—"} · desde {p.desde}</span></span>
                <span className="rounded-full bg-[#FFF1E6] px-3 py-1 text-[13px] font-semibold text-[#E8590C]">{p.listas}/{p.partidas}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
