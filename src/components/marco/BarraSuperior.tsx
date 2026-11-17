"use client";

import Link from "next/link";
import { IconoBolsa } from "@/components/Iconos";
import { useCarrito } from "@/components/carrito/CarritoProvider";
import { BarraFlotante } from "./BarraFlotante";

const EN_LINEA = [
  { href: "/tienda", texto: "Tienda" },
  { href: "/lista", texto: "Pedir con lista" },
  { href: "/obras", texto: "Para obras" },
];

export function BarraSuperior({ whatsapp }: { whatsapp?: string | null }) {
  const { piezas } = useCarrito();
  return (
    <BarraFlotante
      enLinea={EN_LINEA}
      enlaces={[
        { href: "/tienda", texto: "Tienda" },
        { href: "/lista", texto: "Pedir con lista o foto" },
        { href: "/obras", texto: "Para obras y constructoras" },
        { href: "/carrito", texto: "Carrito", nota: piezas ? `${piezas} pza${piezas === 1 ? "" : "s"}` : undefined },
        { href: "/cuenta/pedidos", texto: "Mis pedidos" },
        { href: "/cuenta", texto: "Mi cuenta y direcciones" },
      ]}
      pieMenu={
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/#entregas" className="hover:text-azul">Envíos a todo México</Link>
          {whatsapp && <a href={whatsapp} className="hover:text-azul">WhatsApp</a>}
        </div>
      }
      acciones={
        <Link href="/carrito" aria-label={`Carrito, ${piezas} productos`} className="relative flex h-10 w-10 items-center justify-center rounded-full text-azul hover:bg-niebla">
          <IconoBolsa />
          {piezas > 0 && (
            <span className="aparecer absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-azul px-1 text-[11px] font-semibold text-white">
              {piezas > 99 ? "99+" : piezas}
            </span>
          )}
        </Link>
      }
    />
  );
}
