"use client";

import { useEffect, useState } from "react";
import { Simbolo } from "@/components/Logo";

/**
 * Pantalla de arranque: el símbolo de Tuval late mientras la app termina de cargar (sobre todo en celular).
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
      <Simbolo className="latido h-16 w-16" />
    </div>
  );
}

/** El mismo latido para esperas dentro de la app. */
export function LogoCargando({ texto }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy="true" aria-label="Cargando">
      <Simbolo className="latido h-12 w-12" />
      {texto && <p className="text-[14px] text-secundario">{texto}</p>}
    </div>
  );
}
