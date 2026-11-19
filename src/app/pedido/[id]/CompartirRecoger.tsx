"use client";

import { useState, useTransition } from "react";
import { compartirRecoger } from "./recoge-acciones";

/** "¿Va a recoger otra persona?": se pone su nombre y se le comparte el QR por WhatsApp. */
export function CompartirRecoger({ pedidoId, folio, inicial }: { pedidoId: string; folio: string; inicial: string }) {
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [liga, setLiga] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const mensaje = (l: string) => `Hola ${nombre.split(" ")[0]}, vas a recoger mi pedido ${folio} en Tuval. Enseña este código en caja: ${l}`;
  return (
    <form onSubmit={(e) => { e.preventDefault(); iniciar(async () => { setError(null); const r = await compartirRecoger(pedidoId, nombre); if (r.error || !r.liga) { setError(r.error ?? "Intenta de nuevo."); return; } setLiga(r.liga); window.open(`https://wa.me/?text=${encodeURIComponent(mensaje(r.liga))}`, "_blank"); }); }}
      className="w-full space-y-2 text-left">
      <label htmlFor="quien-recoge" className="block text-[14px] font-semibold">¿Va a recoger otra persona?</label>
      <div className="flex gap-2">
        <input id="quien-recoge" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de quien recoge" className="h-11 min-w-0 flex-1 rounded-full border border-linea bg-white px-4" />
        <button disabled={enviando} className="h-11 shrink-0 rounded-full bg-azul px-4 font-semibold text-white">{enviando ? "…" : "Compartir QR"}</button>
      </div>
      {error && <p className="text-[13px] font-semibold text-red-700">{error}</p>}
      {liga && <p className="text-[13px] text-secundario">Listo: en caja le pedirán su nombre y firma. Liga: <span className="select-all break-all">{liga}</span></p>}
    </form>
  );
}
