import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { etiquetaDenominacion, type LineaConteo } from "@/lib/denominaciones";
import { Imprimir } from "../../ticket/[id]/Imprimir";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Recibo de retiro parcial: va dentro del sobre con el efectivo a caja fuerte. */
export default function Recibo(props: PageProps<"/interno/mostrador/retiro/[id]">) {
  return <Suspense fallback={null}><Contenido params={props.params} /></Suspense>;
}

async function Contenido({ params }: { params: PageProps<"/interno/mostrador/retiro/[id]">["params"] }) {
  await connection();
  await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [r] = await sql<{ folio: string; fecha: string; caja: string; turno: string; cajero: string; lineas: LineaConteo[]; total: number }[]>`
    select rc.folio, to_char(rc.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') fecha, cr.nombre caja,
           left(rc.turno_id::text, 8) turno, u.nombre cajero, cc.lineas, cc.total::float total
    from retiros_caja rc join conteos_caja cc on cc.id = rc.conteo_id join cajas c on c.id = rc.turno_id
    join cajas_registradoras cr on cr.id = c.registradora_id join usuarios_internos u on u.id = rc.cajero_id
    where rc.id = ${id}`;
  if (!r) notFound();
  return (
    <main className="mx-auto w-[76mm] bg-white p-2 font-mono text-[12px] leading-tight text-black">
      <p className="text-center text-[16px] font-bold">TUVAL · RETIRO PARCIAL</p>
      <p className="mt-2">Folio: {r.folio}</p>
      <p>{r.caja} · turno {r.turno}</p>
      <p>Cajero: {r.cajero}</p>
      <p>{r.fecha}</p>
      <hr className="my-2 border-dashed border-black" />
      {r.lineas.filter((l) => l.piezas > 0).map((l) => (
        <p key={l.d} className="flex justify-between"><span>{l.piezas} × {etiquetaDenominacion(l.d)}</span><span>{mx(l.piezas * l.d)}</span></p>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{mx(r.total)}</span></p>
      <p className="mt-6">Firma cajero: ____________________</p>
      <p className="mt-4">Recibe (caja fuerte): ______________</p>
      <Imprimir />
    </main>
  );
}
