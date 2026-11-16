"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IconoBolsa } from "@/components/Iconos";
import { useCarrito } from "@/components/carrito/CarritoProvider";

const ENLACES = [
  { href: "/tienda", texto: "Tienda" },
  { href: "/lista", texto: "Pedir con lista" },
  { href: "/#obras", texto: "Para obras" },
  { href: "/cuenta/pedidos", texto: "Mis pedidos" },
];

export function BarraSuperior() {
  const { piezas } = useCarrito();
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-linea/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Inicio"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-[14px] md:flex">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} className={`transition hover:text-azul ${ruta === e.href ? "font-semibold text-azul" : "text-acero"}`}>
              {e.texto}
            </Link>
          ))}
        </nav>
        <Link href="/carrito" aria-label={`Carrito, ${piezas} productos`} className="relative -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-azul hover:bg-niebla">
          <IconoBolsa />
          {piezas > 0 && (
            <span className="aparecer absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cian px-1 text-[11px] font-bold text-profundo">
              {piezas > 99 ? "99+" : piezas}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
