import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Marco } from "@/components/marco/Marco";
import { sql } from "@/lib/db";
import { urlPanel } from "@/lib/etiqueta";

export const metadata: Metadata = { title: "Recoger pedido", robots: { index: false } };

/** Página que el cliente comparte con quien va a recoger: su QR para caja, sin datos de pago ni dirección. */
export default function RecogerPedido(props: PageProps<"/recoger/[token]">) {
  return (
    <Marco pie={false}>
      <main className="mx-auto max-w-md px-4 py-10">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-[24px] bg-niebla" />}><Contenido params={props.params} /></Suspense>
      </main>
    </Marco>
  );
}

async function Contenido({ params }: { params: PageProps<"/recoger/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(token)) notFound();
  const [p] = await sql<{ folio: string; estado: string; recibe_nombre: string | null; piezas: number; sucursal: string | null; direccion: string | null }[]>`
    select p.folio, p.estado, p.recibe_nombre, (select coalesce(sum(cantidad), 0)::float from pedido_partidas where pedido_id = p.id) piezas,
           a.nombre sucursal, a.direccion
    from pedidos p left join almacenes a on a.id = coalesce(p.almacen_surtido, (select id from almacenes where tipo = 'sucursal' and activo order by creado_en limit 1))
    where p.token_receptor = ${token} and p.tipo_entrega = 'recoger'`;
  if (!p) notFound();
  const entregado = p.estado.startsWith("entregado");
  const listo = p.estado === "surtido" || p.estado === "en_ruta";
  const qr = listo ? await QRCode.toString(urlPanel(`/interno/recoger/${token}`), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="text-[13px] font-medium text-secundario">Pedido {p.folio} · {p.piezas} piezas</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight">{entregado ? "Ya se recogió." : listo ? "Listo para recoger." : "Aún lo estamos preparando."}</h1>
        {p.recibe_nombre && !entregado && <p className="mt-1 text-[17px]">Recoge: <strong>{p.recibe_nombre}</strong></p>}
      </div>
      {qr && (
        <div className="flex flex-col items-center gap-3 rounded-[24px] bg-[#E8F1FB] p-6">
          <p className="text-[18px] font-semibold">Enseña este código en caja</p>
          <div className="h-56 w-56 rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-[14px] text-secundario">Revisas las piezas con nosotros, firmas y listo.</p>
        </div>
      )}
      {!listo && !entregado && <p className="text-[15px] text-secundario">Te avisamos cuando esté en la sucursal. Abre esta misma liga para ver el código.</p>}
      {p.sucursal && <p className="text-[14px] text-secundario">{p.sucursal}{p.direccion ? ` · ${p.direccion}` : ""}</p>}
    </div>
  );
}
