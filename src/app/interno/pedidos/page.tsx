import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { listarPedidos } from "@/lib/pedidos";
import { NOMBRE_INTERNO, SIGUIENTE } from "@/lib/estados";
import { describirPromesa, ZONAS } from "@/lib/corte";
import { formatoMoneda } from "@/lib/catalogo";
import { cambiarEstado } from "./acciones";
import { verificarAccesoInterno } from "../acceso";
import { NavegacionInterna } from "../Navegacion";

export default function PanelPedidos() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="pedidos" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-secundario">Cargando…</p>}>
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
                <Link href={`/interno/pedidos/${p.id}`} className="text-azul underline">{p.folio}</Link>
                <span className="ml-2 rounded-full bg-piedra px-2 py-0.5 text-xs text-tinta">{NOMBRE_INTERNO[p.estado]}</span>
                {!p.confirmado_en && <span className="ml-2 rounded-full bg-cian px-2 py-0.5 text-xs text-sobrecian">Por confirmar</span>}
              </p>
              <p className="mt-1 text-sm">
                {p.contacto_nombre} · {p.contacto_telefono} · {p.zona ? ZONAS.find((z) => z.id === p.zona)?.nombre : "Recoger"} · {p.tipo_entrega}
                {p.sin_recepcion_solicitada && " · sin recepción"}
              </p>
              <p className="text-sm text-secundario">{p.direccion_entrega}</p>
              <p className="mt-1 text-xs text-secundario">
                {p.entrega_fecha && p.entrega_ventana ? describirPromesa({ fecha: p.entrega_fecha, ventana: p.entrega_ventana }) : "Recoger"} · {p.piezas} pzas
                {p.especiales > 0 && ` · ${p.especiales} por buscar`}
                {p.adjuntos > 0 && ` · ${p.adjuntos} lista(s) adjunta(s)`}
                {" · "}{p.confirmado_en ? formatoMoneda(p.total) : p.sin_precio > 0 ? `${p.sin_precio} sin precio` : "sin confirmar"} · {p.comprobante}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/interno/pedidos/${p.id}`} className="rounded-lg border border-azul px-3 py-2 text-sm font-semibold text-azul">Abrir</Link>
              {siguiente && (
                <form action={cambiarEstado}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="estado" value={siguiente} />
                  <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">→ {NOMBRE_INTERNO[siguiente]}</button>
                </form>
              )}
              {p.estado !== "entregado" && p.estado !== "entregado_con_faltantes" && p.estado !== "cancelado" && (
                <form action={cambiarEstado}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="estado" value="cancelado" />
                  <button className="rounded-lg border border-secundario px-3 py-2 text-sm text-secundario">Cancelar</button>
                </form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
