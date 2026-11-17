import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { parametros } from "@/lib/caja";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../../Navegacion";
import { CierreTurno } from "../Turno";

export default function Cierre() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="mostrador" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido /></Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  await connection();
  const yo = await requerirInterno("mostrador");
  const [t] = await sql<{ registradora_id: string }[]>`select registradora_id from cajas where abierta_por = ${yo.id} and cerrada_en is null order by abierta_en desc limit 1`;
  if (!t) {
    // Tras confirmar, la página se vuelve a cargar: si acaba de cerrar, solo se le dice "Cierre registrado" (sin montos).
    const [reciente] = await sql`select 1 from cajas where cerrada_por = ${yo.id} and cerrada_en > now() - interval '15 minutes'`;
    return reciente
      ? <section className="mx-auto max-w-xl rounded-[20px] bg-white p-8 text-center"><p className="font-display text-3xl font-semibold">Cierre registrado</p><Link href="/interno/mostrador" className="mt-4 inline-block text-azul">Volver al mostrador</Link></section>
      : <p className="rounded-[20px] bg-white p-6">No tienes un turno abierto.</p>;
  }
  const [terminales, p] = await Promise.all([
    sql<{ id: string; nombre: string }[]>`
      select tr.id, tr.nombre from caja_terminales ct join terminales tr on tr.id = ct.terminal_id where ct.registradora_id = ${t.registradora_id} and tr.activa order by tr.nombre`,
    parametros(),
  ]);
  return <CierreTurno terminales={terminales} fondoFijo={p.fondo_fijo} />;
}
