"use client";

import Link from "next/link";
import { useCarrito, type LineaCarrito } from "@/components/carrito/CarritoProvider";
import { IconoMas, IconoMenos } from "@/components/Iconos";
import { clasesBoton } from "@/components/ui";

export function BotonAgregarFicha({ producto }: { producto: Omit<LineaCarrito, "cantidad"> }) {
  const { lineas, agregar, cambiar } = useCarrito();
  const n = lineas.find((l) => l.id === producto.id)?.cantidad ?? 0;
  if (n === 0) return <button onClick={() => agregar(producto)} className={clasesBoton("principal", "grande", true)}>Agregar al pedido</button>;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 items-center rounded-full bg-niebla">
        <button onClick={() => cambiar(producto.id, n - 1)} aria-label="Quitar uno" className="flex h-14 w-14 items-center justify-center text-azul"><IconoMenos className="h-5 w-5" /></button>
        <span className="min-w-8 text-center text-lg font-semibold">{n}</span>
        <button onClick={() => cambiar(producto.id, n + 1)} aria-label="Agregar uno" className="flex h-14 w-14 items-center justify-center text-azul"><IconoMas className="h-5 w-5" /></button>
      </div>
      <Link href="/carrito" className={clasesBoton("principal", "grande")}>Ver pedido</Link>
    </div>
  );
}
