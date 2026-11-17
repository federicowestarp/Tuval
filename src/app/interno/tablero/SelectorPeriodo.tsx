"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const corta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC", ...(f.slice(0, 4) !== String(new Date().getFullYear()) ? { year: "2-digit" } : {}) }).replace(".", "");

/**
 * Una fila compacta: periodos rápidos y "Fechas" (rango libre del … al …), que se abre solo cuando se usa.
 * Carga un periodo a la vez (sin precargar los demás) y avisa mientras calcula.
 */
export function SelectorPeriodo({ periodos, actual, desde, hasta }: { periodos: readonly { id: string; nombre: string }[]; actual: string | null; desde: string; hasta: string }) {
  const router = useRouter();
  const [cargando, iniciar] = useTransition();
  const [elegido, setElegido] = useState(actual);
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const ir = (url: string, id: string | null) => { setElegido(id); setAbierto(false); iniciar(() => router.push(url, { scroll: false })); };
  const pill = (activo: boolean) => `shrink-0 rounded-full px-3 py-1 ${activo ? "bg-azul text-white" : "text-secundario hover:text-azul"}`;

  return (
    <div className="w-full space-y-2 sm:w-auto">
      <nav className={`flex items-center gap-0.5 overflow-x-auto rounded-full bg-white p-1 text-[13px] [scrollbar-width:none] ${cargando ? "opacity-60" : ""}`}>
        {periodos.map((x) => (
          <button key={x.id} type="button" disabled={cargando} onClick={() => ir(`/interno/tablero?p=${x.id}`, x.id)} className={pill(x.id === elegido)}>{x.nombre}</button>
        ))}
        <button type="button" onClick={() => setAbierto(!abierto)} className={pill(elegido === null)}>
          {elegido === null ? `${corta(desde)}${desde !== hasta ? `–${corta(hasta)}` : ""}` : "Fechas"} ▾
        </button>
        {cargando && <span className="shrink-0 animate-pulse px-2 font-semibold text-azul">…</span>}
      </nav>
      {abierto && (
        <form onSubmit={(e) => { e.preventDefault(); if (d) ir(`/interno/tablero?desde=${d}&hasta=${h || d}`, null); }} className="flex items-center gap-1.5 rounded-full bg-white p-1 text-[13px]">
          <input type="date" value={d} max={h || undefined} onChange={(e) => setD(e.target.value)} aria-label="Desde" className="h-8 min-w-0 flex-1 rounded-full border border-linea px-2" />
          <span className="text-secundario">al</span>
          <input type="date" value={h} min={d || undefined} onChange={(e) => setH(e.target.value)} aria-label="Hasta" className="h-8 min-w-0 flex-1 rounded-full border border-linea px-2" />
          <button disabled={cargando} className="h-8 shrink-0 rounded-full bg-azul px-3 font-semibold text-white">Ver</button>
        </form>
      )}
    </div>
  );
}
