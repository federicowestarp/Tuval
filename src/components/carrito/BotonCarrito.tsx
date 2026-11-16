"use client";

import Link from "next/link";
import { useCarrito } from "./CarritoProvider";

export function BotonCarrito() {
  const { piezas } = useCarrito();
  return (
    <Link href="/carrito" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-azul">
      Carrito{piezas > 0 && <span className="ml-2 rounded-full bg-cian px-2 py-0.5 text-profundo">{piezas}</span>}
    </Link>
  );
}
