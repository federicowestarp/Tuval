"use client";

import { useActionState, useState } from "react";
import { darDeAlta, type ResultadoAlta } from "./acciones";
import { CATEGORIAS } from "@/lib/categorias";

export function FormAlta({ ids, descripcion }: { ids: string[]; descripcion: string }) {
  const [abierto, setAbierto] = useState(false);
  const [r, accion, enviando] = useActionState<ResultadoAlta, FormData>(darDeAlta, {});
  if (r.mensaje) return <p className="text-sm font-semibold text-azul">{r.mensaje}</p>;
  if (!abierto)
    return <button type="button" onClick={() => setAbierto(true)} className="text-sm font-semibold text-azul underline">Dar de alta en catálogo</button>;
  return (
    <form action={accion} className="mt-2 grid gap-2 rounded-lg bg-niebla p-3 sm:grid-cols-4">
      <input type="hidden" name="ids" value={ids.join(",")} />
      <input name="nombre" defaultValue={descripcion} placeholder="Nombre" className="rounded-lg border border-cianclaro px-2 py-2 sm:col-span-2" />
      <input name="sku" placeholder="SKU" className="rounded-lg border border-cianclaro px-2 py-2 uppercase" />
      <select name="categoria" defaultValue="" className="rounded-lg border border-cianclaro px-2 py-2">
        <option value="" disabled>Categoría</option>
        {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <input name="precio" placeholder="Precio venta sin IVA (opcional)" inputMode="decimal" className="rounded-lg border border-cianclaro px-2 py-2 sm:col-span-2" />
      <button disabled={enviando} className="rounded-lg bg-azul px-3 py-2 text-sm font-semibold text-white sm:col-span-2">
        {enviando ? "Guardando…" : "Dar de alta"}
      </button>
      {r.error && <p className="text-sm font-semibold text-red-700 sm:col-span-4">{r.error}</p>}
    </form>
  );
}
