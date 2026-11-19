import { connection } from "next/server";
import { sql } from "@/lib/db";
import { AvisoRecorrido } from "./Recorrido";

/** Último recorrido terminado hoy y cada cuántos minutos toca. */
export async function estadoRecorrido(): Promise<{ ultimo: string | null; cadaMin: number }> {
  const [r] = await sql<{ ultimo: Date | null; cada: number }[]>`
    select (select max(terminado_en) from recorridos_tienda
            where (terminado_en at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date) ultimo,
           coalesce((select valor from parametros_operacion where clave = 'recorrido_cada_min'), 30)::float cada`;
  return { ultimo: r?.ultimo ? new Date(r.ultimo).toISOString() : null, cadaMin: r?.cada ?? 30 };
}

/** Aviso "toca recorrido" para caja y la tablet del vendedor. */
export async function AvisoRecorridoServidor() {
  await connection();
  const e = await estadoRecorrido();
  return <AvisoRecorrido ultimo={e.ultimo} cadaMin={e.cadaMin} />;
}
