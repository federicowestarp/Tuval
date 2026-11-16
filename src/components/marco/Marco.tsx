import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BarraSuperior } from "./BarraSuperior";
import { BarraInferior } from "./BarraInferior";
import { PieDePagina } from "./PieDePagina";

function BarraSuperiorFija() {
  return (
    <header className="sticky top-0 z-40 border-b border-linea/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6"><Link href="/"><Logo /></Link></div>
    </header>
  );
}

/** Estructura pública: barra superior, contenido, pie y pestañas en celular. */
export function Marco({ children, fondo = "blanco", pie = true, pestanas = true }: { children: React.ReactNode; fondo?: "blanco" | "niebla"; pie?: boolean; pestanas?: boolean }) {
  return (
    <div className={`flex min-h-full flex-1 flex-col ${fondo === "niebla" ? "bg-niebla" : "bg-white"}`}>
      <Suspense fallback={<BarraSuperiorFija />}>
        <BarraSuperior />
      </Suspense>
      <div className={`flex-1 ${pestanas ? "pb-20 md:pb-0" : ""}`}>{children}</div>
      {pie && <PieDePagina />}
      {pestanas && (
        <Suspense>
          <BarraInferior />
        </Suspense>
      )}
    </div>
  );
}
