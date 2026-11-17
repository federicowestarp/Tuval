"use client";

import { useActionState } from "react";
import { subirFactura, type EstadoFactura } from "./acciones";

/** En la bodega del proveedor: sube la factura (XML) y el sistema la concilia contra la orden de compra. */
export function FacturaProveedor({ pedidoId, folio }: { pedidoId: string; folio: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFactura, FormData>(subirFactura, {});
  return (
    <form action={accion} className="space-y-1 rounded-xl bg-niebla px-3 py-2 text-[14px]">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{folio}</span>
        <input type="file" name="factura" accept=".xml,text/xml,application/xml,application/pdf,image/*" aria-label={`Factura de ${folio}`} className="min-w-0 flex-1 text-[13px]" />
        <button disabled={enviando} className="rounded-full bg-azul px-3 py-1 font-semibold text-white">{enviando ? "Revisando…" : "Subir factura"}</button>
      </div>
      {estado.mensaje && <p className="text-emerald-700">{estado.mensaje}</p>}
      {estado.error && <p className="font-semibold text-red-700">{estado.error}</p>}
    </form>
  );
}
