"use client";

import { useActionState } from "react";
import type { PartidaPedido } from "@/lib/pedidos";
import { confirmarRecepcion, type EstadoRecepcion } from "./acciones";

export function FormularioRecepcion({ token, partidas }: { token: string; partidas: PartidaPedido[] }) {
  const [estado, accion, enviando] = useActionState<EstadoRecepcion, FormData>(confirmarRecepcion, {});
  if (estado.ok) return <p className="mt-4 rounded-xl bg-cianclaro p-4 font-semibold">¡Gracias! Registramos la recepción.</p>;
  return (
    <form action={accion} className="mt-4 space-y-3 rounded-xl bg-white p-4">
      <input type="hidden" name="token" value={token} />
      <h2 className="font-display text-xl font-bold">¿Llegó todo?</h2>
      <p className="text-sm text-acero">Revisa cada partida. Si llegó menos, corrige la cantidad.</p>
      {partidas.map((p) => (
        <div key={p.id} className="rounded-lg bg-niebla p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{p.nombre}<span className="block text-xs font-normal text-acero">Pedido: {p.cantidad}</span></p>
            <label className="text-xs">
              Recibí
              <input name={`recibido_${p.id}`} type="number" min={0} max={p.cantidad} defaultValue={p.cantidad} className="ml-2 w-20 rounded-lg border border-cianclaro px-2 py-2 text-center text-base" />
            </label>
          </div>
          <input name={`nota_${p.id}`} placeholder="Comentario (si viene dañado, distinto…)" className="mt-2 w-full rounded-lg border border-cianclaro bg-white px-3 py-2 text-sm" />
        </div>
      ))}
      <textarea name="comentario" rows={2} placeholder="Comentario general (opcional)" className="w-full rounded-lg border border-cianclaro px-3 py-2" />
      {estado.error && <p role="alert" className="font-semibold text-red-700">{estado.error}</p>}
      <button disabled={enviando} className="w-full rounded-xl bg-azul py-4 text-lg font-bold text-white disabled:opacity-60">
        {enviando ? "Enviando…" : "Confirmar recepción"}
      </button>
    </form>
  );
}
