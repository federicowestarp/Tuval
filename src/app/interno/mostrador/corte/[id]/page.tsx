import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { puede, requerirInterno } from "@/lib/equipo";
import { etiquetaDenominacion, type LineaConteo } from "@/lib/denominaciones";
import { Imprimir } from "../../ticket/[id]/Imprimir";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Ticket de corte para firmar. Solo trae lo que el cajero contó (nunca el esperado ni diferencias):
 * total contado, lo que se queda de fondo en la caja y lo que se retira.
 */
export default function TicketCorte(props: PageProps<"/interno/mostrador/corte/[id]">) {
  return <Suspense fallback={null}><Contenido params={props.params} /></Suspense>;
}

async function Contenido({ params }: { params: PageProps<"/interno/mostrador/corte/[id]">["params"] }) {
  await connection();
  const yo = await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t] = await sql<{ caja: string; cajero: string; cajero_id: string; abierta: string; cerrada: string | null }[]>`
    select coalesce(r.nombre, 'Caja') caja, u.nombre cajero, u.id cajero_id,
           to_char(c.abierta_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') abierta,
           to_char(c.cerrada_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') cerrada
    from cajas c left join cajas_registradoras r on r.id = c.registradora_id join usuarios_internos u on u.id = c.abierta_por where c.id = ${id}`;
  if (!t || (t.cajero_id !== yo.id && !puede(yo.rol, "supervisor"))) notFound();
  const conteos = await sql<{ tipo: string; lineas: LineaConteo[]; total: number }[]>`
    select tipo, lineas, total::float total from conteos_caja where turno_id = ${id} and tipo in ('cierre', 'fondo_siguiente') order by creado_en desc`;
  const cierre = conteos.find((c) => c.tipo === "cierre"), fondo = conteos.find((c) => c.tipo === "fondo_siguiente");
  if (!cierre || !fondo) notFound();
  const retiro = cierre.lineas.map((l) => ({ d: l.d, piezas: l.piezas - (fondo.lineas.find((f) => f.d === l.d)?.piezas ?? 0) }));
  const total = (ls: LineaConteo[]) => ls.reduce((a, l) => a + l.d * l.piezas, 0);
  const tabla = (ls: LineaConteo[]) => ls.filter((l) => l.piezas > 0).map((l) => (
    <p key={l.d} className="flex justify-between"><span>{l.piezas} × {etiquetaDenominacion(l.d)}</span><span>{mx(l.piezas * l.d)}</span></p>
  ));
  return (
    <main className="mx-auto w-[76mm] bg-white p-2 font-mono text-[12px] leading-tight text-black">
      <p className="text-center text-[16px] font-bold">TUVAL · CORTE DE CAJA</p>
      <p className="mt-2">{t.caja} · Cajero: {t.cajero}</p>
      <p>Abrió: {t.abierta}</p>
      <p>Cerró: {t.cerrada ?? "—"}</p>
      <hr className="my-2 border-dashed border-black" />
      <p className="font-bold">EFECTIVO CONTADO AL CIERRE</p>
      {tabla(cierre.lineas)}
      <p className="flex justify-between font-bold"><span>TOTAL CONTADO</span><span>{mx(cierre.total)}</span></p>
      <hr className="my-2 border-dashed border-black" />
      <p className="font-bold">SE QUEDA EN CAJA (FONDO)</p>
      {tabla(fondo.lineas)}
      <p className="flex justify-between font-bold"><span>FONDO</span><span>{mx(fondo.total)}</span></p>
      <hr className="my-2 border-dashed border-black" />
      <p className="font-bold">SE RETIRA</p>
      {tabla(retiro)}
      <p className="flex justify-between text-[14px] font-bold"><span>RETIRO</span><span>{mx(total(retiro))}</span></p>
      <hr className="my-2 border-dashed border-black" />
      <p className="mt-2">Declaro que al cierre había {mx(cierre.total)}.</p>
      <p className="mt-6">Firma cajero: ____________________</p>
      <p className="mt-5">Recibe retiro: _____________________</p>
      <Imprimir />
    </main>
  );
}
