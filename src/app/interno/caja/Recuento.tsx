"use client";

import { useState, useTransition } from "react";
import { ConteoDenominaciones, conteoVacio } from "@/components/interno/ConteoDenominaciones";
import type { LineaConteo } from "@/lib/denominaciones";
import { recontarRetiro } from "./acciones";

/** Recuento de un sobre de retiro al abrir la caja fuerte (ciego: no se muestra el recibo hasta guardar). */
export function RecontarRetiro({ id, folio }: { id: string; folio: string }) {
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState<LineaConteo[]>(conteoVacio);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="rounded-full border border-azul px-3 py-1 text-[13px] font-semibold text-azul">Recontar {folio}</button>;
  return (
    <div className="w-full space-y-2 rounded-xl bg-niebla p-3">
      <ConteoDenominaciones valor={lineas} onCambio={setLineas} titulo={`Recuento del sobre ${folio}`} />
      {msg && <p className="font-semibold text-azul">{msg}</p>}
      <button type="button" disabled={enviando} onClick={() => iniciar(async () => { const r = await recontarRetiro(id, lineas); setMsg(r.error ?? r.mensaje ?? null); })} className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">{enviando ? "Guardando…" : "Guardar recuento"}</button>
    </div>
  );
}
