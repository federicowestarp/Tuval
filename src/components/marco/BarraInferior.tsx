"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoCaja, IconoInicio, IconoLista, IconoPersona, IconoTienda } from "@/components/Iconos";

const TABS = [
  { href: "/", texto: "Inicio", Icono: IconoInicio, activa: (r: string) => r === "/" },
  { href: "/tienda", texto: "Tienda", Icono: IconoTienda, activa: (r: string) => r.startsWith("/tienda") },
  { href: "/lista", texto: "Lista", Icono: IconoLista, activa: (r: string) => r.startsWith("/lista") },
  { href: "/cuenta/pedidos", texto: "Pedidos", Icono: IconoCaja, activa: (r: string) => r.startsWith("/cuenta/pedidos") || r.startsWith("/pedido") },
  { href: "/cuenta", texto: "Cuenta", Icono: IconoPersona, activa: (r: string) => r === "/cuenta" || r.startsWith("/cuenta/direcciones") },
];

/** Barra de pestañas tipo app, solo en celular. */
export function BarraInferior() {
  const ruta = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-linea/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {TABS.map(({ href, texto, Icono, activa }) => {
          const on = activa(ruta);
          return (
            <Link key={href} href={href} className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${on ? "text-azul" : "text-secundario/80"}`}>
              <Icono className="h-6 w-6" />
              {texto}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
