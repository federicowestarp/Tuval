import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { requerirInterno } from "@/lib/equipo";
import { Imprimir } from "./Imprimir";

const mx = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/** Ticket para impresora térmica de 80 mm (o PDF desde el navegador). */
export default function Ticket(props: PageProps<"/interno/mostrador/ticket/[id]">) {
  return <Suspense fallback={null}><Contenido params={props.params} /></Suspense>;
}

async function Contenido({ params }: { params: PageProps<"/interno/mostrador/ticket/[id]">["params"] }) {
  await connection();
  await requerirInterno("mostrador");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await sql<{ folio: string; fecha: string; subtotal: number; iva: number; total: number; comprobante: string; vendedor: string | null; cliente: string | null }[]>`
    select p.folio, to_char(p.creado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') fecha, p.subtotal::float subtotal, p.iva::float iva,
           p.total::float total, p.comprobante, u.nombre vendedor, p.contacto_nombre cliente
    from pedidos p left join usuarios_internos u on u.id = p.vendedor_id where p.id = ${id}`;
  if (!p) notFound();
  const [partidas, pagos] = await Promise.all([
    sql<{ nombre: string; cantidad: number; precio: number }[]>`
      select pr.nombre, pp.cantidad::float cantidad, (pp.precio_unitario * 1.16)::float precio
      from pedido_partidas pp join productos pr on pr.id = pp.producto_id where pp.pedido_id = ${id}`,
    sql<{ forma: string; monto: number; recibido: number | null; referencia_pasarela: string | null }[]>`
      select forma, monto::float monto, recibido::float recibido, referencia_pasarela from pagos where pedido_id = ${id}`,
  ]);
  return (
    <main className="mx-auto w-[76mm] bg-white p-2 font-mono text-[12px] leading-tight text-black">
      <p className="text-center text-[16px] font-bold">TUVAL</p>
      <p className="text-center">Tubería, equipos y eléctrico</p>
      <p className="mt-2">{p.folio} · {p.fecha}</p>
      {p.vendedor && <p>Atendió: {p.vendedor}</p>}
      {p.cliente && <p>Cliente: {p.cliente}</p>}
      <hr className="my-2 border-dashed border-black" />
      {partidas.map((x, i) => (
        <div key={i} className="mb-1">
          <p>{x.nombre}</p>
          <p className="flex justify-between"><span>{x.cantidad} x {mx(x.precio)}</span><span>{mx(x.cantidad * x.precio)}</span></p>
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="flex justify-between"><span>Subtotal</span><span>{mx(p.subtotal)}</span></p>
      <p className="flex justify-between"><span>IVA 16%</span><span>{mx(p.iva)}</span></p>
      <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{mx(p.total)}</span></p>
      {pagos.map((g, i) => (
        <div key={i}>
          <p className="flex justify-between"><span className="capitalize">{g.forma}{g.referencia_pasarela && ` ${g.referencia_pasarela}`}</span><span>{mx(g.recibido ?? g.monto)}</span></p>
          {g.recibido != null && g.recibido > g.monto && <p className="flex justify-between"><span>Cambio</span><span>{mx(g.recibido - g.monto)}</span></p>}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{p.comprobante === "factura" ? "Su factura se enviará por correo." : "Este ticket no es comprobante fiscal."}</p>
      <p className="text-center">Gracias por su compra · tuval.mx</p>
      <Imprimir />
    </main>
  );
}
