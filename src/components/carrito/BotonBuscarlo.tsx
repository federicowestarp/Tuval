"use client";

import { useState } from "react";
import Link from "next/link";
import { useCarrito } from "./CarritoProvider";

/** Cuando el cliente no encuentra algo: lo agrega como "búsquenlo ustedes". */
export function BotonBuscarlo({ texto }: { texto: string }) {
  const { agregarEspecial } = useCarrito();
  const [listo, setListo] = useState(false);
  if (listo)
    return (
      <p className="mt-3 text-sm font-semibold">
        Agregado. Lo buscamos y te avisamos. <Link href="/carrito" className="underline">Ir al carrito</Link>
      </p>
    );
  return (
    <button
      type="button"
      onClick={() => {
        agregarEspecial(texto, 1);
        setListo(true);
      }}
      className="mt-3 rounded-lg bg-cian px-4 py-3 font-semibold text-profundo"
    >
      Pedir “{texto}” y que lo busquen
    </button>
  );
}
