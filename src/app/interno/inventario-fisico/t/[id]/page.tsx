import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { Esqueleto } from "@/components/interno/Esqueleto";
import { NavegacionInterna } from "../../../Navegacion";
import { FormConteo } from "./FormConteo";

/** Lo que abre el QR de la tarjeta. Conteo ciego: nunca muestra la existencia del sistema ni los otros conteos. */
export default function ContarTarjeta(props: PageProps<"/interno/inventario-fisico/t/[id]">) {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <NavegacionInterna actual="conteo" />
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-6">
        <Suspense fallback={<Esqueleto />}><Contenido params={props.params} /></Suspense>
      </main>
    </div>
  );
}

async function Contenido({ params }: { params: PageProps<"/interno/inventario-fisico/t/[id]">["params"] }) {
  await connection();
  const yo = await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t] = await sql<{ inventario_id: string; inventario: string; estado: string; folio: number; producto: string; sku: string; unidad: string | null; ubicacion: string | null; imagen_url: string | null;
    c1: boolean; c2: boolean; c3: boolean; coinciden: boolean; contador1: string | null; contador2: string | null; final: boolean }[]>`
    select t.inventario_id, i.nombre inventario, i.estado, t.folio, p.nombre producto, p.sku, p.unidad, t.ubicacion, p.imagen_url,
           t.conteo1 is not null c1, t.conteo2 is not null c2, t.conteo3 is not null c3, coalesce(t.conteo1 = t.conteo2, false) coinciden,
           t.contador1, t.contador2, t.final is not null final
    from tarjetas_inventario t join inventarios_fisicos i on i.id = t.inventario_id join productos p on p.id = t.producto_id where t.id = ${id}`;
  if (!t) notFound();
  const turno = !t.c1 ? 1 : !t.c2 ? 2 : !t.coinciden && !t.c3 ? 3 : null;
  const yaConte = (turno === 2 && t.contador1 === yo.id) || (turno === 3 && (t.contador1 === yo.id || t.contador2 === yo.id));
  return (
    <>
      <Link href={`/interno/inventario-fisico/${t.inventario_id}`} className="text-[14px] text-azul">← {t.inventario}</Link>
      <section className="space-y-3 rounded-[20px] bg-white p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.imagen_url && <img src={t.imagen_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-contain" />}
          <div className="min-w-0">
            <p className="text-[13px] text-secundario">Tarjeta #{String(t.folio).padStart(4, "0")}{t.ubicacion ? ` · ${t.ubicacion}` : ""}</p>
            <h1 className="text-[20px] font-semibold leading-tight">{t.producto}</h1>
            <p className="text-[14px] text-secundario">SKU {t.sku}{t.unidad ? ` · cuenta en ${t.unidad}` : ""}</p>
          </div>
        </div>
        {t.estado !== "abierto" ? <p className="rounded-xl bg-niebla p-3">Este inventario ya se cerró.</p>
          : turno == null ? <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">Tarjeta terminada ✓</p>
          : yaConte ? <p className="rounded-xl bg-amber-50 p-3">Ya contaste esta tarjeta. El {turno}º conteo lo hace otra persona.</p>
          : <FormConteo key={id} tarjetaId={id} turno={turno} folio={String(t.folio).padStart(4, "0")} inventarioId={t.inventario_id} />}
      </section>
    </>
  );
}
