"use client";

import { useState } from "react";

/**
 * Selector de archivo con el diseño de la app (el control nativo del navegador sale en inglés y desalineado).
 * El <input> real queda oculto dentro de la etiqueta, así funciona igual en formularios y en el iPhone.
 */
export function ElegirArchivo({
  name, accept, capture, required, texto, ayuda, onArchivo, grande = false,
}: {
  name?: string; accept?: string; capture?: "environment" | "user"; required?: boolean;
  texto: string; ayuda?: string; onArchivo?: (f: File | null) => void; grande?: boolean;
}) {
  const [nombre, setNombre] = useState<string | null>(null);
  return (
    <label className={`flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed ${nombre ? "border-azul bg-[#E8F1FB]" : "border-linea bg-white"} ${grande ? "p-5" : "px-3 py-2.5"}`}>
      <input type="file" name={name} accept={accept} capture={capture} required={required} className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setNombre(f?.name ?? null); onArchivo?.(f); }} />
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-azul text-white ${grande ? "h-10 w-10" : "h-8 w-8"}`} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 16V4M6 10l6-6 6 6M5 20h14" /></svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block font-semibold text-azul ${grande ? "text-[16px]" : "text-[14px]"}`}>{nombre ? "Cambiar archivo" : texto}</span>
        <span className="block truncate text-[12px] text-secundario">{nombre ?? ayuda ?? "Toca para elegir"}</span>
      </span>
    </label>
  );
}
