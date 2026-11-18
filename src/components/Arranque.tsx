"use client";

import { useEffect, useState } from "react";
import { AnilloCargando } from "@/components/Progreso";

/**
 * Pantalla de arranque: el anillo del símbolo de Tuval se va cerrando mientras la app termina de cargar (sobre todo en celular).
 * Se va sola al cargar; si algo falla, una animación CSS la oculta a los 4 s para no tapar nunca la página.
 */
export function Arranque() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div aria-hidden className={`arranque fixed inset-0 print:hidden z-[100] flex items-center justify-center bg-white transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <AnilloCargando className="h-16 w-16" />
    </div>
  );
}

/** La misma animación para esperas dentro de la app. */
export function LogoCargando({ texto }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy="true" aria-label="Cargando">
      <AnilloCargando className="h-12 w-12" />
      {texto && <p className="text-[14px] text-secundario">{texto}</p>}
    </div>
  );
}
