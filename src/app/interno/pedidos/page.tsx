import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/Logo";
import { listarPedidos } from "@/lib/pedidos";
import { NOMBRE_INTERNO, SIGUIENTE } from "@/lib/estados";
import { describirPromesa, ZONAS } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { cambiarEstado } from "./acciones";
import { verificarAccesoInterno } from "../acceso";

export default function PanelPedidos() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="flex items-center justify-between bg-profundo px-4 py-4">
        <Link href="/"><Logo /></Link>
        <span className="text-sm font-semibold text-cian">Panel interno · Pedidos</span>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-acero">Cargando…</p>}>
          <Lista />
        </Suspense>
      </main>
    </div>
  );
}

async function Lista() {
  await connection(); // siempre en vivo, nunca prerenderizado
  verificarAccesoInterno();
  const pedidos = await listarPedidos();
  if (pedidos.length === 0) return <p className="rounded-xl bg-white p-6">No hay pedidos.</p>;

  return (
    <div className="space-y-3">
      {pedidos.map((p) => {
        const siguiente = SIGUIENTE[p.estado];
        return (
          <article key={p.id} className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-semibold">
                <Link href={`/pedido/${p.id}`} className="text-azul underline">{p.folio}</Link>
                <span className="ml-2 rounded-full bg-cianclaro px-2 py-0.5 text-xs text-profundo">{NOMBRE_INTERNO[p.estado]}</span>
              </p>
              <p className="mt-1 text-sm">
                {p.contacto_nombre} · {p.contacto_telefono} · {ZONAS.find((z) => z.id === p.zona)?.nombre} · {p.tipo_entrega}
                {p.sin_recepcion_solicitada && " · sin recepción"}
              </p>
              <p className="text-sm text-acero">{p.direccion_entrega}</p>
              <p className="mt-1 text-xs text-acero">
                {describirPromesa({ fecha: p.entrega_fecha, ventana: p.entrega_ventana })} · {p.piezas} pzas ·{" "}
                {p.sin_precio > 0 ? `${p.sin_precio} partida(s) sin precio` : formatoMoneda(p.total)} · {p.comprobante}
              </p>
            </div>
            <div className="flex gap-2">
              {siguiente && (
                <form action={cambiarEstado}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="estado" value={siguiente} />
                  <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">→ {NOMBRE_INTERNO[siguiente]}</button>
                </form>
              )}
              {p.estado !== "entregado" && p.estado !== "cancelado" && (
                <form action={cambiarEstado}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="estado" value="cancelado" />
                  <button className="rounded-lg border border-acero px-3 py-2 text-sm text-acero">Cancelar</button>
                </form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
