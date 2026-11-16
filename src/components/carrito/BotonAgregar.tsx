"use client";

import { useState } from "react";
import { useCarrito, type LineaCarrito } from "./CarritoProvider";

export function BotonAgregar({ producto }: { producto: Omit<LineaCarrito, "cantidad"> }) {
  const { agregar } = useCarrito();
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        agregar(producto);
        setListo(true);
        setTimeout(() => setListo(false), 1200);
      }}
      className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold transition ${listo ? "bg-cian text-profundo" : "bg-azul text-white"}`}
    >
      {listo ? "Agregado ✓" : "Agregar"}
    </button>
  );
}
