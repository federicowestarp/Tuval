import Link from "next/link";
import { Logo } from "@/components/Logo";

export function NavegacionInterna({ actual }: { actual: "pedidos" | "demanda" }) {
  const c = (k: string) => (k === actual ? "text-white" : "text-cian");
  return (
    <header className="flex items-center justify-between bg-profundo px-4 py-4">
      <Link href="/"><Logo tono="claro" /></Link>
      <nav className="flex gap-4 text-sm font-semibold">
        <Link href="/interno/pedidos" className={c("pedidos")}>Pedidos</Link>
        <Link href="/interno/demanda" className={c("demanda")}>Demanda</Link>
      </nav>
    </header>
  );
}
