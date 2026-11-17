"use client";

import { useTransition } from "react";
import { registrarImpresion } from "./acciones";

/** Imprime y deja registrado el precio de cada etiqueta (así el sistema sabe cuáles reimprimir si cambia). */
export function ImprimirEtiquetas({ ids }: { ids: string[] }) {
  const [enviando, iniciar] = useTransition();
  return (
    <button type="button" disabled={enviando} onClick={() => { window.print(); iniciar(() => registrarImpresion(ids)); }}
      className="w-full rounded-full bg-azul py-3 font-semibold text-white sm:w-auto sm:px-8">
      {enviando ? "Registrando…" : `Imprimir ${ids.length} etiqueta${ids.length === 1 ? "" : "s"}`}
    </button>
  );
}
