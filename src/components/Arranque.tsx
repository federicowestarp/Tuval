"use client";

import { useEffect, useState } from "react";
import { LogoAnimado } from "@/components/Logo";
import { AnilloCargando } from "@/components/Progreso";

/**
 * Pantalla de arranque (docs/marca/ANIMACIONES.md §1): el anillo se traza, aparece el punto, entra «Tuval» y el punto late.
 * Se ve completa (~1.5 s) solo la primera vez en la sesión; después no aparece (un script en layout la oculta antes de pintar),
 * para que nunca se corte a la mitad.
 * Tocar la pantalla la salta. Un respaldo CSS la oculta a los 4 s pase lo que pase.
 */
export function Arranque() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let vista = false;
    try {
      vista = sessionStorage.getItem("tuval.arranque") === "1";
      sessionStorage.setItem("tuval.arranque", "1");
    } catch { /* sin almacenamiento: se trata como primera vez */ }
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setVisible(false), vista ? 0 : reducido ? 150 : 1600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      aria-hidden
      onClick={() => setVisible(false)}
      className={`arranque fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-300 print:hidden ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <LogoAnimado className="h-14 w-auto sm:h-16" />
    </div>
  );
}

/** Espera de pantalla completa dentro de la app: el anillo de marca gira (48 px). */
export function LogoCargando({ texto }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy="true">
      <AnilloCargando className="h-12 w-12" />
      {texto && <p className="text-[14px] text-secundario">{texto}</p>}
    </div>
  );
}
