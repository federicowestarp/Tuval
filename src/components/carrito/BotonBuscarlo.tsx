"use client";

import { useState } from "react";
import Link from "next/link";
import { useCarrito } from "./CarritoProvider";
import { clasesBoton } from "@/components/ui";
import { IconoCheck } from "@/components/Iconos";

/** Cuando el cliente no encuentra algo: lo agrega como "búsquenlo ustedes". */
export function BotonBuscarlo({ texto }: { texto: string }) {
  const { agregarEspecial } = useCarrito();
  const [listo, setListo] = useState(false);
  if (listo)
    return (
      <p className="aparecer mt-5 inline-flex items-center gap-2 font-semibold text-azul">
        <IconoCheck className="h-5 w-5" /> Agregado. <Link href="/carrito" className="underline">Ver carrito</Link>
      </p>
    );
  return (
    <button type="button" onClick={() => { agregarEspecial(texto, 1); setListo(true); }} className={`mt-5 ${clasesBoton("principal", "grande")}`}>
      Pedir “{texto}”
    </button>
  );
}
