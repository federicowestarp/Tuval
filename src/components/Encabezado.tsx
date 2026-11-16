import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BotonCarrito } from "@/components/carrito/BotonCarrito";

export function Encabezado() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <Link href="/"><Logo /></Link>
      <BotonCarrito />
    </div>
  );
}
