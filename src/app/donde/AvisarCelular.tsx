"use client";

import { useState, useTransition } from "react";
import { dejarCelular } from "./acciones";

/** Pieza que no tenemos: ya se avisó al equipo; el cliente puede dejar su celular para que le avisen cuando la consigan. */
export function AvisarCelular({ solicitudId }: { solicitudId: string }) {
  const [tel, setTel] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (listo) return <p className="text-[15px] font-semibold text-emerald-700">Gracias. Te escribimos por WhatsApp en cuanto la tengamos.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await dejarCelular(solicitudId, tel); if (r.error) setError(r.error); else setListo(true); }); }} className="space-y-1">
      <div className="flex gap-2">
        <input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="Tu celular para avisarte (opcional)" aria-label="Tu celular" className="h-12 min-w-0 flex-1 rounded-full border border-linea bg-white px-4" />
        <button disabled={enviando} className="h-12 shrink-0 rounded-full bg-azul px-5 font-semibold text-white">{enviando ? "…" : "Avísenme"}</button>
      </div>
      {error && <p className="text-[13px] font-semibold text-red-700">{error}</p>}
    </form>
  );
}
