"use client";

export function BotonImprimir() {
  return <button type="button" onClick={() => window.print()} className="rounded-full bg-azul px-4 py-2 text-[14px] font-semibold text-white">Imprimir o guardar PDF</button>;
}
