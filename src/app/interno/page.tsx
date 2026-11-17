import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { usuarioInterno } from "@/lib/equipo";

/** Entrada del panel: cada rol cae en su pantalla principal. */
export default function Inicio() {
  return <Suspense fallback={null}><Redirigir /></Suspense>;
}

async function Redirigir(): Promise<null> {
  await connection();
  const u = await usuarioInterno();
  if (!u) redirect("/interno/entrar");
  redirect(u.rol === "admin" ? "/interno/tablero" : u.rol === "chofer" ? "/interno/chofer" : u.rol === "mostrador" ? "/interno/mostrador" : u.rol === "supervisor" ? "/interno/caja" : "/interno/pedidos");
}
