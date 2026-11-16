import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonCarrito } from "@/components/carrito/BotonCarrito";

export function Encabezado() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Link href="/"><Logo /></Link>
      <nav className="flex items-center gap-3 text-sm text-white">
        <Link href="/lista" className="hover:text-cian">Pedir con lista</Link>
        <Link href="/cuenta/direcciones" className="hidden hover:text-cian sm:inline">Mis direcciones</Link>
        <BotonCarrito />
      </nav>
    </div>
  );
}
