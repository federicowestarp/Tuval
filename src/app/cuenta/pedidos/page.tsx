import { Suspense } from "react";
import Link from "next/link";
import { Marco } from "@/components/marco/Marco";
import { BotonLiga, Titulo } from "@/components/ui";
import { IconoFlecha } from "@/components/Iconos";
import { cuentaActual } from "@/lib/sesion";
import { sql } from "@/lib/db";
import { ETAPAS_CLIENTE, etapaCliente, type EstadoPedido } from "@/lib/estados";
import { formatoMoneda } from "@/lib/catalogo";

export default function MisPedidos() {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Titulo>Pedidos.</Titulo>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-[20px] bg-niebla" />}>
          <Lista />
        </Suspense>
      </main>
    </Marco>
  );
}

async function Lista() {
  const cuenta = await cuentaActual();
  const pedidos = cuenta
    ? await sql<{ id: string; folio: string; estado: EstadoPedido; total: number; confirmado_en: Date | null; creado_en: Date; piezas: number }[]>`
        select p.id, p.folio, p.estado, p.total, p.confirmado_en, p.creado_en,
               (select coalesce(sum(cantidad), 0) from pedido_partidas where pedido_id = p.id)
             + (select count(*) from solicitudes_producto where pedido_id = p.id and origen = 'cliente_fuera_catalogo') as piezas
        from pedidos p where p.cuenta_id = ${cuenta.id} order by p.creado_en desc limit 50`
    : [];

  if (pedidos.length === 0)
    return (
      <div className="py-10 text-center">
        <p className="text-secundario">Aún no tienes pedidos en este dispositivo.</p>
        <div className="mt-6"><BotonLiga href="/tienda">Ir a la tienda</BotonLiga></div>
      </div>
    );

  return (
    <ul className="divide-y divide-linea">
      {pedidos.map((p) => {
        const e = etapaCliente(p.estado);
        return (
          <li key={p.id}>
            <Link href={`/pedido/${p.id}`} className="flex items-center gap-4 py-4">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e === 3 ? "bg-secundario/40" : e === -1 ? "bg-red-400" : "bg-cian"}`} />
              <span className="flex-1">
                <span className="block font-semibold">{e === -1 ? "Cancelado" : p.estado === "entregado_con_faltantes" ? "Entregado con faltantes" : ETAPAS_CLIENTE[e]}</span>
                <span className="block text-[14px] text-secundario">
                  {p.folio} · {new Date(p.creado_en).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" })} · {p.piezas} art.
                  {p.confirmado_en && ` · ${formatoMoneda(p.total)}`}
                </span>
              </span>
              <IconoFlecha className="h-5 w-5 text-secundario" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
