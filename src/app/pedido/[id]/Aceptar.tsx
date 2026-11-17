"use client";

import { useState, useTransition } from "react";
import { clasesBoton } from "@/components/ui";
import { aceptarCotizacion } from "./aceptar-acciones";

export function Aceptar({ pedidoId }: { pedidoId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (msg) return <p className="rounded-[20px] bg-niebla p-5 text-[15px] font-semibold">{msg}</p>;
  return (
    <button type="button" disabled={enviando} onClick={() => iniciar(async () => setMsg((await aceptarCotizacion(pedidoId)).mensaje))} className={clasesBoton("principal", "grande", true)}>
      {enviando ? "Enviando…" : "Acepto la cotización"}
    </button>
  );
}
