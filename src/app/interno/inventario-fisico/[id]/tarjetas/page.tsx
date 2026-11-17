import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { urlBase } from "@/lib/url";
import { Imprimir } from "../../../mostrador/ticket/[id]/Imprimir";

/**
 * Tarjetas de inventario para imprimir (tipo Formitec): folio, producto, ubicación y QR.
 * Tres renglones de conteo en blanco, sin la existencia del sistema (conteo ciego).
 */
export default function Tarjetas(props: PageProps<"/interno/inventario-fisico/[id]/tarjetas">) {
  return <Suspense fallback={null}><Contenido params={props.params} /></Suspense>;
}

async function Contenido({ params }: { params: PageProps<"/interno/inventario-fisico/[id]/tarjetas">["params"] }) {
  await connection();
  await requerirInterno("supervisor");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [inv] = await sql<{ nombre: string; almacen: string }[]>`
    select i.nombre, a.nombre almacen from inventarios_fisicos i join almacenes a on a.id = i.almacen_id where i.id = ${id}`;
  if (!inv) notFound();
  const tarjetas = await sql<{ id: string; folio: number; producto: string; sku: string; unidad: string | null; ubicacion: string | null }[]>`
    select t.id, t.folio, p.nombre producto, p.sku, p.unidad, t.ubicacion
    from tarjetas_inventario t join productos p on p.id = t.producto_id where t.inventario_id = ${id} order by t.folio`;
  const base = await urlBase();
  const qrs = await Promise.all(tarjetas.map((t) => QRCode.toString(`${base}/interno/inventario-fisico/t/${t.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" })));
  return (
    <main className="bg-white p-4 text-black">
      <div className="mb-3 print:hidden">
        <p className="font-semibold">{inv.nombre} · {inv.almacen} · {tarjetas.length} tarjetas</p>
        <p className="text-[13px]">Imprime en hoja carta, dos tarjetas por renglón. Pega cada tarjeta en el producto o su ubicación.</p>
        <Imprimir />
      </div>
      <div className="grid grid-cols-2 gap-3 print:gap-2">
        {tarjetas.map((t, i) => (
          <article key={t.id} className="break-inside-avoid rounded border border-black p-3 text-[12px]" style={{ pageBreakInside: "avoid" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide">Tuval · {inv.nombre}</p>
                <p className="text-[22px] font-bold leading-none">#{String(t.folio).padStart(4, "0")}</p>
                <p className="mt-1 font-semibold leading-tight">{t.producto}</p>
                <p>SKU {t.sku}{t.unidad ? ` · ${t.unidad}` : ""}</p>
                <p>Ubicación: {t.ubicacion ?? "__________"}</p>
              </div>
              <div className="h-20 w-20 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            </div>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead><tr><th className="border border-black p-1 text-left">Conteo</th><th className="border border-black p-1">Cantidad</th><th className="border border-black p-1">Nombre / firma</th></tr></thead>
              <tbody>
                {["1º", "2º", "3º (si no coinciden)"].map((c) => (
                  <tr key={c}><td className="border border-black p-1">{c}</td><td className="h-7 w-20 border border-black" /><td className="border border-black" /></tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </main>
  );
}
