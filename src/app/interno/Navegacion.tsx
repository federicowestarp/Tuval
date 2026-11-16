import Link from "next/link";
import { Logo } from "@/components/Logo";

export function NavegacionInterna({ actual }: { actual: "pedidos" | "demanda" }) {
  const c = (k: string) => (k === actual ? "text-azul" : "text-secundario hover:text-azul");
  return (
    <header className="flex items-center justify-between border-b border-linea bg-white px-4 py-3">
      <Link href="/"><Logo /></Link>
      <nav className="flex gap-4 text-sm font-semibold">
        <Link href="/interno/pedidos" className={c("pedidos")}>Pedidos</Link>
        <Link href="/interno/demanda" className={c("demanda")}>Demanda</Link>
      </nav>
    </header>
  );
}
