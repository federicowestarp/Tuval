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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        {tarjetas.map((t, i) => (
          <article key={t.id} className="overflow-hidden rounded-xl border-2 border-[#0B3D91] text-[12px]" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <header className="flex items-center justify-between gap-2 bg-[#0B3D91] px-3 py-1.5 text-white">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide">Tuval · {inv.nombre}</span>
              <span className="shrink-0 text-[18px] font-bold tabular-nums">#{String(t.folio).padStart(4, "0")}</span>
            </header>
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[15px] font-semibold leading-tight break-words">{t.producto}</p>
                <p className="text-[#555]">SKU <span className="font-mono">{t.sku}</span>{t.unidad ? ` · cuenta en ${t.unidad}` : ""}</p>
                <p className="inline-block rounded-md bg-[#E8F1FB] px-2 py-0.5 font-semibold text-[#0B3D91]">Ubicación: {t.ubicacion ?? "________"}</p>
              </div>
              <div className="h-[5.5rem] w-[5.5rem] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            </div>
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup><col className="w-[30%]" /><col className="w-[25%]" /><col className="w-[45%]" /></colgroup>
              <thead className="bg-[#E8F1FB] text-[#0B3D91]">
                <tr><th className="border-y border-r border-[#0B3D91] px-2 py-1 text-left">Conteo</th><th className="border border-[#0B3D91] px-2 py-1">Cantidad</th><th className="border-y border-l border-[#0B3D91] px-2 py-1">Nombre / firma</th></tr>
              </thead>
              <tbody>
                {[["1º", ""], ["2º", ""], ["3º", "si no coinciden"]].map(([c, nota], k) => (
                  <tr key={c} className={k === 2 ? "bg-[#FFF6E5]" : ""}>
                    <td className="h-9 border-r border-b border-[#0B3D91] px-2 font-semibold">{c}{nota && <span className="block text-[9px] font-normal text-[#8A5A00]">{nota}</span>}</td>
                    <td className="border border-t-0 border-[#0B3D91]" /><td className="border-b border-l border-[#0B3D91]" />
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </main>
  );
}
