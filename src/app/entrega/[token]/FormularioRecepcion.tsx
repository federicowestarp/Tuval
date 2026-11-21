"use client";

import { AnilloBoton } from "@/components/Progreso";
import { useActionState, useState } from "react";
import type { PartidaPedido } from "@/lib/pedidos";
import { IconoMas, IconoMenos } from "@/components/Iconos";
import { areaTexto, clasesBoton } from "@/components/ui";
import { confirmarRecepcion, type EstadoRecepcion } from "./acciones";

export function FormularioRecepcion({ token, partidas }: { token: string; partidas: PartidaPedido[] }) {
  const [estado, accion, enviando] = useActionState<EstadoRecepcion, FormData>(confirmarRecepcion, {});
  const [recibido, setRecibido] = useState<Record<string, number>>(() => Object.fromEntries(partidas.map((p) => [p.id, p.cantidad])));
  const faltan = partidas.filter((p) => recibido[p.id] < p.cantidad).length;

  if (estado.ok) return <p className="rounded-[20px] bg-piedra p-5 font-semibold">¡Gracias! Registramos la recepción.</p>;
  return (
    <form action={accion} className="space-y-5 border-t border-linea pt-8">
      <input type="hidden" name="token" value={token} />
      <div>
        <h2 className="font-display text-2xl font-semibold">¿Llegó todo?</h2>
        <p className="mt-1 text-[15px] text-secundario">Si llegó menos de algo, bájale a la cantidad.</p>
      </div>
      <ul className="divide-y divide-linea">
        {partidas.map((p) => {
          const n = recibido[p.id];
          const falta = n < p.cantidad;
          return (
            <li key={p.id} className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{p.nombre}</p>
                  <p className={`text-[13px] ${falta ? "font-semibold text-red-700" : "text-secundario"}`}>{falta ? `Faltan ${p.cantidad - n} de ${p.cantidad}` : `Pedido: ${p.cantidad}`}</p>
                </div>
                <div className="flex h-10 shrink-0 items-center rounded-full bg-niebla">
                  <button type="button" aria-label="Menos" onClick={() => setRecibido({ ...recibido, [p.id]: Math.max(0, n - 1) })} className="flex h-10 w-10 items-center justify-center text-azul"><IconoMenos className="h-4 w-4" /></button>
                  <span className="min-w-8 text-center font-semibold">{n}</span>
                  <button type="button" aria-label="Más" onClick={() => setRecibido({ ...recibido, [p.id]: Math.min(p.cantidad, n + 1) })} className="flex h-10 w-10 items-center justify-center text-azul"><IconoMas className="h-4 w-4" /></button>
                </div>
              </div>
              <input type="hidden" name={`recibido_${p.id}`} value={n} />
              {falta && <input name={`nota_${p.id}`} placeholder="¿Qué pasó? (opcional)" className="aparecer mt-3 h-11 w-full rounded-xl bg-niebla px-3 text-[15px] outline-none focus:ring-2 focus:ring-azul/30" />}
            </li>
          );
        })}
      </ul>
      <textarea name="comentario" rows={2} placeholder="Comentario (opcional)" className={areaTexto} />
      {estado.error && <p role="alert" className="font-semibold text-red-700">{estado.error}</p>}
      <button disabled={enviando} className={clasesBoton("principal", "grande", true)}>
        {enviando ? <span className="inline-flex items-center justify-center gap-3"><AnilloBoton /> Enviando…</span> : faltan ? `Confirmar con ${faltan} faltante${faltan === 1 ? "" : "s"}` : "Llegó todo completo"}
      </button>
    </form>
  );
}
