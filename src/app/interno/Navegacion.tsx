import Link from "next/link";
import { Logo } from "@/components/Logo";
import { salir } from "./sesion-acciones";

export function NavegacionInterna({ actual }: { actual: "pedidos" | "demanda" | "equipo" }) {
  const c = (k: string) => (k === actual ? "text-azul" : "text-secundario hover:text-azul");
  return (
    <header className="flex items-center justify-between gap-3 border-b border-linea bg-white px-4 py-3">
      <Link href="/interno/pedidos"><Logo /></Link>
      <nav className="flex items-center gap-4 text-sm font-semibold">
        <Link href="/interno/pedidos" className={c("pedidos")}>Pedidos</Link>
        <Link href="/interno/demanda" className={c("demanda")}>Demanda</Link>
        <Link href="/interno/equipo" className={c("equipo")}>Equipo</Link>
        <form action={salir}><button className="text-secundario hover:text-azul">Salir</button></form>
      </nav>
    </header>
  );
}
