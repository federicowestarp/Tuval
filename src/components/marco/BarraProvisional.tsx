import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Barra mientras carga la interactiva: misma forma, sin menú. */
export function BarraProvisional({ inicio = "/", titulo }: { inicio?: string; titulo?: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-full bg-white/70 pl-5 shadow-[0_8px_30px_rgba(29,29,31,0.08)] ring-1 ring-black/5 backdrop-blur-xl">
        <Link href={inicio}><Logo /></Link>
        {titulo && <span className="border-l border-linea pl-3 text-[14px] font-semibold text-secundario">{titulo}</span>}
      </div>
    </header>
  );
}
