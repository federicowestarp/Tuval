"use client";

import { useState } from "react";
import { BotonWhatsApp } from "./BotonWhatsApp";
import { solicitarCotizacionWA } from "../acciones";

/** Pedir cotización a otro proveedor (para comparar o para lo que el primero no tiene). */
export function PedirAOtro({ pedidoId, proveedores }: { pedidoId: string; proveedores: { id: string; nombre: string; whatsapp: string | null }[] }) {
  const [id, setId] = useState("");
  if (proveedores.length === 0) return null;
  const elegido = proveedores.find((x) => x.id === id);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Pedir también a" className="h-8 rounded-full border border-linea bg-white px-2">
        <option value="">Pedir también a…</option>
        {proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.whatsapp ? "" : " (sin WhatsApp)"}</option>)}
      </select>
      {elegido && <BotonWhatsApp accion={solicitarCotizacionWA} id={`${pedidoId}:${elegido.id}`} texto={`Pedir a ${elegido.nombre}`} />}
    </div>
  );
}
