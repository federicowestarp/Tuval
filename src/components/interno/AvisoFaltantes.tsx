import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { marcarFaltanteVisto } from "./avisos-acciones";

/**
 * Lo que los clientes buscaron en la tienda (buscador o quiosco) y no tenemos: le aparece a caja, vendedores y dirección
 * para conseguirlo, sin que el cliente tenga que pedirlo en recepción.
 */
export async function AvisoFaltantes() {
  await connection();
  await requerirInterno("mostrador");
  const filas = await sql<{ id: string; descripcion: string; hora: string; telefono: string | null; en_catalogo: boolean }[]>`
    select id, descripcion, to_char(creado_en at time zone 'America/Mexico_City', 'DD/MM HH24:MI') hora, contacto_telefono telefono, producto_id is not null en_catalogo
    from solicitudes_producto
    where origen = 'buscador_tienda' and atendida_en is null and estado = 'nueva' and creado_en > now() - interval '7 days'
    order by creado_en desc limit 8`;
  if (filas.length === 0) return null;
  return (
    <section className="space-y-2 rounded-[20px] bg-[#FFF6E5] p-4 ring-1 ring-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Buscaron en la tienda y no lo tenemos <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-[13px]">{filas.length}</span></p>
        <Link href="/interno/demanda" className="text-[14px] font-semibold text-azul">Conseguirlo en Demanda ›</Link>
      </div>
      <ul className="divide-y divide-amber-200 text-[14px]">
        {filas.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <strong>“{f.descripcion}”</strong> <span className="text-secundario">· {f.hora} · {f.en_catalogo ? "en catálogo, sin existencia" : "no está en catálogo"}</span>
              {f.telefono && <span className="block">Dejó su celular: <a href={`https://wa.me/52${f.telefono}`} target="_blank" className="font-semibold text-azul">{f.telefono}</a></span>}
            </span>
            <form action={marcarFaltanteVisto}><input type="hidden" name="id" value={f.id} /><button className="rounded-full border border-amber-500 px-3 py-1 text-[13px] text-amber-800">Visto</button></form>
          </li>
        ))}
      </ul>
    </section>
  );
}
