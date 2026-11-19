"use client";

import { ElegirArchivo } from "@/components/ElegirArchivo";
import { useActionState } from "react";
import { subirFactura, type EstadoFactura } from "./acciones";

/** En la bodega del proveedor: sube la factura (XML) y el sistema la concilia contra la orden de compra. */
export function FacturaProveedor({ pedidoId, ocId, folio }: { pedidoId: string; ocId?: string; folio: string }) {
  const [estado, accion, enviando] = useActionState<EstadoFactura, FormData>(subirFactura, {});
  return (
    <form action={accion} className="space-y-1 rounded-xl bg-niebla px-3 py-2 text-[14px]">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {ocId && <input type="hidden" name="oc_id" value={ocId} />}
      <p className="font-semibold">{folio}</p>
      <ElegirArchivo name="factura" accept=".xml,text/xml,application/xml,application/pdf,image/*" texto="Elegir factura" ayuda="XML de preferencia (también PDF o foto)" />
      <button disabled={enviando} className="w-full rounded-full bg-azul py-2 font-semibold text-white">{enviando ? "Revisando…" : "Subir factura"}</button>
      {estado.mensaje && <p className="text-emerald-700">{estado.mensaje}</p>}
      {estado.error && <p className="font-semibold text-red-700">{estado.error}</p>}
    </form>
  );
}
