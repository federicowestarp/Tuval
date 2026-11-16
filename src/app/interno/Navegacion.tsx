import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { puede, usuarioInterno } from "@/lib/equipo";
import { salir } from "./sesion-acciones";

type Seccion = "tablero" | "pedidos" | "demanda" | "contactos" | "catalogo" | "equipo" | "chofer" | "gastos" | "flotilla";
const SECCIONES: { id: Seccion; texto: string; href: string; minimo?: "admin" | "operador" }[] = [
  { id: "tablero", texto: "Tablero", href: "/interno/tablero", minimo: "admin" },
  { id: "pedidos", texto: "Pedidos", href: "/interno/pedidos", minimo: "operador" },
  { id: "demanda", texto: "Demanda", href: "/interno/demanda", minimo: "operador" },
  { id: "contactos", texto: "Contactos", href: "/interno/contactos", minimo: "operador" },
  { id: "chofer", texto: "Ruta", href: "/interno/chofer" },
  { id: "gastos", texto: "Gastos", href: "/interno/gastos", minimo: "admin" },
  { id: "flotilla", texto: "Flotilla", href: "/interno/flotilla", minimo: "admin" },
  { id: "catalogo", texto: "Catálogo", href: "/interno/catalogo", minimo: "admin" },
  { id: "equipo", texto: "Equipo", href: "/interno/equipo", minimo: "admin" },
];

async function Enlaces({ actual }: { actual: Seccion }) {
  const u = await usuarioInterno();
  if (!u) return null;
  return (
    <>
      {SECCIONES.filter((s) => puede(u.rol, s.minimo)).map((s) => (
        <Link key={s.id} href={s.href} className={s.id === actual ? "text-azul" : "text-secundario hover:text-azul"}>{s.texto}</Link>
      ))}
    </>
  );
}

export function NavegacionInterna({ actual }: { actual: Seccion }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-linea bg-white px-4 py-3">
      <Link href="/interno/pedidos" className="shrink-0"><Logo /></Link>
      <nav className="sin-barra flex items-center gap-4 overflow-x-auto text-sm font-semibold">
        <Suspense fallback={null}><Enlaces actual={actual} /></Suspense>
        <form action={salir}><button className="text-secundario hover:text-azul">Salir</button></form>
      </nav>
    </header>
  );
}
